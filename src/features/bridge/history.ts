import { useSyncExternalStore } from "react";
import { getToken, type TokenId } from "@/config/tokens";
import { convertDecimals } from "@/lib/amount";
import type { RouteStep } from "@/lib/routes/types";
import type { ExecutionResult } from "./executors/native";

type TransferStepRecord = Pick<
	RouteStep,
	"kind" | "from" | "to" | "label" | "rail"
> & {
	status: "pending" | "success" | "error";
	txHash?: string;
	explorerUrl?: string;
};

export type TransferRecord = {
	id: string;
	createdAt: number;
	fromTokenId: TokenId;
	toTokenId: TokenId;
	fromAddress: string;
	destinationAddress: string;
	/** Route input amount in source-token base units (bigint as string). */
	amount: string;
	status: "running" | "success" | "error";
	error?: string;
	steps: TransferStepRecord[];
};

export const createTransferRecord = ({
	id,
	createdAt,
	steps,
	fromAddress,
	destinationAddress,
	amount,
}: {
	id: string;
	createdAt: number;
	steps: RouteStep[];
	fromAddress: string;
	destinationAddress: string;
	amount: bigint;
}): TransferRecord => {
	const first = steps[0];
	const last = steps[steps.length - 1];
	if (!first || !last) throw new Error("Route has no steps");
	return {
		id,
		createdAt,
		fromTokenId: first.from,
		toTokenId: last.to,
		fromAddress,
		destinationAddress,
		amount: amount.toString(),
		status: "running",
		steps: steps.map((s) => ({
			kind: s.kind,
			from: s.from,
			to: s.to,
			label: s.label,
			rail: s.rail,
			status: "pending",
		})),
	};
};

export const markStepSuccess = (
	record: TransferRecord,
	stepIndex: number,
	result: ExecutionResult,
): TransferRecord => {
	const steps = record.steps.map((s, i) =>
		i === stepIndex
			? {
					...s,
					status: "success" as const,
					txHash: result.txHash,
					explorerUrl: result.explorerUrl,
				}
			: s,
	);
	const allDone = steps.every((s) => s.status === "success");
	return { ...record, steps, status: allDone ? "success" : record.status };
};

export const markTransferError = (
	record: TransferRecord,
	stepIndex: number,
	message: string,
): TransferRecord => ({
	...record,
	status: "error",
	error: message,
	steps: record.steps.map((s, i) =>
		i === stepIndex ? { ...s, status: "error" as const } : s,
	),
});

/**
 * A transfer is resumable when it failed after completing at least one step:
 * the remaining legs form a valid standalone route starting from the first
 * unfinished step's source token.
 */
export const getResumeParams = (
	record: TransferRecord,
): { from: TokenId; to: TokenId; amount: bigint } | null => {
	if (record.status !== "error") return null;
	const failedIndex = record.steps.findIndex((s) => s.status !== "success");
	if (failedIndex <= 0) return null;
	const resumeFrom = record.steps[failedIndex];
	if (!resumeFrom) return null;
	return {
		from: resumeFrom.from,
		to: record.toTokenId,
		amount: convertDecimals(
			BigInt(record.amount),
			getToken(record.fromTokenId).decimals,
			getToken(resumeFrom.from).decimals,
		),
	};
};

// --- localStorage-backed store ---------------------------------------------

const STORAGE_KEY = "taohop:history";
const MAX_ENTRIES = 20;

let cache: TransferRecord[] | null = null;
const listeners = new Set<() => void>();

const load = (): TransferRecord[] => {
	try {
		const parsed: unknown = JSON.parse(
			localStorage.getItem(STORAGE_KEY) ?? "[]",
		);
		if (!Array.isArray(parsed)) return [];
		// a freshly loaded page cannot have a transfer in flight — anything
		// still "running" was interrupted by a reload or crash
		return (parsed as TransferRecord[]).map((r) =>
			r.status === "running"
				? { ...r, status: "error" as const, error: "Interrupted" }
				: r,
		);
	} catch {
		return [];
	}
};

const read = (): TransferRecord[] => {
	if (!cache) cache = load();
	return cache;
};

const write = (records: TransferRecord[]) => {
	cache = records.slice(0, MAX_ENTRIES);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
	} catch {
		// storage full or unavailable — keep the in-memory copy
	}
	for (const listener of listeners) listener();
};

export const addTransferRecord = (record: TransferRecord) =>
	write([record, ...read()]);

export const patchTransferRecord = (
	id: string,
	patch: (record: TransferRecord) => TransferRecord,
) => write(read().map((r) => (r.id === id ? patch(r) : r)));

export const clearTransferHistory = () => write([]);

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const useTransferHistory = (): TransferRecord[] =>
	useSyncExternalStore(subscribe, read);
