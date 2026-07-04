/**
 * Amount handling: bigint base units everywhere, decimals per context.
 * Substrate TAO = 9 decimals (rao), EVM native TAO = 18, vTAO OFT = 18.
 */

/** Parse user decimal input into base units. Returns null on invalid input. */
export const parseAmount = (input: string, decimals: number): bigint | null => {
	const trimmed = input.trim();
	if (!/^\d+(\.\d*)?$|^\.\d+$/.test(trimmed)) return null;

	const [rawInt = "0", rawFrac = ""] = trimmed.split(".");
	if (rawFrac.length > decimals) return null; // refuse silent precision loss

	const frac = rawFrac.padEnd(decimals, "0");
	try {
		return BigInt(rawInt) * 10n ** BigInt(decimals) + BigInt(frac || "0");
	} catch {
		return null;
	}
};

/** Format base units as a decimal string, trailing zeros trimmed. */
export const formatAmount = (
	value: bigint,
	decimals: number,
	maxDecimals = decimals,
): string => {
	const negative = value < 0n;
	const abs = negative ? -value : value;
	const div = 10n ** BigInt(decimals);
	const int = abs / div;
	const frac = (abs % div).toString().padStart(decimals, "0");
	const truncated = frac.slice(0, maxDecimals).replace(/0+$/, "");
	return `${negative ? "-" : ""}${int}${truncated ? `.${truncated}` : ""}`;
};

/**
 * Convert base units between decimal contexts (e.g. 9-dec rao ↔ 18-dec EVM).
 * Scaling down floors — callers must ensure dust-free amounts when exactness
 * matters (e.g. reject EVM amounts with sub-rao precision before bridging).
 */
export const convertDecimals = (
	value: bigint,
	fromDecimals: number,
	toDecimals: number,
): bigint => {
	if (fromDecimals === toDecimals) return value;
	if (fromDecimals < toDecimals)
		return value * 10n ** BigInt(toDecimals - fromDecimals);
	return value / 10n ** BigInt(fromDecimals - toDecimals);
};

/** True if scaling down would lose precision (sub-unit dust present). */
export const hasDust = (
	value: bigint,
	fromDecimals: number,
	toDecimals: number,
): boolean => {
	if (fromDecimals <= toDecimals) return false;
	return value % 10n ** BigInt(fromDecimals - toDecimals) !== 0n;
};
