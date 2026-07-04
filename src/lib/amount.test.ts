import { describe, expect, it } from "vitest";
import { convertDecimals, formatAmount, hasDust, parseAmount } from "./amount";

describe("parseAmount", () => {
	it("parses integers and decimals", () => {
		expect(parseAmount("1", 9)).toBe(1_000_000_000n);
		expect(parseAmount("1.5", 9)).toBe(1_500_000_000n);
		expect(parseAmount("0.000000001", 9)).toBe(1n);
		expect(parseAmount(".5", 9)).toBe(500_000_000n);
		expect(parseAmount("1.", 9)).toBe(1_000_000_000n);
	});

	it("rejects invalid input", () => {
		expect(parseAmount("", 9)).toBeNull();
		expect(parseAmount("abc", 9)).toBeNull();
		expect(parseAmount("1,5", 9)).toBeNull();
		expect(parseAmount("-1", 9)).toBeNull();
		expect(parseAmount("1.5.5", 9)).toBeNull();
	});

	it("rejects precision beyond decimals", () => {
		expect(parseAmount("0.0000000001", 9)).toBeNull();
		expect(parseAmount("0.0000000001", 10)).toBe(1n);
	});
});

describe("formatAmount", () => {
	it("formats and trims trailing zeros", () => {
		expect(formatAmount(1_500_000_000n, 9)).toBe("1.5");
		expect(formatAmount(1_000_000_000n, 9)).toBe("1");
		expect(formatAmount(1n, 9)).toBe("0.000000001");
		expect(formatAmount(0n, 9)).toBe("0");
	});

	it("caps displayed decimals", () => {
		expect(formatAmount(1_123_456_789n, 9, 4)).toBe("1.1234");
	});

	it("round-trips with parseAmount", () => {
		const value = 123_456_789_012n;
		expect(parseAmount(formatAmount(value, 9), 9)).toBe(value);
	});
});

describe("convertDecimals", () => {
	it("scales up 9 → 18 (substrate → EVM)", () => {
		expect(convertDecimals(1_000_000_000n, 9, 18)).toBe(10n ** 18n);
	});

	it("scales down 18 → 9, flooring", () => {
		expect(convertDecimals(10n ** 18n, 18, 9)).toBe(1_000_000_000n);
		expect(convertDecimals(10n ** 18n + 999_999_999n, 18, 9)).toBe(
			1_000_000_000n,
		);
	});

	it("no-op on equal decimals", () => {
		expect(convertDecimals(42n, 9, 9)).toBe(42n);
	});
});

describe("hasDust", () => {
	it("detects sub-rao dust in 18-dec amounts", () => {
		expect(hasDust(10n ** 18n, 18, 9)).toBe(false);
		expect(hasDust(10n ** 18n + 1n, 18, 9)).toBe(true);
	});

	it("never dusts when scaling up", () => {
		expect(hasDust(123n, 9, 18)).toBe(false);
	});
});
