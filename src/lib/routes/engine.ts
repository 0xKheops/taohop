import { isLzChain } from "@/config/layerzero";
import { getToken, type TokenId } from "@/config/tokens";
import type { RouteResult, RouteStep } from "./types";

const step = (
	kind: RouteStep["kind"],
	from: TokenId,
	to: TokenId,
	label: string,
	rail: RouteStep["rail"],
): RouteStep => ({ kind, from, to, label, rail });

/**
 * Resolve the ordered steps to move `from` → `to`, or explain why it can't be
 * done. Pure function — the correctness core of the app.
 *
 * Assets: TAO and wTAO are the same asset (1:1 WETH-style wrap on Bittensor
 * EVM); vTAO is a distinct asset (liquid-staked TAO) and never converts.
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

	// ----- TAO / wTAO family (same asset) -----
	const taoFamily = (symbol: string) => symbol === "TAO" || symbol === "wTAO";

	if (taoFamily(fromToken.symbol) && taoFamily(toToken.symbol)) {
		// Native leg: Bittensor substrate ↔ Bittensor EVM (same chain under the hood)
		if (from === "bittensor:TAO" && to === "bittensorEvm:TAO")
			return {
				ok: true,
				steps: [
					step(
						"native-substrate-to-evm",
						from,
						to,
						"Transfer to EVM",
						"Native",
					),
				],
			};
		if (from === "bittensorEvm:TAO" && to === "bittensor:TAO")
			return {
				ok: true,
				steps: [
					step(
						"native-evm-to-substrate",
						from,
						to,
						"Transfer to substrate",
						"Native",
					),
				],
			};

		// Wrap / unwrap on Bittensor EVM
		if (from === "bittensorEvm:TAO" && to === "bittensorEvm:wTAO")
			return {
				ok: true,
				steps: [step("wrap-tao", from, to, "Wrap TAO", "Native")],
			};
		if (from === "bittensorEvm:wTAO" && to === "bittensorEvm:TAO")
			return {
				ok: true,
				steps: [step("unwrap-wtao", from, to, "Unwrap wTAO", "Native")],
			};

		// To Solana: wTAO OFT lane (wrap first when starting from native TAO)
		if (to === "solana:TAO") {
			if (from === "bittensorEvm:wTAO")
				return {
					ok: true,
					steps: [
						step("layerzero-oft", from, to, "Bridge to Solana", "LayerZero"),
					],
				};
			if (from === "bittensorEvm:TAO")
				return {
					ok: true,
					steps: [
						step("wrap-tao", from, "bittensorEvm:wTAO", "Wrap TAO", "Native"),
						step(
							"layerzero-oft",
							"bittensorEvm:wTAO",
							to,
							"Bridge to Solana",
							"LayerZero",
						),
					],
				};
			if (from === "bittensor:TAO")
				return {
					ok: false,
					reason: "planned",
					message:
						"Direct Bittensor → Solana routes are coming soon. Bridge to Bittensor EVM first, then to Solana.",
				};
		}

		// From Solana: OFT send back to Bittensor EVM — arrives as wTAO
		if (from === "solana:TAO") {
			if (to === "bittensorEvm:wTAO")
				return {
					ok: true,
					steps: [
						step(
							"layerzero-oft",
							from,
							to,
							"Bridge to Bittensor EVM",
							"LayerZero",
						),
					],
				};
			return {
				ok: false,
				reason: "unsupported",
				message:
					"TAO from Solana arrives as wTAO on Bittensor EVM — select wTAO · Bittensor EVM as destination, then unwrap to native TAO in a second transfer.",
			};
		}

		return {
			ok: false,
			reason: "unsupported",
			message:
				"No trustless bridge exists for plain TAO on this chain. Bridge vTAO instead, or route through Bittensor EVM.",
		};
	}

	// ----- vTAO (distinct asset) -----
	if (fromToken.symbol === "vTAO" && toToken.symbol === "vTAO") {
		if (
			isLzChain(fromToken.chainId) &&
			isLzChain(toToken.chainId) &&
			fromToken.chainId !== "solana" &&
			toToken.chainId !== "solana"
		)
			return {
				ok: true,
				steps: [
					step("layerzero-oft", from, to, "Bridge via LayerZero", "LayerZero"),
				],
			};
		return {
			ok: false,
			reason: "unsupported",
			message: "vTAO is not deployed on this chain.",
		};
	}

	return {
		ok: false,
		reason: "unsupported",
		message:
			"Token conversions (swaps, staking) are not supported — only bridging the same asset. TAO ↔ wTAO wrapping is available on Bittensor EVM.",
	};
};
