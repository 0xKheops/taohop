import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { CHAINS } from "@/config/chains";
import { getToken, type TokenId } from "@/config/tokens";
import { formatAmount } from "@/lib/amount";
import {
	clearTransferHistory,
	getResumeParams,
	type TransferRecord,
	useTransferHistory,
} from "./history";

const STATUS_STYLES: Record<TransferRecord["status"], string> = {
	running: "bg-secondary text-secondary-foreground",
	success: "bg-green-500/15 text-green-600 dark:text-green-400",
	error: "bg-destructive/15 text-destructive",
};

const STATUS_LABELS: Record<TransferRecord["status"], string> = {
	running: "In progress",
	success: "Complete",
	error: "Failed",
};

const tokenLabel = (tokenId: TokenId) => {
	const token = getToken(tokenId);
	return `${token.symbol} · ${CHAINS[token.chainId].name}`;
};

const formatDate = (timestamp: number) =>
	new Date(timestamp).toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});

const HistoryEntry: FC<{
	record: TransferRecord;
	onResume: (params: { from: TokenId; to: TokenId; amount: string }) => void;
}> = ({ record, onResume }) => {
	const fromToken = getToken(record.fromTokenId);
	const resume = getResumeParams(record);
	const links = record.steps.filter((s) => s.explorerUrl);

	return (
		<div className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
			<div className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate">
					{formatAmount(BigInt(record.amount), fromToken.decimals, 6)}{" "}
					{tokenLabel(record.fromTokenId)} → {tokenLabel(record.toTokenId)}
				</span>
				<span
					className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[record.status]}`}
				>
					{record.status === "running" && (
						<LoaderCircle className="mr-1 inline size-3 animate-spin" />
					)}
					{STATUS_LABELS[record.status]}
				</span>
			</div>
			{record.error && (
				<div className="break-words text-xs text-destructive">
					{record.error}
				</div>
			)}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
				<span>{formatDate(record.createdAt)}</span>
				{links.map((s) => (
					<a
						key={s.kind}
						href={s.explorerUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 underline"
					>
						{s.label} <ExternalLink className="size-3" />
					</a>
				))}
				{resume && (
					<Button
						variant="secondary"
						size="sm"
						className="h-6 px-2 text-xs"
						onClick={() => {
							const token = getToken(resume.from);
							onResume({
								from: resume.from,
								to: resume.to,
								amount: formatAmount(resume.amount, token.decimals, 6),
							});
						}}
					>
						<RotateCcw className="size-3" /> Resume
					</Button>
				)}
			</div>
		</div>
	);
};

export const TransferHistory: FC<{
	onResume: (params: { from: TokenId; to: TokenId; amount: string }) => void;
}> = ({ onResume }) => {
	const history = useTransferHistory();
	if (!history.length) return null;

	return (
		<div className="flex w-full max-w-md flex-col gap-2">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground">History</h2>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 text-xs text-muted-foreground"
					onClick={clearTransferHistory}
				>
					Clear
				</Button>
			</div>
			{history.map((record) => (
				<HistoryEntry key={record.id} record={record} onResume={onResume} />
			))}
		</div>
	);
};
