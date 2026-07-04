import type { ChainId } from "./chains";

/**
 * LayerZero V2 endpoint IDs (mainnet). Bittensor EVM = chainKey "subtensorevm"
 * in LayerZero metadata. All values verified against
 * https://metadata.layerzero-api.com/v1/metadata/deployments (July 2026).
 */
export const LZ_EIDS = {
	bittensorEvm: 30374,
	ethereum: 30101,
	base: 30184,
	solana: 30168,
} as const satisfies Partial<Record<ChainId, number>>;

export type LzChainId = keyof typeof LZ_EIDS;

export type OftDeployment = {
	/** OFT contract handling quoteSend/send on the EVM source chain. */
	address: `0x${string}`;
	/** Adapter (lockbox) OFTs pull the underlying ERC-20 — needs approval. */
	approvalRequired: boolean;
};

/**
 * vTAO OFT deployments, verified on-chain (peers cross-checked July 2026):
 * - Bittensor EVM: OFT **Adapter** (lockbox) — requires ERC-20 approval,
 *   wraps the vTAO token at 0x3104…12Af.
 * - Ethereum/Base: native OFT — the token contract itself, no approval.
 */
export const VTAO_OFT: Record<Exclude<LzChainId, "solana">, OftDeployment> = {
	bittensorEvm: {
		address: "0x79Ce842dEAA61D7668a2f31D964502F0d777bA89",
		approvalRequired: true,
	},
	ethereum: {
		address: "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF",
		approvalRequired: false,
	},
	base: {
		address: "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF",
		approvalRequired: false,
	},
};

/**
 * wTAO — WETH-style wrap of native TAO on Bittensor EVM, itself a LayerZero
 * OFT whose only peer is Solana (eid 30168, program tao3RyGP…rTAQQ minting
 * taoC6…BRrBY). deposit() wraps native TAO 1:1, withdraw() unwraps.
 * Verified on-chain July 2026 (peer + sharedDecimals + approvalRequired).
 */
export const WTAO_OFT: OftDeployment = {
	address: "0x134f59E8B8637FD70ae12f263492B1dc73A25D1e",
	approvalRequired: false,
};

/**
 * OFT shared decimals (both vTAO and wTAO lanes): amounts are truncated to
 * this precision on send. UI must cap bridged inputs at 6 decimals so nothing
 * is silently floored.
 */
export const OFT_SHARED_DECIMALS = 6;

export const isLzChain = (chainId: ChainId): chainId is LzChainId =>
	chainId in LZ_EIDS;
