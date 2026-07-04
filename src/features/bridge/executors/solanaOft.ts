import type { SolanaSigner } from "@kheopskit/core/solana";
import { getBase58Decoder } from "@solana/kit";
import { fromHex } from "polkadot-api/utils";
import { SOLANA_TAO_OFT } from "@/config/layerzero";
import { withSolanaRpc } from "@/lib/clients/solana";
import { waitForDelivery } from "./layerzeroOft";
import type { ExecutionResult, OnPhase } from "./native";

const SOLANA_RPC_URL = "https://solana-rpc.publicnode.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/** Estimated cost (lamports) of a Solana OFT send: LZ fee + tx fee margin. */
export const quoteSolanaOftFee = async ({
	ownerAddress,
	dstEid,
	recipientH160,
	amountLd,
}: {
	ownerAddress: string;
	dstEid: number;
	recipientH160: `0x${string}`;
	amountLd: bigint;
}): Promise<bigint> => {
	const [{ oft }, { createUmi }, { publicKey: umiPk }] = await Promise.all([
		import("@layerzerolabs/oft-v2-solana-sdk"),
		import("@metaplex-foundation/umi-bundle-defaults"),
		import("@metaplex-foundation/umi"),
	]);
	const umi = createUmi(SOLANA_RPC_URL);
	const to = new Uint8Array(32);
	to.set(fromHex(recipientH160), 12);
	const { nativeFee } = await oft.quote(
		umi.rpc,
		{
			payer: umiPk(ownerAddress),
			tokenMint: umiPk("taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY"),
			tokenEscrow: umiPk(SOLANA_TAO_OFT.escrow),
		},
		{ dstEid, to, amountLd, minAmountLd: amountLd },
		{ oft: umiPk(SOLANA_TAO_OFT.program) },
		undefined,
		// quote simulates the send — without the lookup table it exceeds the
		// legacy transaction size limit and fails
		umiPk(SOLANA_TAO_OFT.lookupTable),
	);
	return nativeFee + 10_000n; // + tx fee margin
};

/**
 * TAO from Solana back to Bittensor EVM via the wTAO OFT lane.
 * The LayerZero Solana SDK (umi/web3.js-v1 world) builds the send
 * instruction with a no-op signer; the compiled v0 message is then signed
 * and sent through the wallet's kit-native signer. Heavy deps are imported
 * lazily so they stay out of the main bundle.
 * `amountLd` is in 9-dec TAO base units, pre-floored to 6 shared decimals.
 * `recipientH160` is the EVM destination (wTAO arrives there).
 */
export const executeSolanaOft = async ({
	signer,
	ownerAddress,
	dstEid,
	recipientH160,
	amountLd,
	onPhase,
}: {
	signer: SolanaSigner;
	ownerAddress: string;
	dstEid: number;
	recipientH160: `0x${string}`;
	amountLd: bigint;
	onPhase: OnPhase;
}): Promise<ExecutionResult> => {
	const [
		{ oft },
		{ createUmi },
		{ createNoopSigner, publicKey: umiPk },
		{ toWeb3JsInstruction },
		web3,
	] = await Promise.all([
		import("@layerzerolabs/oft-v2-solana-sdk"),
		import("@metaplex-foundation/umi-bundle-defaults"),
		import("@metaplex-foundation/umi"),
		import("@metaplex-foundation/umi-web3js-adapters"),
		import("@solana/web3.js"),
	]);

	const umi = createUmi(SOLANA_RPC_URL);
	const payer = createNoopSigner(umiPk(ownerAddress));
	const mintPk = new web3.PublicKey(
		"taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY",
	);
	const ownerPk = new web3.PublicKey(ownerAddress);

	// associated token account holding the user's TAO
	const [tokenSource] = web3.PublicKey.findProgramAddressSync(
		[
			ownerPk.toBytes(),
			new web3.PublicKey(TOKEN_PROGRAM).toBytes(),
			mintPk.toBytes(),
		],
		new web3.PublicKey(ATA_PROGRAM),
	);

	// bytes32 recipient: left-padded H160
	const to = new Uint8Array(32);
	to.set(fromHex(recipientH160), 12);

	const quoteAccounts = {
		payer: umiPk(ownerAddress),
		tokenMint: umiPk(mintPk.toBase58()),
		tokenEscrow: umiPk(SOLANA_TAO_OFT.escrow),
	};
	const sendParams = {
		dstEid,
		to,
		amountLd,
		minAmountLd: amountLd, // pre-floored to shared decimals — no slippage
	};
	const programs = { oft: umiPk(SOLANA_TAO_OFT.program) };

	const { nativeFee } = await oft.quote(
		umi.rpc,
		quoteAccounts,
		sendParams,
		programs,
		undefined,
		// quote simulates the send — needs the lookup table to fit
		umiPk(SOLANA_TAO_OFT.lookupTable),
	);

	const wrapped = await oft.send(
		umi.rpc,
		{ ...quoteAccounts, payer, tokenSource: umiPk(tokenSource.toBase58()) },
		{ ...sendParams, nativeFee },
		programs,
	);
	const sendIx = toWeb3JsInstruction(wrapped.instruction);

	// v0 transaction with LayerZero's public lookup table (send has too many
	// accounts for a legacy transaction)
	const connection = new web3.Connection(SOLANA_RPC_URL);
	const { value: lookupTable } = await connection.getAddressLookupTable(
		new web3.PublicKey(SOLANA_TAO_OFT.lookupTable),
	);

	const { value: latestBlockhash } = await withSolanaRpc((rpc) =>
		rpc.getLatestBlockhash().send(),
	);

	const message = new web3.TransactionMessage({
		payerKey: ownerPk,
		recentBlockhash: latestBlockhash.blockhash,
		instructions: [
			web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
			sendIx,
		],
	}).compileToV0Message(lookupTable ? [lookupTable] : []);

	onPhase("signing");
	const messageBytes = message.serialize();
	const [signatureBytes] = await signer.signAndSendTransactions(
		[
			{
				messageBytes,
				signatures: { [ownerAddress]: null },
			} as never,
		],
		{},
	);
	if (!signatureBytes) throw new Error("Wallet returned no signature");
	const signature = getBase58Decoder().decode(signatureBytes);

	onPhase("delivering");
	await waitForDelivery(signature);

	onPhase("finalized");
	return {
		txHash: signature,
		explorerUrl: `https://layerzeroscan.com/tx/${signature}`,
	};
};
