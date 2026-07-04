import { isLzChain } from "@/config/layerzero";
import { getToken, type TokenId } from "@/config/tokens";
import type { RouteResult, RouteStep } from "./types";

const step = (
	kind: RouteStep["kind"],
	from: TokenId,
	to: TokenId,
	rail: RouteStep["rail"],
): RouteStep => ({ kind, from, to, rail });

/**
 * Resolve the ordered steps to move `from` → `to`, or explain why it can't be
 * done. Pure function — the correctness core of the app.
 */
export const getRoute = (from: TokenId, to: TokenId): RouteResult => {
	if (from === to)
		return {
			ok: false,
			reason: "invalid",
			message: "Source and destination are the same.",
		};

	const fromToken = getToken(from);
	const toToken = getToken(to);

	if (fromToken.symbol !== toToken.symbol)
		return {
			ok: false,
			reason: "unsupported",
			message:
				"Token conversions (swaps, wrapping) are not supported — only bridging the same asset.",
		};

	// TAO native leg: Bittensor substrate ↔ Bittensor EVM (same chain under the hood)
	if (from === "bittensor:TAO" && to === "bittensorEvm:TAO")
		return {
			ok: true,
			steps: [step("native-substrate-to-evm", from, to, "Native")],
		};
	if (from === "bittensorEvm:TAO" && to === "bittensor:TAO")
		return {
			ok: true,
			steps: [step("native-evm-to-substrate", from, to, "Native")],
		};

	// TAO ↔ Solana via Wormhole NTT — M4, pending source-topology verification
	if (
		fromToken.symbol === "TAO" &&
		(fromToken.chainId === "solana" || toToken.chainId === "solana")
	)
		return {
			ok: false,
			reason: "planned",
			message: "TAO ↔ Solana via Wormhole is coming soon.",
		};

	// vTAO ↔ vTAO across EVM chains via LayerZero OFT
	if (
		fromToken.symbol === "vTAO" &&
		isLzChain(fromToken.chainId) &&
		isLzChain(toToken.chainId)
	)
		return {
			ok: true,
			steps: [step("layerzero-oft", from, to, "LayerZero")],
		};

	// Plain TAO to Ethereum/Base: no trustless rail exists
	return {
		ok: false,
		reason: "unsupported",
		message:
			"No trustless bridge exists for plain TAO on this chain. Bridge vTAO instead, or wrap TAO into vTAO on tao.app first.",
	};
};
