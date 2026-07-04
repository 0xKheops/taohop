import { describe, expect, it } from "vitest";
import {
	evmToBittensorMirror,
	isValidAddress,
	shortenAddress,
	ss58ToPublicKey,
} from "./address";

const EVM_ADDRESS = "0xe9f6D9898f9269B519E1435E6ebafF766c7f46BF";
const SS58_ADDRESS = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"; // Alice
const SOLANA_ADDRESS = "taoC6xyv2v8tDLcev4uaGUgV4vdQsWJrGft2kcBRrBY";

describe("isValidAddress", () => {
	it("validates per platform", () => {
		expect(isValidAddress("ethereum", EVM_ADDRESS)).toBe(true);
		expect(isValidAddress("polkadot", SS58_ADDRESS)).toBe(true);
		expect(isValidAddress("solana", SOLANA_ADDRESS)).toBe(true);
	});

	it("rejects cross-platform addresses", () => {
		expect(isValidAddress("ethereum", SS58_ADDRESS)).toBe(false);
		expect(isValidAddress("polkadot", EVM_ADDRESS)).toBe(false);
		expect(isValidAddress("solana", EVM_ADDRESS)).toBe(false);
		expect(isValidAddress("polkadot", "not-an-address")).toBe(false);
	});
});

describe("evmToBittensorMirror", () => {
	it("derives a valid, deterministic ss58 mirror", () => {
		const mirror = evmToBittensorMirror(EVM_ADDRESS);
		expect(isValidAddress("polkadot", mirror)).toBe(true);
		expect(evmToBittensorMirror(EVM_ADDRESS)).toBe(mirror);
	});

	it("derives different mirrors for different addresses", () => {
		const other = evmToBittensorMirror(
			"0x0000000000000000000000000000000000000001",
		);
		expect(other).not.toBe(evmToBittensorMirror(EVM_ADDRESS));
	});

	it("is case-insensitive on the H160 hex", () => {
		expect(
			evmToBittensorMirror(EVM_ADDRESS.toLowerCase() as `0x${string}`),
		).toBe(evmToBittensorMirror(EVM_ADDRESS));
	});
});

describe("ss58ToPublicKey", () => {
	it("returns 32 bytes", () => {
		expect(ss58ToPublicKey(SS58_ADDRESS)).toHaveLength(32);
	});

	it("throws on invalid input", () => {
		expect(() => ss58ToPublicKey("garbage")).toThrow();
	});
});

describe("shortenAddress", () => {
	it("shortens evm and ss58 addresses", () => {
		expect(shortenAddress(EVM_ADDRESS)).toBe("0xe9f6…7f46BF");
		const short = shortenAddress(SS58_ADDRESS);
		expect(short).toBe(`${SS58_ADDRESS.slice(0, 8)}…${SS58_ADDRESS.slice(-8)}`);
		expect(short.length).toBeLessThan(SS58_ADDRESS.length);
	});
});
