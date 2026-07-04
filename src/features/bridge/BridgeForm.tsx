import { ArrowDownUp, ExternalLink, LoaderCircle } from "lucide-react";
import { type FC, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CHAINS } from "@/config/chains";
import { getToken, type TokenId } from "@/config/tokens";
import { evmToBittensorMirror, shortenAddress } from "@/lib/address";
import { formatAmount, parseAmount } from "@/lib/amount";
import { useWallets } from "@/lib/kheopskit";
import { getRoute } from "@/lib/routes/engine";
import {
	AccountField,
	type AccountSelection,
	useSelectionAddress,
} from "./AccountField";
import type { ExecutionPhase } from "./executors/native";
import { estimateEvmFee, estimateSubstrateFee } from "./executors/native";
import { TokenSelect } from "./TokenSelect";
import { useBridgeExecutor } from "./useBridgeExecutor";
import { useTokenBalance } from "./useTokenBalance";

const PHASE_LABELS: Record<ExecutionPhase, string> = {
	"switching-chain": "Switching network…",
	signing: "Waiting for signature…",
	broadcasting: "Broadcasting…",
	"in-block": "In block…",
	finalized: "Finalizing…",
};

/** TAO amounts are capped at 9 decimals everywhere so the substrate side never loses dust. */
const uiDecimals = (tokenId: TokenId) => {
	const token = getToken(tokenId);
	return token.symbol === "TAO" ? 9 : token.decimals;
};

