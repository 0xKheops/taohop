import { MultiAddress } from "@polkadot-api/descriptors";
import type { PolkadotSigner } from "polkadot-api";
import {
	encodeFunctionData,
	publicActions,
	type TransactionReceipt,
	toHex,
	type WalletClient,
} from "viem";
import { bittensorEvm } from "@/config/chains";
import { evmToBittensorMirror, ss58ToPublicKey } from "@/lib/address";
import { getBittensorApi } from "@/lib/clients/papi";
import { getEvmPublicClient } from "@/lib/clients/viem";

/** BalanceTransfer precompile: sends msg.value TAO to a substrate pubkey. */
const BALANCE_TRANSFER_PRECOMPILE =
	"0x0000000000000000000000000000000000000800" as const;

const balanceTransferAbi = [
	{
		name: "transfer",
		type: "function",
		stateMutability: "payable",
		inputs: [{ name: "data", type: "bytes32" }],
		outputs: [],
	},
] as const;

export type ExecutionPhase =
	| "switching-chain"
	| "approving"
	| "signing"
	| "broadcasting"
	| "in-block"
	| "delivering"
	| "finalized";

export type OnPhase = (phase: ExecutionPhase) => void;

export type ExecutionResult = {
	/** Transaction hash (EVM) or extrinsic hash (substrate). */
	txHash: string;
	explorerUrl: string;
};

/** Estimated fee (rao) for a substrate balance transfer, for Max computation. */
export const estimateSubstrateFee = async (
	fromSs58: string,
): Promise<bigint> => {
	const tx = getBittensorApi().tx.Balances.transfer_keep_alive({
		dest: MultiAddress.Id(fromSs58),
		value: 1n,
	});
	return tx.getEstimatedFees(fromSs58);
};

/** Estimated fee (18-dec) for a BalanceTransfer precompile call. */
export const estimateEvmFee = async (
	fromH160: `0x${string}`,
): Promise<bigint> => {
	const client = getEvmPublicClient("bittensorEvm");
	const gasPrice = await client.getGasPrice();
	let gas: bigint;
	try {
		gas = await client.estimateGas({
			account: fromH160,
			to: BALANCE_TRANSFER_PRECOMPILE,
			value: 1n,
			data: encodeFunctionData({
				abi: balanceTransferAbi,
				functionName: "transfer",
				args: [toHex(new Uint8Array(32), { size: 32 })],
			}),
		});
	} catch {
		gas = 100_000n; // conservative fallback when estimation reverts
	}
	return gas * gasPrice;
};

/**
 * Leg A — Bittensor substrate → Bittensor EVM.
 * Plain balance transfer to the destination H160's mirror ss58 account;
 * the balance then shows up as the EVM account's native balance.
 * Amount in rao (9 dec).
 */
export const executeSubstrateToEvm = async ({
	signer,
	destinationH160,
	amountRao,
	onPhase,
}: {
	signer: PolkadotSigner;
	destinationH160: `0x${string}`;
	amountRao: bigint;
	onPhase: OnPhase;
}): Promise<ExecutionResult> => {
	const mirror = evmToBittensorMirror(destinationH160);
	const tx = getBittensorApi().tx.Balances.transfer_keep_alive({
		dest: MultiAddress.Id(mirror),
		value: amountRao,
	});

	onPhase("signing");

	return new Promise<ExecutionResult>((resolve, reject) => {
		const subscription = tx.signSubmitAndWatch(signer).subscribe({
			next: (event) => {
				if (event.type === "broadcasted") onPhase("broadcasting");
				if (event.type === "txBestBlocksState" && event.found)
					onPhase("in-block");
				if (event.type === "finalized") {
					onPhase("finalized");
					if (!event.ok) {
						reject(
							new Error(
								`Transaction failed: ${JSON.stringify(event.dispatchError)}`,
							),
						);
					} else {
						resolve({
							txHash: event.txHash,
							explorerUrl: `https://taostats.io/extrinsic/${event.txHash}`,
						});
					}
					subscription.unsubscribe();
				}
			},
			error: (err) => {
				reject(err);
			},
		});
	});
};

/**
 * Leg B — Bittensor EVM → Bittensor substrate.
 * Calls the BalanceTransfer precompile with the destination ss58's raw
 * public key; msg.value in 18-dec EVM units.
 */
export const executeEvmToSubstrate = async ({
	walletClient,
	destinationSs58,
	amountWei,
	onPhase,
}: {
	walletClient: WalletClient;
	destinationSs58: string;
	amountWei: bigint;
	onPhase: OnPhase;
}): Promise<ExecutionResult> => {
	const account = walletClient.account;
	if (!account) throw new Error("Wallet client has no account");

	const chainId = await walletClient.getChainId();
	if (chainId !== bittensorEvm.id) {
		onPhase("switching-chain");
		try {
			await walletClient.switchChain({ id: bittensorEvm.id });
		} catch {
			// 4902: unknown chain — register it, wallets switch on add
			await walletClient.addChain({ chain: bittensorEvm });
		}
	}

	const pubkey = toHex(ss58ToPublicKey(destinationSs58), { size: 32 });

	onPhase("signing");
	const txHash = await walletClient.sendTransaction({
		account,
		chain: bittensorEvm,
		to: BALANCE_TRANSFER_PRECOMPILE,
		value: amountWei,
		data: encodeFunctionData({
			abi: balanceTransferAbi,
			functionName: "transfer",
			args: [pubkey],
		}),
	});

	onPhase("broadcasting");
	// Poll the receipt through the wallet's own provider first: the public
	// lite RPC rate-limits at 25 req/min, which receipt polling can exhaust.
	let receipt: TransactionReceipt;
	try {
		receipt = await walletClient
			.extend(publicActions)
			.waitForTransactionReceipt({ hash: txHash, pollingInterval: 4_000 });
	} catch {
		receipt = await getEvmPublicClient(
			"bittensorEvm",
		).waitForTransactionReceipt({
			hash: txHash,
			pollingInterval: 10_000,
			retryCount: 5,
			timeout: 120_000,
		});
	}

	if (receipt.status !== "success")
		throw new Error(`Transaction reverted: ${txHash}`);

	onPhase("finalized");
	return {
		txHash,
		explorerUrl: `https://evm.taostats.io/tx/${txHash}`,
	};
};
