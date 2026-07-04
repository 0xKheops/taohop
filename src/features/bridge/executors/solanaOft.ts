import type { SolanaSigner } from "@kheopskit/core/solana";
import {
	type AccountMeta,
	AccountRole,
	type Address,
	address,
	appendTransactionMessageInstructions,
	type Blockhash,
	compileTransaction,
	compressTransactionMessageUsingAddressLookupTables,
	createTransactionMessage,
	getAddressDecoder,
	getAddressEncoder,
	getBase58Decoder,
	getBase64EncodedWireTransaction,
	getBase64Encoder,
	getProgramDerivedAddress,
	type Instruction,
	pipe,
	setTransactionMessageFeePayer,
	setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { fromHex } from "polkadot-api/utils";
import { LZ_EIDS, SOLANA_TAO_OFT } from "@/config/layerzero";
import { withSolanaRpc } from "@/lib/clients/solana";
import { waitForDelivery } from "./layerzeroOft";
import type { ExecutionResult, OnPhase } from "./native";
import {
	QUOTE_ACCOUNT_TEMPLATE,
	QUOTE_SEND_DISCRIMINATOR,
	SEND_ACCOUNT_TEMPLATE,
	SEND_DISCRIMINATOR,
	SEND_SLOT_FEE_PAYER,
	SEND_SLOT_SIGNER,
	SEND_SLOT_TOKEN_SOURCE,
} from "./solanaOftLane";

const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const COMPUTE_BUDGET_PROGRAM = address(
	"ComputeBudget111111111111111111111111111111",
);
const TAO_MINT = address("taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY");

/** The vendored account templates are only valid for the wTAO lane. */
const assertSupportedLane = (dstEid: number) => {
	if (dstEid !== LZ_EIDS.bittensorEvm)
		throw new Error(`Unsupported OFT destination eid ${dstEid}`);
};

const encodeU64 = (view: DataView, offset: number, value: bigint) =>
	view.setBigUint64(offset, value, true);

/**
 * oft::send args — Anchor/borsh layout verified byte-for-byte against the
 * SDK output (see solanaOftLane.ts): discriminator, dstEid u32, to [u8;32],
 * amountLd u64, minAmountLd u64, options vec<u8> (empty — enforced options
 * apply), composeMsg Option<vec<u8>> (none), nativeFee u64, lzTokenFee u64.
 */
export const encodeSendData = ({
	dstEid,
	to,
	amountLd,
	nativeFee,
}: {
	dstEid: number;
	to: Uint8Array;
	amountLd: bigint;
	nativeFee: bigint;
}): Uint8Array => {
	const data = new Uint8Array(81);
	const view = new DataView(data.buffer);
	data.set(SEND_DISCRIMINATOR, 0);
	view.setUint32(8, dstEid, true);
	data.set(to, 12);
	encodeU64(view, 44, amountLd);
	encodeU64(view, 52, amountLd); // minAmountLd — amount pre-floored, no slippage
	view.setUint32(60, 0, true); // options length
	data[64] = 0; // composeMsg: None
	encodeU64(view, 65, nativeFee);
	encodeU64(view, 73, 0n); // lzTokenFee
	return data;
};

/** oft::quote_send args — same head as send, then payInLzToken bool. */
export const encodeQuoteData = ({
	dstEid,
	to,
	amountLd,
}: {
	dstEid: number;
	to: Uint8Array;
	amountLd: bigint;
}): Uint8Array => {
	const data = new Uint8Array(66);
	const view = new DataView(data.buffer);
	data.set(QUOTE_SEND_DISCRIMINATOR, 0);
	view.setUint32(8, dstEid, true);
	data.set(to, 12);
	encodeU64(view, 44, amountLd);
	encodeU64(view, 52, amountLd); // minAmountLd
	view.setUint32(60, 0, true); // options length
	data[64] = 0; // composeMsg: None
	data[65] = 0; // payInLzToken: false
	return data;
};

const setComputeUnitLimit = (units: number): Instruction => {
	const data = new Uint8Array(5);
	data[0] = 2; // SetComputeUnitLimit
	new DataView(data.buffer).setUint32(1, units, true);
	return { programAddress: COMPUTE_BUDGET_PROGRAM, data };
};

/** Associated token account holding the owner's TAO. */
const deriveTokenSource = async (owner: Address): Promise<Address> => {
	const enc = getAddressEncoder();
	const [ata] = await getProgramDerivedAddress({
		programAddress: ATA_PROGRAM,
		seeds: [enc.encode(owner), enc.encode(TOKEN_PROGRAM), enc.encode(TAO_MINT)],
	});
	return ata;
};

/**
 * Addresses stored in LayerZero's public lookup table. Layout: 56-byte
 * LookupTableMeta header, then 32-byte addresses.
 */
const fetchLookupTableAddresses = async (): Promise<Address[]> => {
	const { value } = await withSolanaRpc((rpc) =>
		rpc
			.getAccountInfo(address(SOLANA_TAO_OFT.lookupTable), {
				encoding: "base64",
			})
			.send(),
	);
	if (!value) throw new Error("LayerZero lookup table account not found");
	const bytes = getBase64Encoder().encode(value.data[0]);
	const decoder = getAddressDecoder();
	const addresses: Address[] = [];
	for (let offset = 56; offset + 32 <= bytes.length; offset += 32)
		addresses.push(decoder.decode(bytes.slice(offset, offset + 32)));
	return addresses;
};

const recipientBytes32 = (recipientH160: `0x${string}`): Uint8Array => {
	const to = new Uint8Array(32);
	to.set(fromHex(recipientH160), 12);
	return to;
};

const buildTransaction = async ({
	feePayer,
	instructions,
	blockhash,
	lastValidBlockHeight,
}: {
	feePayer: Address;
	instructions: Instruction[];
	blockhash: string;
	lastValidBlockHeight: bigint;
}) => {
	const lookupTableAddresses = await fetchLookupTableAddresses();
	return pipe(
		createTransactionMessage({ version: 0 }),
		(tx) => setTransactionMessageFeePayer(feePayer, tx),
		(tx) =>
			setTransactionMessageLifetimeUsingBlockhash(
				{ blockhash: blockhash as Blockhash, lastValidBlockHeight },
				tx,
			),
		(tx) => appendTransactionMessageInstructions(instructions, tx),
		(tx) =>
			compressTransactionMessageUsingAddressLookupTables(tx, {
				[address(SOLANA_TAO_OFT.lookupTable)]: lookupTableAddresses,
			}),
		compileTransaction,
	);
};

/**
 * LayerZero fee (lamports) for the send, read from a simulated quote_send.
 * The quote instruction's accounts are fully static for the lane; the fee
 * is returned via Anchor return data as {nativeFee u64, lzTokenFee u64}.
 */
const quoteNativeFee = async ({
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
	assertSupportedLane(dstEid);
	const quoteIx: Instruction = {
		programAddress: address(SOLANA_TAO_OFT.program),
		accounts: QUOTE_ACCOUNT_TEMPLATE as AccountMeta[],
		data: encodeQuoteData({
			dstEid,
			to: recipientBytes32(recipientH160),
			amountLd,
		}),
	};
	const transaction = await buildTransaction({
		feePayer: address(ownerAddress),
		instructions: [setComputeUnitLimit(1_000_000), quoteIx],
		// placeholder — replaced by the RPC during simulation
		blockhash: "11111111111111111111111111111111",
		lastValidBlockHeight: 0n,
	});
	const { value } = await withSolanaRpc((rpc) =>
		rpc
			.simulateTransaction(getBase64EncodedWireTransaction(transaction), {
				encoding: "base64",
				sigVerify: false,
				replaceRecentBlockhash: true,
				commitment: "confirmed",
			})
			.send(),
	);
	if (value.err)
		throw new Error(
			`OFT quote simulation failed: ${JSON.stringify(value.err)}`,
		);
	if (!value.returnData?.data)
		throw new Error("OFT quote simulation returned no data");
	const fee = getBase64Encoder().encode(value.returnData.data[0]);
	return new DataView(fee.buffer, fee.byteOffset).getBigUint64(0, true);
};

/** Estimated cost (lamports) of a Solana OFT send: LZ fee + tx fee margin. */
export const quoteSolanaOftFee = async (args: {
	ownerAddress: string;
	dstEid: number;
	recipientH160: `0x${string}`;
	amountLd: bigint;
}): Promise<bigint> => (await quoteNativeFee(args)) + 10_000n;

/**
 * TAO from Solana back to Bittensor EVM via the wTAO OFT lane, built with
 * vendored instruction templates (see solanaOftLane.ts) instead of the
 * BUSL-licensed LayerZero SDK. `amountLd` is in 9-dec TAO base units,
 * pre-floored to 6 shared decimals. `recipientH160` receives wTAO.
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
	assertSupportedLane(dstEid);
	const owner = address(ownerAddress);

	const nativeFee = await quoteNativeFee({
		ownerAddress,
		dstEid,
		recipientH160,
		amountLd,
	});

	const accounts = [...SEND_ACCOUNT_TEMPLATE];
	accounts[SEND_SLOT_SIGNER] = {
		address: owner,
		role: AccountRole.READONLY_SIGNER,
	};
	accounts[SEND_SLOT_TOKEN_SOURCE] = {
		address: await deriveTokenSource(owner),
		role: AccountRole.WRITABLE,
	};
	accounts[SEND_SLOT_FEE_PAYER] = {
		address: owner,
		role: AccountRole.WRITABLE,
	};
	const sendIx: Instruction = {
		programAddress: address(SOLANA_TAO_OFT.program),
		accounts,
		data: encodeSendData({
			dstEid,
			to: recipientBytes32(recipientH160),
			amountLd,
			nativeFee,
		}),
	};

	// "confirmed" keeps the full ~60s validity window — the default (finalized)
	// blockhash is ~32 slots stale and can expire while the user reviews the
	// transaction in their wallet
	const { value: latestBlockhash } = await withSolanaRpc((rpc) =>
		rpc.getLatestBlockhash({ commitment: "confirmed" }).send(),
	);

	const transaction = await buildTransaction({
		feePayer: owner,
		// OFT send CPIs through the LZ endpoint + ULN + executor programs and
		// blows past 400k CUs; free to request more without a priority fee
		instructions: [setComputeUnitLimit(1_000_000), sendIx],
		blockhash: latestBlockhash.blockhash,
		lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
	});

	onPhase("signing");
	const [signatureBytes] = await signer.signAndSendTransactions([transaction]);
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
