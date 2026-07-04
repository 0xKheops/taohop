import type { EthereumAccount } from "@kheopskit/core/ethereum";
import type { PolkadotAccount } from "@kheopskit/core/polkadot";
import type { SolanaAccount } from "@kheopskit/core/solana";
import { getAddressEncoder, address as solanaAddress } from "@solana/kit";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { pad, toHex } from "viem";
import { LZ_EIDS, VTAO_OFT, WTAO_OFT } from "@/config/layerzero";
import { getToken } from "@/config/tokens";
import type { RouteStep } from "@/lib/routes/types";
import { executeLayerZeroOft } from "./executors/layerzeroOft";
import {
	type ExecutionPhase,
	type ExecutionResult,
	executeEvmToSubstrate,
	executeSubstrateToEvm,
} from "./executors/native";
import { executeUnwrapWtao, executeWrapTao } from "./executors/wrap";
import {
	addTransferRecord,
	createTransferRecord,
	markStepSuccess,
	markTransferError,
	patchTransferRecord,
} from "./history";

export type ExecutionStatus =
	| { state: "idle" }
	| {
			state: "running";
			stepIndex: number;
			stepCount: number;
			label: string;
			phase: ExecutionPhase;
	  }
	| { state: "success"; result: ExecutionResult }
	| { state: "error"; message: string };

/** Destination address encoded as bytes32 for an OFT send. */
const encodeRecipient = (
	destinationChainId: string,
	destinationAddress: string,
): `0x${string}` =>
	destinationChainId === "solana"
		? toHex(
				new Uint8Array(
					getAddressEncoder().encode(solanaAddress(destinationAddress)),
				),
			)
		: pad(destinationAddress as `0x${string}`, { size: 32 });

export type BridgeAccount = PolkadotAccount | EthereumAccount | SolanaAccount;

const requireEthereum = (account: BridgeAccount): EthereumAccount => {
	if (account.platform !== "ethereum")
		throw new Error("Ethereum account required");
	return account;
};

export const useBridgeExecutor = () => {
	const [status, setStatus] = useState<ExecutionStatus>({ state: "idle" });
	const queryClient = useQueryClient();

	const reset = useCallback(() => setStatus({ state: "idle" }), []);

	const execute = useCallback(
		async ({
			steps,
			fromAccount,
			destinationAddress,
			amount,
		}: {
			steps: RouteStep[];
			fromAccount: BridgeAccount;
			destinationAddress: string;
			amount: bigint;
		}) => {
			const recordId = crypto.randomUUID();
			addTransferRecord(
				createTransferRecord({
					id: recordId,
					createdAt: Date.now(),
					steps,
					fromAddress: fromAccount.address,
					destinationAddress,
					amount,
				}),
			);

			let currentStepIndex = 0;
			try {
				let result: ExecutionResult | undefined;

				for (const [stepIndex, step] of steps.entries()) {
					currentStepIndex = stepIndex;
					const onPhase = (phase: ExecutionPhase) =>
						setStatus({
							state: "running",
							stepIndex,
							stepCount: steps.length,
							label: step.label,
							phase,
						});
					onPhase("signing");

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
							result = await executeEvmToSubstrate({
								walletClient: requireEthereum(fromAccount).client,
								destinationSs58: destinationAddress,
								amountWei: amount,
								onPhase,
							});
							break;
						}
						case "wrap-tao": {
							result = await executeWrapTao({
								walletClient: requireEthereum(fromAccount).client,
								amount,
								onPhase,
							});
							break;
						}
						case "unwrap-wtao": {
							result = await executeUnwrapWtao({
								walletClient: requireEthereum(fromAccount).client,
								amount,
								onPhase,
							});
							break;
						}
						case "layerzero-oft": {
							const fromToken = getToken(step.from);
							const toToken = getToken(step.to);
							const fromChain = fromToken.chainId;
							if (!(fromChain in LZ_EIDS))
								throw new Error("Unsupported OFT source chain");
							const dstEid = LZ_EIDS[toToken.chainId as keyof typeof LZ_EIDS];
							if (!dstEid) throw new Error("Unsupported OFT destination");

							if (fromChain === "solana") {
								if (fromAccount.platform !== "solana")
									throw new Error("Solana account required");
								const { executeSolanaOft } = await import(
									"./executors/solanaOft"
								);
								result = await executeSolanaOft({
									signer: fromAccount.signer,
									ownerAddress: fromAccount.address,
									dstEid,
									recipientH160: destinationAddress as `0x${string}`,
									amountLd: amount,
									onPhase,
								});
								break;
							}

							const isVtao = fromToken.symbol === "vTAO";
							const oft = isVtao
								? VTAO_OFT[fromChain as keyof typeof VTAO_OFT]
								: WTAO_OFT;
							const underlying =
								isVtao && oft.approvalRequired && fromToken.kind === "erc20"
									? fromToken.address
									: undefined;

							result = await executeLayerZeroOft({
								walletClient: requireEthereum(fromAccount).client,
								oft,
								underlying,
								fromChain: fromChain as Exclude<keyof typeof LZ_EIDS, "solana">,
								dstEid,
								recipient: encodeRecipient(toToken.chainId, destinationAddress),
								amount,
								onPhase,
							});
							break;
						}
					}

					if (result) {
						const stepResult = result;
						patchTransferRecord(recordId, (r) =>
							markStepSuccess(r, stepIndex, stepResult),
						);
					}
				}

				if (!result) throw new Error("Route has no steps");
				setStatus({ state: "success", result });
				queryClient.invalidateQueries({ queryKey: ["balance"] });
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				patchTransferRecord(recordId, (r) =>
					markTransferError(r, currentStepIndex, message),
				);
				setStatus({ state: "error", message });
			}
		},
		[queryClient],
	);

	return { status, execute, reset };
};
