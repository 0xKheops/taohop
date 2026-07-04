import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { EVM_RPC_URLS, viemChains } from "@/config/chains";

export type EvmChainKey = keyof typeof viemChains;

const clients = new Map<EvmChainKey, PublicClient>();

export const getEvmPublicClient = (chainKey: EvmChainKey): PublicClient => {
	let client = clients.get(chainKey);
	if (!client) {
		client = createPublicClient({
			chain: viemChains[chainKey],
			// fallback across providers; spaced retries — the Bittensor lite
			// RPC rate-limits at 25 req/min
			transport: fallback(
				EVM_RPC_URLS[chainKey].map((url) =>
					http(url, { retryCount: 2, retryDelay: 2_000 }),
				),
			),
		}) as PublicClient;
		clients.set(chainKey, client);
	}
	return client;
};
