import type { TokenId } from "@/config/tokens";

type RouteStepKind =
	| "native-substrate-to-evm" // Balances.transfer_keep_alive to mirror ss58
	| "native-evm-to-substrate" // BalanceTransfer precompile 0x…0800
	| "layerzero-oft" // vTAO OFT send (M3)
	| "wormhole-ntt"; // Solana TAO (M4)

export type RouteStep = {
	kind: RouteStepKind;
	from: TokenId;
	to: TokenId;
	/** Rail badge shown in the UI. */
	rail: "Native" | "LayerZero" | "Wormhole";
};

export type RouteResult =
	| { ok: true; steps: RouteStep[] }
	| {
			ok: false;
			/**
			 * unsupported — no rail exists at all (e.g. plain TAO to Ethereum).
			 * planned — rail exists, integration lands in a later milestone.
			 * invalid — nonsensical selection (same token, unknown pair).
			 */
			reason: "unsupported" | "planned" | "invalid";
			message: string;
	  };
