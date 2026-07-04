import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Non-Solana chain SDKs barrel-imported by @layerzerolabs/lz-utilities —
// unreachable at runtime for our Solana OFT sends, stubbed to keep ~10MB
// out of the bundle (see stubs/chain-stub.cjs).
const chainStub = fileURLToPath(
	new URL("./stubs/chain-stub.cjs", import.meta.url),
);

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@initia/initia.js": chainStub,
			"@ton/ton": chainStub,
			"@ton/crypto": chainStub,
			aptos: chainStub,
		},
	},
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		viteReact(),
	],
});

export default config;