export const BridgeForm: FC<{
	from: TokenId;
	to: TokenId;
	amount: string;
	onParamsChange: (params: {
		from: TokenId;
		to: TokenId;
		amount: string;
	}) => void;
}> = ({ from, to, amount, onParamsChange }) => {
	const fromToken = getToken(from);
	const toToken = getToken(to);
	const fromPlatform = CHAINS[fromToken.chainId].platform;
	const toPlatform = CHAINS[toToken.chainId].platform;

	const { accounts } = useWallets();
	const [fromSelection, setFromSelection] = useState<AccountSelection>(null);
	const [destSelection, setDestSelection] = useState<AccountSelection>(null);

	const fromAddress = useSelectionAddress(fromSelection);
	const destAddress = useSelectionAddress(destSelection);

	const fromAccount = useMemo(
		() =>
			fromSelection?.kind === "account"
				? accounts.find(
						(a) =>
							a.id === fromSelection.accountId && a.platform === fromPlatform,
					)
				: undefined,
		[fromSelection, accounts, fromPlatform],
	);

	const route = useMemo(() => getRoute(from, to), [from, to]);
	const { data: balance } = useTokenBalance(fromToken, fromAddress);
	const { data: destBalance } = useTokenBalance(toToken, destAddress);

	const decimals = uiDecimals(from);
	const parsed = amount ? parseAmount(amount, decimals) : null;
	// scale UI amount (TAO=9dp) up to the token's on-chain decimals
	const amountBase =
		parsed !== null
			? parsed * 10n ** BigInt(fromToken.decimals - decimals)
			: null;

	const insufficient =
		amountBase !== null && balance != null && amountBase > balance;

	const { status, execute, reset } = useBridgeExecutor();
	const isRunning = status.state === "running";

	const handleSwap = useCallback(() => {
		onParamsChange({ from: to, to: from, amount });
		// destination may be a raw address — only accounts can sign, so it
		// can't become the source; the old source always works as destination
		setFromSelection(destSelection?.kind === "account" ? destSelection : null);
		setDestSelection(fromSelection);
		reset();
	}, [from, to, amount, fromSelection, destSelection, onParamsChange, reset]);

	const handleMax = useCallback(async () => {
		if (!fromAddress || balance == null) return;
		let fee = 0n;
		try {
			if (fromToken.chainId === "bittensor")
				fee = await estimateSubstrateFee(fromAddress);
			else if (fromToken.chainId === "bittensorEvm")
				fee = await estimateEvmFee(fromAddress as `0x${string}`);
		} catch {
			// fall through with fee = 0, user can still adjust manually
		}
		const max = balance - fee * 2n;
		onParamsChange({
			from,
			to,
			amount: max > 0n ? formatAmount(max, fromToken.decimals, decimals) : "0",
		});
	}, [fromAddress, balance, fromToken, from, to, decimals, onParamsChange]);

	const handleExecute = useCallback(() => {
		if (!route.ok || !fromAccount || !destAddress || !amountBase) return;
		const step = route.steps[0];
		if (!step) return;
		if (
			fromAccount.platform !== "polkadot" &&
			fromAccount.platform !== "ethereum"
		)
			return;
		execute({
			step,
			fromAccount,
			destinationAddress: destAddress,
			amount: amountBase,
		});
	}, [route, fromAccount, destAddress, amountBase, execute]);

	const canExecute =
		route.ok &&
		!!fromAccount &&
		!!destAddress &&
		!!amountBase &&
		amountBase > 0n &&
		!insufficient &&
		!isRunning;

	const mirrorInfo =
		route.ok &&
		route.steps[0]?.kind === "native-substrate-to-evm" &&
		destAddress
			? evmToBittensorMirror(destAddress as `0x${string}`)
			: null;

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Bridge</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<div className="text-sm font-medium text-muted-foreground">From</div>
					<TokenSelect
						value={from}
						aria-label="Source token"
						onChange={(value) => {
							onParamsChange({ from: value, to, amount });
							setFromSelection(null);
							reset();
						}}
					/>
					<AccountField
						label="Select source account"
						platform={fromPlatform}
						selection={fromSelection}
						onChange={setFromSelection}
						ownedOnly
					/>
					<div className="flex items-center gap-2">
						<Input
							inputMode="decimal"
							placeholder="0.0"
							value={amount}
							aria-label="Amount"
							aria-invalid={(!!amount && parsed === null) || insufficient}
							onChange={(e) =>
								onParamsChange({ from, to, amount: e.target.value })
							}
						/>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleMax}
							disabled={!fromAddress || balance == null}
						>
							Max
						</Button>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>
							{amount && parsed === null
								? `Invalid amount (max ${decimals} decimals)`
								: insufficient
									? "Insufficient balance"
									: ""}
						</span>
						<span>
							{fromAddress && balance != null
								? `Balance: ${formatAmount(balance, fromToken.decimals, 6)} ${fromToken.symbol}`
								: ""}
						</span>
					</div>
				</div>

				<div className="flex justify-center">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleSwap}
						aria-label="Swap direction"
					>
						<ArrowDownUp className="size-4" />
					</Button>
				</div>

				<div className="flex flex-col gap-2">
					<div className="text-sm font-medium text-muted-foreground">To</div>
					<TokenSelect
						value={to}
						aria-label="Destination token"
						onChange={(value) => {
							onParamsChange({ from, to: value, amount });
							setDestSelection(null);
							reset();
						}}
					/>
					<AccountField
						label="Select destination"
						platform={toPlatform}
						selection={destSelection}
						onChange={setDestSelection}
					/>
					{destAddress && destBalance != null && (
						<div className="flex justify-end text-xs text-muted-foreground">
							Balance: {formatAmount(destBalance, toToken.decimals, 6)}{" "}
							{toToken.symbol}
						</div>
					)}
				</div>

				{!route.ok && (
					<div
						className={cnRouteMessage(route.reason)}
						role={route.reason === "invalid" ? "alert" : "note"}
					>
						{route.message}
					</div>
				)}

				{route.ok && (
					<div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
						<span className="mr-2 rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
							{route.steps[0]?.rail}
						</span>
						Same-chain transfer — no bridge, no counterparty.
						{mirrorInfo && (
							<div className="mt-1">
								Funds are delivered via the destination's mirror address{" "}
								<span className="font-mono">{shortenAddress(mirrorInfo)}</span>{" "}
								and appear as its EVM balance.
							</div>
						)}
					</div>
				)}

				{status.state === "running" && (
					<div className="flex items-center gap-2 text-sm">
						<LoaderCircle className="size-4 animate-spin" />
						{PHASE_LABELS[status.phase]}
					</div>
				)}
				{status.state === "success" && (
					<div className="flex items-center justify-between rounded-md border border-green-600/50 bg-green-500/10 p-3 text-sm">
						<span>Transfer complete</span>
						<a
							href={status.result.explorerUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 underline"
						>
							View <ExternalLink className="size-3.5" />
						</a>
					</div>
				)}
				{status.state === "error" && (
					<div className="break-words rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
						{status.message}
					</div>
				)}

				<Button
					className="w-full"
					disabled={
						status.state !== "success" &&
						status.state !== "error" &&
						!canExecute
					}
					onClick={
						status.state === "success" || status.state === "error"
							? reset
							: handleExecute
					}
				>
					{status.state === "success" || status.state === "error"
						? "New transfer"
						: status.state === "running"
							? PHASE_LABELS[status.phase]
							: "Transfer"}
				</Button>
			</CardContent>
		</Card>
	);
};

const cnRouteMessage = (reason: "unsupported" | "planned" | "invalid") =>
	reason === "planned"
		? "rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
		: "rounded-md border bg-muted p-3 text-sm text-muted-foreground";
