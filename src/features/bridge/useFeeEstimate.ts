import { useQuery } from "@tanstack/react-query";
import { pad } from "viem";
import { LZ_EIDS, VTAO_OFT, WTAO_OFT } from "@/config/layerzero";
import { getToken } from "@/config/tokens";
import type { RouteResult, RouteStep } from "@/lib/routes/types";
import { quoteEvmOftFee } from "./executors/layerzeroOft";
import { estimateEvmFee, estimateSubstrateFee } from "./executors/native";
import { estimateWrapFee } from "./executors/wrap";

const estimateStepFee = async (
	step: RouteStep,
	fromAddress: string,
	amount: bigint,
): Promise<bigint> => {
	switch (step.kind) {
		case "native-substrate-to-evm":
			return estimateSubstrateFee(fromAddress);
		case "native-evm-to-substrate":
			return estimateEvmFee(fromAddress as `0x${string}`);
		case "wrap-tao":
			return estimateWrapFee("deposit", fromAddress as `0x${string}`, amount);
		case "unwrap-wtao":
			return estimateWrapFee("withdraw", fromAddress as `0x${string}`, amount);
		case "layerzero-oft": {
			const fromToken = getToken(step.from);
			const toToken = getToken(step.to);
			const dstEid = LZ_EIDS[toToken.chainId as keyof typeof LZ_EIDS];
			if (!dstEid) throw new Error("Unsupported OFT destination");

			if (fromToken.chainId === "solana") {
				const { quoteSolanaOftFee } = await import("./executors/solanaOft");
				return quoteSolanaOftFee({
					ownerAddress: fromAddress,
					dstEid,
					// recipient identity is irrelevant for the quote
					recipientH160: "0x0000000000000000000000000000000000000001",
					amountLd: amount,
				});
			}

			const fromChain = fromToken.chainId as Exclude<
				keyof typeof LZ_EIDS,
				"solana"
			>;
			const oft =
				fromToken.symbol === "vTAO"
					? VTAO_OFT[fromChain as keyof typeof VTAO_OFT]
					: WTAO_OFT;
			return quoteEvmOftFee({
				oft,
				fromChain,
				dstEid,
				// any 32-byte value quotes the same
				recipient: pad("0x0000000000000000000000000000000000000001", {
					size: 32,
				}),
				amount,
			});
		}
	}
};

/**
 * Total estimated fees for a route, in the source chain's native currency.
 * All steps of a route execute on the source chain, so a single sum works.
 */
export const useFeeEstimate = (
	route: RouteResult,
	fromAddress: string | undefined,
	amount: bigint | null,
) =>
	useQuery({
		queryKey: [
			"feeEstimate",
			route.ok ? route.steps.map((s) => `${s.kind}:${s.from}`) : "no-route",
			fromAddress,
			amount?.toString(),
		],
		enabled: route.ok && !!fromAddress && !!amount && amount > 0n,
		staleTime: 30_000,
		refetchInterval: 60_000,
		queryFn: async () => {
			if (!route.ok || !fromAddress || !amount) return null;
			let total = 0n;
			for (const step of route.steps) {
				total += await estimateStepFee(step, fromAddress, amount);
			}
			return total;
		},
	});
