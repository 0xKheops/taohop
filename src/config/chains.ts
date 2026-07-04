import { defineChain } from "viem";
import { base, mainnet } from "viem/chains";

export type Platform = "polkadot" | "ethereum" | "solana";

export type ChainId =
	| "bittensor"
	| "bittensorEvm"
	| "ethereum"
	| "base"
	| "solana";

export type ChainDef = {
	id: ChainId;
	name: string;
	platform: Platform;
	logo: string;
	explorerUrl: string;
};

export const bittensorEvm = defineChain({
	id: 964,
	name: "Bittensor EVM",
	nativeCurrency: { name: "TAO", symbol: "TAO", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://lite.chain.opentensor.ai"] },
	},
	blockExplorers: {
		default: { name: "Taostats EVM", url: "https://evm.taostats.io" },
	},
});

export const BITTENSOR_WSS = "wss://entrypoint-finney.opentensor.ai:443";

export const viemChains = {
	bittensorEvm,
	ethereum: mainnet,
	base,
} as const;

export const CHAINS: Record<ChainId, ChainDef> = {
	bittensor: {
		id: "bittensor",
		name: "Bittensor",
		platform: "polkadot",
		logo: "/img/chains/bittensor.svg",
		explorerUrl: "https://taostats.io",
	},
	bittensorEvm: {
		id: "bittensorEvm",
		name: "Bittensor EVM",
		platform: "ethereum",
		logo: "/img/chains/bittensor-evm.svg",
		explorerUrl: "https://evm.taostats.io",
	},
	ethereum: {
		id: "ethereum",
		name: "Ethereum",
		platform: "ethereum",
		logo: "/img/chains/ethereum.svg",
		explorerUrl: "https://etherscan.io",
	},
	base: {
		id: "base",
		name: "Base",
		platform: "ethereum",
		logo: "/img/chains/base.svg",
		explorerUrl: "https://basescan.org",
	},
	solana: {
		id: "solana",
		name: "Solana",
		platform: "solana",
		logo: "/img/chains/solana.svg",
		explorerUrl: "https://solscan.io",
	},
};

export const getChain = (id: ChainId): ChainDef => CHAINS[id];
