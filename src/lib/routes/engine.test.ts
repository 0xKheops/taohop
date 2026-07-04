import { describe, expect, it } from "vitest";
import { getRoute } from "./engine";

describe("getRoute", () => {
	it("resolves the substrate → EVM native leg", () => {
		const result = getRoute("bittensor:TAO", "bittensorEvm:TAO");
		expect(result).toMatchObject({
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

	it("resolves wrap and unwrap on Bittensor EVM", () => {
		expect(getRoute("bittensorEvm:TAO", "bittensorEvm:wTAO")).toMatchObject({
			ok: true,
			steps: [{ kind: "wrap-tao", rail: "Native" }],
		});
		expect(getRoute("bittensorEvm:wTAO", "bittensorEvm:TAO")).toMatchObject({
			ok: true,
			steps: [{ kind: "unwrap-wtao", rail: "Native" }],
		});
	});

	it("resolves wTAO → Solana as a single OFT step", () => {
		expect(getRoute("bittensorEvm:wTAO", "solana:TAO")).toMatchObject({
			ok: true,
			steps: [{ kind: "layerzero-oft", rail: "LayerZero" }],
		});
	});

	it("auto-composes native TAO → Solana as wrap + OFT", () => {
		const result = getRoute("bittensorEvm:TAO", "solana:TAO");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.steps.map((s) => s.kind)).toEqual([
				"wrap-tao",
				"layerzero-oft",
			]);
			expect(result.steps[0]?.to).toBe("bittensorEvm:wTAO");
			expect(result.steps[1]?.from).toBe("bittensorEvm:wTAO");
		}
	});

	it("resolves Solana → Bittensor EVM as a single OFT step to wTAO", () => {
		expect(getRoute("solana:TAO", "bittensorEvm:wTAO")).toMatchObject({
			ok: true,
			steps: [{ kind: "layerzero-oft", rail: "LayerZero" }],
		});
	});

	it("explains that Solana TAO arrives as wTAO for other destinations", () => {
		expect(getRoute("solana:TAO", "bittensorEvm:TAO")).toMatchObject({
			ok: false,
			reason: "unsupported",
		});
		expect(getRoute("solana:TAO", "bittensor:TAO")).toMatchObject({
			ok: false,
			reason: "unsupported",
		});
	});

	it("marks substrate → Solana as unsupported with a workaround hint", () => {
		expect(getRoute("bittensor:TAO", "solana:TAO")).toMatchObject({
			ok: false,
			reason: "unsupported",
			message:
				"Bittensor → Solana requires two signers. Bridge to Bittensor EVM first, then from Bittensor EVM to Solana.",
		});
	});

	it("rejects same source and destination", () => {
		expect(getRoute("bittensor:TAO", "bittensor:TAO")).toMatchObject({
			ok: false,
			reason: "invalid",
		});
	});

	it("rejects cross-asset conversions", () => {
		expect(getRoute("bittensor:TAO", "ethereum:vTAO")).toMatchObject({
			ok: false,
			reason: "unsupported",
		});
		expect(getRoute("bittensorEvm:TAO", "bittensorEvm:vTAO")).toMatchObject({
			ok: false,
			reason: "unsupported",
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
			expect(getRoute(from, to)).toMatchObject({
				ok: true,
				steps: [{ kind: "layerzero-oft", from, to, rail: "LayerZero" }],
			});
		}
	});
});
