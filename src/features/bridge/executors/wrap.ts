import { encodeFunctionData, publicActions, type WalletClient } from "viem";
import { bittensorEvm } from "@/config/chains";
import { WTAO_OFT } from "@/config/layerzero";
import { getEvmPublicClient } from "@/lib/clients/viem";
import type { ExecutionResult, OnPhase } from "./native";

const wtaoAbi = [
	{
		name: "deposit",
		type: "function",
		stateMutability: "payable",
		inputs: [],
		outputs: [],
	},
	{
		name: "withdraw",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [{ name: "amount", type: "uint256" }],
		outputs: [],
	},
] as const;

const ensureBittensorEvm = async (walletClient: WalletClient) => {
	const current = await walletClient.getChainId();
	if (current === bittensorEvm.id) return;
	try {
		await walletClient.switchChain({ id: bittensorEvm.id });
	} catch {
		await walletClient.addChain({ chain: bittensorEvm });
	}
};

const runWtaoCall = async (
	walletClient: WalletClient,
	onPhase: OnPhase,
	fn: "deposit" | "withdraw",
	amount: bigint,
): Promise<ExecutionResult> => {
	const account = walletClient.account;
	if (!account) throw new Error("Wallet client has no account");

	onPhase("switching-chain");
	await ensureBittensorEvm(walletClient);

	onPhase("signing");
	const txHash = await walletClient.writeContract({
		account,
		chain: bittensorEvm,
		address: WTAO_OFT.address,
		abi: wtaoAbi,
		functionName: fn,
		...(fn === "deposit"
			? { args: [], value: amount }
			: { args: [amount] as const }),
	});

	onPhase("broadcasting");
	const receipt = await walletClient
		.extend(publicActions)
		.waitForTransactionReceipt({ hash: txHash, pollingInterval: 4_000 });
	if (receipt.status !== "success")
		throw new Error(`Transaction reverted: ${txHash}`);

	onPhase("finalized");
	return {
		txHash,
		explorerUrl: `https://evm.taostats.io/tx/${txHash}`,
	};
};

/** Estimated gas cost (18-dec TAO) of a wrap or unwrap call. */
export const estimateWrapFee = async (
	fn: "deposit" | "withdraw",
	from: `0x${string}`,
	amount: bigint,
): Promise<bigint> => {
	const client = getEvmPublicClient("bittensorEvm");
	const gasPrice = await client.getGasPrice();
	let gas: bigint;
	try {
		gas = await client.estimateGas({
			account: from,
			to: WTAO_OFT.address,
			...(fn === "deposit"
				? {
						value: 1n,
						data: encodeFunctionData({
							abi: wtaoAbi,
							functionName: "deposit",
						}),
					}
				: {
						data: encodeFunctionData({
							abi: wtaoAbi,
							functionName: "withdraw",
							args: [amount],
						}),
					}),
		});
	} catch {
		gas = 100_000n; // estimation reverts on zero balances — conservative fallback
	}
	return gas * gasPrice;
};

/** Wrap native TAO into wTAO 1:1 (WETH-style deposit). Amount 18 dec. */
export const executeWrapTao = (args: {
	walletClient: WalletClient;
	amount: bigint;
	onPhase: OnPhase;
}): Promise<ExecutionResult> =>
	runWtaoCall(args.walletClient, args.onPhase, "deposit", args.amount);

/** Unwrap wTAO back to native TAO 1:1. Amount 18 dec. */
export const executeUnwrapWtao = (args: {
	walletClient: WalletClient;
	amount: bigint;
	onPhase: OnPhase;
}): Promise<ExecutionResult> =>
	runWtaoCall(args.walletClient, args.onPhase, "withdraw", args.amount);
