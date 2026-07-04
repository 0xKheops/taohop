import type { EthereumAccount } from "@kheopskit/core/ethereum";
import type { PolkadotAccount } from "@kheopskit/core/polkadot";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { RouteStep } from "@/lib/routes/types";
import {
	type ExecutionPhase,
	type ExecutionResult,
	executeEvmToSubstrate,
	executeSubstrateToEvm,
} from "./executors/native";

export type ExecutionStatus =
	| { state: "idle" }
	| { state: "running"; phase: ExecutionPhase }
	| { state: "success"; result: ExecutionResult }
	| { state: "error"; message: string };

export const useBridgeExecutor = () => {
	const [status, setStatus] = useState<ExecutionStatus>({ state: "idle" });
	const queryClient = useQueryClient();

	const reset = useCallback(() => setStatus({ state: "idle" }), []);

	const execute = useCallback(
		async ({
			step,
			fromAccount,
			destinationAddress,
			amount,
		}: {
			step: RouteStep;
			fromAccount: PolkadotAccount | EthereumAccount;
			destinationAddress: string;
			amount: bigint;
		}) => {
			setStatus({ state: "running", phase: "signing" });
			const onPhase = (phase: ExecutionPhase) =>
				setStatus({ state: "running", phase });

			try {
				let result: ExecutionResult;
				switch (step.kind) {
					case "native-substrate-to-evm": {
						if (fromAccount.platform !== "polkadot")
							throw new Error("Substrate account required");
						result = await executeSubstrateToEvm({
							signer: fromAccount.polkadotSigner,
							destinationH160: destinationAddress as `0x${string}`,
							amountRao: amount,
							onPhase,
						});
						break;
					}
					case "native-evm-to-substrate": {
						if (fromAccount.platform !== "ethereum")
							throw new Error("Ethereum account required");
						result = await executeEvmToSubstrate({
							walletClient: fromAccount.client,
							destinationSs58: destinationAddress,
							amountWei: amount,
							onPhase,
						});
						break;
					}
					default:
						throw new Error(`Step not implemented yet: ${step.kind}`);
				}
				setStatus({ state: "success", result });
				queryClient.invalidateQueries({ queryKey: ["balance"] });
			} catch (err) {
				setStatus({
					state: "error",
					message: err instanceof Error ? err.message : String(err),
				});
			}
		},
		[queryClient],
	);

	return { status, execute, reset };
};
