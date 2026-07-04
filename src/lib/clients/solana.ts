import { createSolanaRpc } from "@solana/kit";

/**
 * Public Solana RPC endpoints, in fallback order. Probed from a browser
 * origin (July 2026): publicnode = 200 + CORS *; rejected: mainnet-beta
 * (403 for browser apps), dRPC (Solana not on free tier), OnFinality (429
 * without key), Ankr (key required), Lava (403).
 */
const SOLANA_RPC_URLS = ["https://solana-rpc.publicnode.com"];

const rpcs = SOLANA_RPC_URLS.map((url) => createSolanaRpc(url));

/** Run a query against each RPC in order until one succeeds. */
export const withSolanaRpc = async <T>(
	fn: (rpc: ReturnType<typeof createSolanaRpc>) => Promise<T>,
): Promise<T> => {
	let lastError: unknown;
	for (const rpc of rpcs) {
		try {
			return await fn(rpc);
		} catch (err) {
			lastError = err;
		}
	}
	throw lastError;
};
