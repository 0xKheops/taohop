import { address as solanaAddress } from "@solana/kit";
import { useQuery } from "@tanstack/react-query";
import { erc20Abi } from "viem";
import type { TokenDef } from "@/config/tokens";
import { getBittensorApi } from "@/lib/clients/papi";
import { withSolanaRpc } from "@/lib/clients/solana";
import { getEvmPublicClient } from "@/lib/clients/viem";

const fetchBalance = async (
	token: TokenDef,
	address: string,
): Promise<bigint | null> => {
	switch (token.kind) {
		case "native": {
			if (token.chainId === "bittensor") {
				const account =
					await getBittensorApi().query.System.Account.getValue(address);
				return account.data.free;
			}
			if (token.chainId === "bittensorEvm")
				return getEvmPublicClient("bittensorEvm").getBalance({
					address: address as `0x${string}`,
				});
			return null;
		}
		case "erc20": {
			if (
				token.chainId !== "ethereum" &&
				token.chainId !== "base" &&
				token.chainId !== "bittensorEvm"
			)
				return null;
			return getEvmPublicClient(token.chainId).readContract({
				address: token.address,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [address as `0x${string}`],
			});
		}
		case "spl": {
			const accounts = await withSolanaRpc((rpc) =>
				rpc
					.getTokenAccountsByOwner(
						solanaAddress(address),
						{ mint: solanaAddress(token.mint) },
						{ encoding: "jsonParsed" },
					)
					.send(),
			);
			return accounts.value.reduce(
				(sum, acc) =>
					sum + BigInt(acc.account.data.parsed.info.tokenAmount.amount),
				0n,
			);
		}
	}
};

export const useTokenBalance = (
	token: TokenDef | undefined,
	address: string | undefined,
) =>
	useQuery({
		queryKey: ["balance", token?.id, address],
		enabled: !!token && !!address,
		// gentle: the public Bittensor EVM RPC rate-limits at 25 req/min
		refetchInterval: 30_000,
		queryFn: () => {
			if (!token || !address) return null;
			return fetchBalance(token, address);
		},
	});
