import { describe, expect, it } from "vitest";
import { getRoute } from "./engine";

describe("getRoute", () => {
	it("resolves the substrate → EVM native leg", () => {
		const result = getRoute("bittensor:TAO", "bittensorEvm:TAO");
		expect(result).toEqual({
			ok: true,
			steps: [
				{
					kind: "native-substrate-to-evm",
					from: "bittensor:TAO",
					to: "bittensorEvm:TAO",
					rail: "Native",
				},
			],
		});
	});

	it("resolves the EVM → substrate native leg", () => {
		const result = getRoute("bittensorEvm:TAO", "bittensor:TAO");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.steps).toHaveLength(1);
			expect(result.steps[0]?.kind).toBe("native-evm-to-substrate");
		}
	});

	it("rejects same source and destination", () => {
		const result = getRoute("bittensor:TAO", "bittensor:TAO");
		expect(result).toMatchObject({ ok: false, reason: "invalid" });
	});

	it("rejects token conversions", () => {
		const result = getRoute("bittensor:TAO", "ethereum:vTAO");
		expect(result).toMatchObject({ ok: false, reason: "unsupported" });
	});

	it("marks Solana TAO routes as planned", () => {
		expect(getRoute("bittensor:TAO", "solana:TAO")).toMatchObject({
			ok: false,
			reason: "planned",
		});
		expect(getRoute("solana:TAO", "bittensorEvm:TAO")).toMatchObject({
			ok: false,
			reason: "planned",
		});
	});

	it("resolves vTAO OFT routes between LayerZero chains", () => {
		for (const [from, to] of [
			["ethereum:vTAO", "base:vTAO"],
			["base:vTAO", "ethereum:vTAO"],
			["bittensorEvm:vTAO", "ethereum:vTAO"],
			["bittensorEvm:vTAO", "base:vTAO"],
			["ethereum:vTAO", "bittensorEvm:vTAO"],
		] as const) {
			expect(getRoute(from, to)).toEqual({
				ok: true,
				steps: [{ kind: "layerzero-oft", from, to, rail: "LayerZero" }],
			});
		}
	});

	it("rejects TAO ↔ vTAO conversion on the same chain", () => {
		expect(getRoute("bittensorEvm:TAO", "bittensorEvm:vTAO")).toMatchObject({
			ok: false,
			reason: "unsupported",
		});
	});
});
