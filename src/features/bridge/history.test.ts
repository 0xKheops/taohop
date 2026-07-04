import { describe, expect, it } from "vitest";
import type { RouteStep } from "@/lib/routes/types";
import {
	createTransferRecord,
	getResumeParams,
	markStepSuccess,
	markTransferError,
} from "./history";

const composedSteps: RouteStep[] = [
	{
		kind: "wrap-tao",
		from: "bittensorEvm:TAO",
		to: "bittensorEvm:wTAO",
		label: "Wrap TAO",
		rail: "Native",
	},
	{
		kind: "layerzero-oft",
		from: "bittensorEvm:wTAO",
		to: "solana:TAO",
		label: "Bridge to Solana",
		rail: "LayerZero",
	},
];

const makeRecord = () =>
	createTransferRecord({
		id: "t1",
		createdAt: 1,
		steps: composedSteps,
		fromAddress: "0xaaa",
		destinationAddress: "solAddr",
		amount: 5_000_000_000_000_000n, // 0.005 TAO, 18 dec
	});

describe("createTransferRecord", () => {
	it("captures route endpoints and pending steps", () => {
		const record = makeRecord();
		expect(record.fromTokenId).toBe("bittensorEvm:TAO");
		expect(record.toTokenId).toBe("solana:TAO");
		expect(record.status).toBe("running");
		expect(record.steps.map((s) => s.status)).toEqual(["pending", "pending"]);
	});
});

describe("markStepSuccess / markTransferError", () => {
	it("completes the transfer once every step succeeds", () => {
		let record = makeRecord();
		record = markStepSuccess(record, 0, { txHash: "0x1", explorerUrl: "u1" });
		expect(record.status).toBe("running");
		record = markStepSuccess(record, 1, { txHash: "0x2", explorerUrl: "u2" });
		expect(record.status).toBe("success");
		expect(record.steps[1]?.explorerUrl).toBe("u2");
	});

	it("marks the failing step", () => {
		let record = makeRecord();
		record = markStepSuccess(record, 0, { txHash: "0x1", explorerUrl: "u1" });
		record = markTransferError(record, 1, "boom");
		expect(record.status).toBe("error");
		expect(record.error).toBe("boom");
		expect(record.steps.map((s) => s.status)).toEqual(["success", "error"]);
	});
});

describe("getResumeParams", () => {
	it("resumes from the first unfinished step", () => {
		let record = makeRecord();
		record = markStepSuccess(record, 0, { txHash: "0x1", explorerUrl: "u1" });
		record = markTransferError(record, 1, "boom");
		expect(getResumeParams(record)).toEqual({
			from: "bittensorEvm:wTAO",
			to: "solana:TAO",
			amount: 5_000_000_000_000_000n, // wTAO is 18 dec too — unchanged
		});
	});

	it("returns null when nothing completed (plain retry, not resume)", () => {
		const record = markTransferError(makeRecord(), 0, "boom");
		expect(getResumeParams(record)).toBeNull();
	});

	it("returns null for running or completed transfers", () => {
		expect(getResumeParams(makeRecord())).toBeNull();
		let record = makeRecord();
		record = markStepSuccess(record, 0, { txHash: "0x1", explorerUrl: "u1" });
		record = markStepSuccess(record, 1, { txHash: "0x2", explorerUrl: "u2" });
		expect(getResumeParams(record)).toBeNull();
	});
});
