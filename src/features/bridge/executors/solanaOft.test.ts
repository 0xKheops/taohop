import { describe, expect, it } from "vitest";
import { encodeQuoteData, encodeSendData } from "./solanaOft";

const toHexStr = (bytes: Uint8Array) =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const recipient = new Uint8Array(32);
recipient.set(
	Uint8Array.from(
		Buffer.from("5c9eba3b10e45bf6db77267b40b95f3f91fc5f67", "hex"),
	),
	12,
);

// Reference bytes dumped from @layerzerolabs/oft-v2-solana-sdk 3.0.168 for
// dstEid 30374, amountLd 10_000_000, nativeFee 24_823_195 — the layout the
// on-chain program expects. See solanaOftLane.ts for provenance.
describe("encodeSendData", () => {
	it("matches the SDK byte layout", () => {
		const data = encodeSendData({
			dstEid: 30374,
			to: recipient,
			amountLd: 10_000_000n,
			nativeFee: 24_823_195n,
		});
		expect(toHexStr(data)).toBe(
			"66fb14bb414b0c45a67600000000000000000000000000005c9eba3b10e45bf6db77267b40b95f3f91fc5f678096980000000000809698000000000000000000009bc57a01000000000000000000000000",
		);
	});
});

describe("encodeQuoteData", () => {
	it("matches the SDK byte layout", () => {
		const data = encodeQuoteData({
			dstEid: 30374,
			to: recipient,
			amountLd: 10_000_000n,
		});
		expect(toHexStr(data)).toBe(
			"cf0031d6a0d34cd3a67600000000000000000000000000005c9eba3b10e45bf6db77267b40b95f3f91fc5f6780969800000000008096980000000000000000000000",
		);
	});
});
