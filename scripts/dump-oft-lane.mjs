/**
 * Regenerates the vendored account templates in
 * src/features/bridge/executors/solanaOftLane.ts.
 *
 * Run this if the lane's LayerZero config rotates (symptom: Solana fee
 * quotes fail / sends rejected at preflight). The LayerZero SDK is not a
 * project dependency anymore — install it temporarily:
 *
 *   pnpm add -D @layerzerolabs/oft-v2-solana-sdk@3.0.168 \
 *     @metaplex-foundation/umi@0.9.2 \
 *     @metaplex-foundation/umi-bundle-defaults@0.9.2 \
 *     @metaplex-foundation/umi-web3js-adapters@0.9.2 \
 *     @solana/web3.js@1.95.8
 *   node scripts/dump-oft-lane.mjs
 *   pnpm remove @layerzerolabs/oft-v2-solana-sdk @metaplex-foundation/umi \
 *     @metaplex-foundation/umi-bundle-defaults \
 *     @metaplex-foundation/umi-web3js-adapters @solana/web3.js
 *
 * It prints both account templates with payer-dependent slots marked, plus
 * the instruction data hex used by the unit tests in solanaOft.test.ts.
 * Two different payers are built to prove which slots vary.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { oft, OftPDA } = require("@layerzerolabs/oft-v2-solana-sdk");
const { createUmi } = require("@metaplex-foundation/umi-bundle-defaults");
const {
	createNoopSigner,
	publicKey: umiPk,
} = require("@metaplex-foundation/umi");
const {
	toWeb3JsInstruction,
} = require("@metaplex-foundation/umi-web3js-adapters");
const { EndpointProgram, UlnProgram } = require("@layerzerolabs/lz-solana-sdk-v2/umi");
const web3 = require("@solana/web3.js");

const RPC = "https://solana-rpc.publicnode.com";
const OFT_PROGRAM = "tao3RyGP8XiiWQKmBzkiULmPoMewWjq65b46H4rTAQQ";
const MINT = "taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY";
const ESCROW = "FeiTZPe7uJYJLux1CahrQnU94SjSXQ6zsdgobLm658LN";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const DST_EID = 30374;

// two payers to prove which slots are sender-dependent
const PAYERS = [
	"5xJvx7YrqCqgyzxx4PQXt1AVbxioUsGABf2zevmYC8UL",
	"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
];

const ata = (owner) =>
	web3.PublicKey.findProgramAddressSync(
		[
			new web3.PublicKey(owner).toBytes(),
			new web3.PublicKey(TOKEN_PROGRAM).toBytes(),
			new web3.PublicKey(MINT).toBytes(),
		],
		new web3.PublicKey(ATA_PROGRAM),
	)[0];

const umi = createUmi(RPC);
const to = new Uint8Array(32);
to.set(Buffer.from("5C9EBa3b10E45BF6db77267B40B95F3f91Fc5f67", "hex"), 12);

const buildSend = async (payer) => {
	const wrapped = await oft.send(
		umi.rpc,
		{
			payer: createNoopSigner(umiPk(payer)),
			tokenMint: umiPk(MINT),
			tokenEscrow: umiPk(ESCROW),
			tokenSource: umiPk(ata(payer).toBase58()),
		},
		{
			dstEid: DST_EID,
			to,
			amountLd: 10_000_000n,
			minAmountLd: 10_000_000n,
			nativeFee: 24_823_195n,
		},
		{ oft: umiPk(OFT_PROGRAM) },
	);
	return toWeb3JsInstruction(wrapped.instruction);
};

const buildQuote = async (payer) => {
	const deriver = new OftPDA(umiPk(OFT_PROGRAM));
	const [oftStore] = deriver.oftStore(umiPk(ESCROW));
	const [peer] = deriver.peer(oftStore, DST_EID);
	const peerInfo = await oft.accounts.fetchPeerConfig({ rpc: umi.rpc }, peer);
	const endpoint = new EndpointProgram.Endpoint(
		EndpointProgram.ENDPOINT_PROGRAM_ID,
	);
	const sendLibInfo = await endpoint.getSendLibrary(umi.rpc, oftStore, DST_EID);
	const remaining = await endpoint.getQuoteIXAccountMetaForCPI(
		umi.rpc,
		umiPk(payer),
		{
			path: { sender: oftStore, dstEid: DST_EID, receiver: peerInfo.peerAddress },
			msgLibProgram: new UlnProgram.Uln(sendLibInfo.programId),
		},
	);
	let txBuilder = oft.instructions.quoteSend(
		{ programs: oft.createOFTProgramRepo(umiPk(OFT_PROGRAM)) },
		{
			oftStore,
			peer,
			tokenMint: umiPk(MINT),
			dstEid: DST_EID,
			to,
			amountLd: 10_000_000n,
			minAmountLd: 10_000_000n,
			options: new Uint8Array(),
			payInLzToken: false,
			composeMsg: null,
		},
	);
	txBuilder = txBuilder.addRemainingAccounts(
		remaining.map((a) => ({
			pubkey: a.pubkey,
			isSigner: a.isSigner,
			isWritable: a.isWritable,
		})),
	);
	return toWeb3JsInstruction(txBuilder.getInstructions()[0]);
};

const dumps = {};
for (const payer of PAYERS) {
	dumps[payer] = { send: await buildSend(payer), quote: await buildQuote(payer) };
}

const [a, b] = PAYERS;
for (const kind of ["send", "quote"]) {
	const ka = dumps[a][kind].keys;
	const kb = dumps[b][kind].keys;
	const varying = ka
		.map((k, i) => (k.pubkey.toBase58() !== kb[i].pubkey.toBase58() ? i : -1))
		.filter((i) => i >= 0);
	console.log(`\n=== ${kind}: ${ka.length} accounts, payer-dependent slots: [${varying}]`);
	ka.forEach((k, i) => {
		const marker = varying.includes(i) ? " // PAYER-DEPENDENT" : "";
		const role = k.isSigner ? "S" : k.isWritable ? "W" : "R";
		console.log(`${String(i).padStart(2)} ${role} ${k.pubkey.toBase58()}${marker}`);
	});
	console.log(`data hex: ${Buffer.from(dumps[a][kind].data).toString("hex")}`);
}
