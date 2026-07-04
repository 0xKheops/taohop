import { describe, expect, it } from "vitest";
import { resolveAccountSelection } from "./accountPreselect";

const accounts = [
	{ id: "eth-1", platform: "ethereum" },
	{ id: "eth-2", platform: "ethereum" },
	{ id: "dot-1", platform: "polkadot" },
] as const;

describe("resolveAccountSelection", () => {
	it("keeps a current selection that is still connected", () => {
		const current = { kind: "account", accountId: "eth-2" } as const;
		expect(
			resolveAccountSelection(current, "ethereum", accounts, false, "eth-1"),
		).toBe(current);
	});

	it("drops a selection whose account disconnected", () => {
		const current = { kind: "account", accountId: "eth-gone" } as const;
		expect(
			resolveAccountSelection(current, "ethereum", accounts, false, null),
		).toEqual({ kind: "account", accountId: "eth-1" });
	});

	it("prefers the last used account when still connected", () => {
		expect(
			resolveAccountSelection(null, "ethereum", accounts, false, "eth-2"),
		).toEqual({ kind: "account", accountId: "eth-2" });
	});

	it("falls back to the first account when last used is gone", () => {
		expect(
			resolveAccountSelection(null, "ethereum", accounts, false, "eth-gone"),
		).toEqual({ kind: "account", accountId: "eth-1" });
	});

	it("returns null when no account matches the platform", () => {
		expect(resolveAccountSelection(null, "solana", accounts, false, null)).toBe(
			null,
		);
	});

	it("keeps a valid pasted address when allowed", () => {
		const current = {
			kind: "address",
			address: "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF",
		} as const;
		expect(
			resolveAccountSelection(current, "ethereum", accounts, true, "eth-1"),
		).toBe(current);
	});

	it("replaces an address that is invalid for the platform", () => {
		const current = {
			kind: "address",
			address: "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF",
		} as const;
		expect(
			resolveAccountSelection(current, "polkadot", accounts, true, null),
		).toEqual({ kind: "account", accountId: "dot-1" });
	});

	it("ignores addresses when not allowed (source picker)", () => {
		const current = {
			kind: "address",
			address: "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF",
		} as const;
		expect(
			resolveAccountSelection(current, "ethereum", accounts, false, null),
		).toEqual({ kind: "account", accountId: "eth-1" });
	});
});
