import { createPublicClient, http, type PublicClient } from "viem";
import { viemChains } from "@/config/chains";

export type EvmChainKey = keyof typeof viemChains;

const clients = new Map<EvmChainKey, PublicClient>();

export const getEvmPublicClient = (chainKey: EvmChainKey): PublicClient => {
	let client = clients.get(chainKey);
	if (!client) {
		client = createPublicClient({
			chain: viemChains[chainKey],
			transport: http(),
		}) as PublicClient;
		clients.set(chainKey, client);
	}
	return client;
};
