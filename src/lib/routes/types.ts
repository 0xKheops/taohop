import type { TokenId } from "@/config/tokens";

type RouteStepKind =
	| "native-substrate-to-evm" // Balances.transfer_keep_alive to mirror ss58
	| "native-evm-to-substrate" // BalanceTransfer precompile 0x…0800
	| "wrap-tao" // wTAO.deposit() — native TAO → wTAO 1:1
	| "unwrap-wtao" // wTAO.withdraw() — wTAO → native TAO 1:1
	| "layerzero-oft"; // OFT send (vTAO between EVM chains, wTAO → Solana)

export type RouteStep = {
	kind: RouteStepKind;
	from: TokenId;
	to: TokenId;
	/** Short human label shown in the multi-step progress UI. */
	label: string;
	/** Rail badge shown in the UI. */
	rail: "Native" | "LayerZero";
};

export type RouteResult =
	| { ok: true; steps: RouteStep[] }
	| {
			ok: false;
			/**
			 * unsupported — no single-signer route exists (e.g. plain TAO to
			 * Ethereum); the message may point at a manual workaround.
			 * invalid — nonsensical selection (same token, unknown pair).
			 */
			reason: "unsupported" | "invalid";
			message: string;
	  };
