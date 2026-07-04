import {
	erc20Abi,
	publicActions,
	type TransactionReceipt,
	type WalletClient,
} from "viem";
import { viemChains } from "@/config/chains";
import type { LzChainId, OftDeployment } from "@/config/layerzero";
import { getEvmPublicClient } from "@/lib/clients/viem";
import type { ExecutionResult, OnPhase } from "./native";

const oftAbi = [
	{
		name: "quoteSend",
		type: "function",
		stateMutability: "view",
		inputs: [
			{
				name: "sendParam",
				type: "tuple",
				components: [
					{ name: "dstEid", type: "uint32" },
					{ name: "to", type: "bytes32" },
					{ name: "amountLD", type: "uint256" },
					{ name: "minAmountLD", type: "uint256" },
					{ name: "extraOptions", type: "bytes" },
					{ name: "composeMsg", type: "bytes" },
					{ name: "oftCmd", type: "bytes" },
				],
			},
			{ name: "payInLzToken", type: "bool" },
		],
		outputs: [
			{
				name: "fee",
				type: "tuple",
				components: [
					{ name: "nativeFee", type: "uint256" },
					{ name: "lzTokenFee", type: "uint256" },
				],
			},
		],
	},
	{
		name: "send",
		type: "function",
		stateMutability: "payable",
		inputs: [
			{
				name: "sendParam",
				type: "tuple",
				components: [
					{ name: "dstEid", type: "uint32" },
					{ name: "to", type: "bytes32" },
					{ name: "amountLD", type: "uint256" },
					{ name: "minAmountLD", type: "uint256" },
					{ name: "extraOptions", type: "bytes" },
					{ name: "composeMsg", type: "bytes" },
					{ name: "oftCmd", type: "bytes" },
				],
			},
			{
				name: "fee",
				type: "tuple",
				components: [
					{ name: "nativeFee", type: "uint256" },
					{ name: "lzTokenFee", type: "uint256" },
				],
			},
			{ name: "refundAddress", type: "address" },
		],
		outputs: [
			{
				name: "msgReceipt",
				type: "tuple",
				components: [
					{ name: "guid", type: "bytes32" },
					{ name: "nonce", type: "uint64" },
				],
			},
			{
				name: "oftReceipt",
				type: "tuple",
				components: [
					{ name: "amountSentLD", type: "uint256" },
					{ name: "amountReceivedLD", type: "uint256" },
				],
			},
		],
	},
] as const;

const switchToChain = async (
	walletClient: WalletClient,
	chainId: Exclude<LzChainId, "solana">,
) => {
	const chain = viemChains[chainId];
	const current = await walletClient.getChainId();
	if (current === chain.id) return;
	try {
		await walletClient.switchChain({ id: chain.id });
	} catch {
		await walletClient.addChain({ chain });
	}
};

/** Poll LayerZero Scan until the message is delivered on the destination. */
const waitForDelivery = async (txHash: string): Promise<void> => {
	const deadline = Date.now() + 10 * 60_000;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(
				`https://scan.layerzero-api.com/v1/messages/tx/${txHash}`,
			);
			if (res.ok) {
				const body = (await res.json()) as {
					data?: Array<{ status?: { name?: string } }>;
				};
				const status = body.data?.[0]?.status?.name;
				if (status === "DELIVERED") return;
				if (status === "FAILED" || status === "BLOCKED")
					throw new Error(`LayerZero message ${status}`);
			}
		} catch (err) {
			if (err instanceof Error && err.message.startsWith("LayerZero message"))
				throw err;
			// transient scan API failure — keep polling
		}
		await new Promise((r) => setTimeout(r, 10_000));
	}
	// timed out watching, but the message is on its way — not an error
};

/**
 * Generic LayerZero OFT send from an EVM chain (vTAO between EVM chains,
 * wTAO → Solana). Adapter (lockbox) OFTs get an exact-amount approval of the
 * underlying first; native OFTs are the token itself. Caller must pre-floor
 * `amount` to OFT_SHARED_DECIMALS (6) — the OFT truncates below that.
 * `recipient` is the destination address already encoded as bytes32
 * (left-padded H160 for EVM, raw pubkey bytes for Solana).
 */
export const executeLayerZeroOft = async ({
	walletClient,
	oft,
	underlying,
	fromChain,
	dstEid,
	recipient,
	amount,
	onPhase,
}: {
	walletClient: WalletClient;
	oft: OftDeployment;
	/** ERC-20 pulled by an adapter OFT — required when approvalRequired. */
	underlying?: `0x${string}`;
	fromChain: Exclude<LzChainId, "solana">;
	dstEid: number;
	recipient: `0x${string}`;
	amount: bigint;
	onPhase: OnPhase;
}): Promise<ExecutionResult> => {
	const account = walletClient.account;
	if (!account) throw new Error("Wallet client has no account");

	const chain = viemChains[fromChain];
	const publicClient = getEvmPublicClient(fromChain);

	onPhase("switching-chain");
	await switchToChain(walletClient, fromChain);

	if (oft.approvalRequired) {
		if (!underlying) throw new Error("Missing underlying token for approval");

		const allowance = await publicClient.readContract({
			address: underlying,
			abi: erc20Abi,
			functionName: "allowance",
			args: [account.address, oft.address],
		});

		if (allowance < amount) {
			onPhase("approving");
			const approveHash = await walletClient.writeContract({
				account,
				chain,
				address: underlying,
				abi: erc20Abi,
				functionName: "approve",
				args: [oft.address, amount], // exact amount, never infinite
			});
			const approveReceipt = await walletClient
				.extend(publicActions)
				.waitForTransactionReceipt({ hash: approveHash });
			if (approveReceipt.status !== "success")
				throw new Error("Approval transaction reverted");
		}
	}

	const sendParam = {
		dstEid,
		to: recipient,
		amountLD: amount,
		minAmountLD: amount, // amount is pre-floored to shared decimals — no slippage
		extraOptions: "0x" as const, // enforced options are set on every lane
		composeMsg: "0x" as const,
		oftCmd: "0x" as const,
	};

	const { nativeFee } = await publicClient.readContract({
		address: oft.address,
		abi: oftAbi,
		functionName: "quoteSend",
		args: [sendParam, false],
	});

	onPhase("signing");
	const txHash = await walletClient.writeContract({
		account,
		chain,
		address: oft.address,
		abi: oftAbi,
		functionName: "send",
		args: [sendParam, { nativeFee, lzTokenFee: 0n }, account.address],
		value: nativeFee,
	});

	onPhase("broadcasting");
	let receipt: TransactionReceipt;
	try {
		receipt = await walletClient
			.extend(publicActions)
			.waitForTransactionReceipt({ hash: txHash, pollingInterval: 4_000 });
	} catch {
		receipt = await publicClient.waitForTransactionReceipt({
			hash: txHash,
			pollingInterval: 10_000,
			retryCount: 5,
			timeout: 120_000,
		});
	}
	if (receipt.status !== "success")
		throw new Error(`Transaction reverted: ${txHash}`);

	onPhase("delivering");
	await waitForDelivery(txHash);

	onPhase("finalized");
	return {
		txHash,
		explorerUrl: `https://layerzeroscan.com/tx/${txHash}`,
	};
};
