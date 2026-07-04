import { createSolanaRpc } from "@solana/kit";

/** Public Solana RPC endpoints, in fallback order. */
const SOLANA_RPC_URLS = [
	"https://api.mainnet-beta.solana.com",
	"https://solana.drpc.org",
];

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
