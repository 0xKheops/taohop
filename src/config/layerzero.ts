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
} as const satisfies Partial<Record<ChainId, number>>;

export type LzChainId = keyof typeof LZ_EIDS;

/**
 * vTAO OFT deployments, verified on-chain (peers cross-checked July 2026):
 * - Bittensor EVM: OFT **Adapter** (lockbox) — requires ERC-20 approval,
 *   wraps the vTAO token at 0x3104…12af.
 * - Ethereum/Base: native OFT — the token contract itself, no approval.
 */
export const VTAO_OFT: Record<
	LzChainId,
	{ address: `0x${string}`; approvalRequired: boolean }
> = {
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
 * OFT shared decimals: amounts are truncated to this precision on send
 * (decimalConversionRate = 10^12 on the 18-dec side). UI must cap vTAO
 * inputs at 6 decimals so nothing is silently floored.
 */
export const VTAO_SHARED_DECIMALS = 6;

export const isLzChain = (chainId: ChainId): chainId is LzChainId =>
	chainId in LZ_EIDS;
