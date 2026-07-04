# taohop

**Bridge TAO and vTAO across Bittensor, Bittensor EVM, Ethereum, Base and Solana** — live at [taohop.kheops.wtf](https://taohop.kheops.wtf).

taohop is also a reference dapp for **[kheopskit](https://github.com/kheopskit/kheopskit)**: one wallet library connecting **Substrate, Ethereum and Solana wallets** from the same UI, with fully typed signers for each platform. If you want to build a dapp that spans all three ecosystems, this repo shows every wiring point.

## The kheopskit showcase

All wallet connectivity flows through a single ~20-line setup ([src/lib/kheopskit.ts](src/lib/kheopskit.ts)):

```ts
import { ethereum } from "@kheopskit/core/ethereum";
import { polkadot } from "@kheopskit/core/polkadot";
import { solana } from "@kheopskit/core/solana";
import { createKheopskit } from "@kheopskit/react";

const platforms = [polkadot(), ethereum(), solana()] as const;

export const { KheopskitProvider, useWallets } = createKheopskit({
  platforms,
  autoReconnect: true,
});
```

`useWallets()` then returns every injected wallet and connected account across the three platforms, discriminated by `account.platform`. Each account carries a **native signer for its ecosystem's canonical library** — no adapters, no lowest-common-denominator API:

| Platform | Account signer | Pairs with | Used here for |
|---|---|---|---|
| `polkadot` | `account.polkadotSigner` | [polkadot-api](https://papi.how) | Substrate transfers via `signSubmitAndWatch` ([native.ts](src/features/bridge/executors/native.ts)) |
| `ethereum` | `account.client` (viem `WalletClient`) | [viem](https://viem.sh) | EVM precompile calls, wrap/unwrap, LayerZero OFT sends ([layerzeroOft.ts](src/features/bridge/executors/layerzeroOft.ts)) |
| `solana` | `account.signer` (`TransactionSendingSigner`) | [@solana/kit](https://github.com/anza-xyz/kit) | Signing v0 transactions with address lookup tables ([solanaOft.ts](src/features/bridge/executors/solanaOft.ts)) |

Things worth stealing:

- **Platform-filtered account picker** — one drawer component handles wallet connection and account selection for all three platforms, including raw-address destinations with per-platform validation ([AccountSelectDrawer.tsx](src/components/AccountSelectDrawer.tsx))
- **Account preselection** — remember the last used account per platform, revalidate against currently connected accounts ([accountPreselect.ts](src/features/bridge/accountPreselect.ts))
- **Cross-platform execution** — a single executor orchestrates multi-step routes where each step may sign with a different platform's signer ([useBridgeExecutor.ts](src/features/bridge/useBridgeExecutor.ts))
- **Platform-correct identicons** — Polkadot identicons, Ethereum blockies, Talisman orb ([AccountIcon.tsx](src/components/AccountIcon.tsx))

## What it bridges

| Route | Rail |
|---|---|
| Bittensor ↔ Bittensor EVM | Same chain — native transfer to the [EVM mirror address](https://docs.learnbittensor.org/evm-tutorials/) / `BalanceTransfer` precompile |
| Bittensor EVM: TAO ↔ wTAO | WETH-style 1:1 wrap |
| wTAO (Bittensor EVM) ↔ TAO (Solana) | LayerZero V2 OFT |
| vTAO: Bittensor EVM ↔ Ethereum ↔ Base | LayerZero V2 OFT |

Multi-step routes compose automatically (e.g. Bittensor EVM → Solana = wrap + OFT send) with per-step progress, a persistent transfer history, and resume for routes that fail midway.

Decimals are a minefield by design: Substrate TAO is 9 decimals, EVM TAO is 18, Solana TAO is 9, and LayerZero OFTs truncate to 6 shared decimals. All amount handling is bigint-based ([src/lib/amount.ts](src/lib/amount.ts)) and inputs are capped to the route's safe precision.

### Vendored LayerZero Solana lane

The Solana OFT send is built **without the LayerZero SDK** — the instruction templates were dumped once from the SDK, byte-verified against a delivered mainnet transaction, and reimplemented with `@solana/kit` primitives ([solanaOftLane.ts](src/features/bridge/executors/solanaOftLane.ts)). This removed ~300 packages (umi, web3.js v1, node polyfills, BUSL-licensed SDKs) and shrank the lazy chunk from 2.1&nbsp;MB to 8&nbsp;KB. Regeneration procedure: [scripts/dump-oft-lane.mjs](scripts/dump-oft-lane.mjs).

## Stack

- [kheopskit](https://github.com/kheopskit/kheopskit) — multi-platform wallet connectivity
- [polkadot-api](https://papi.how), [viem](https://viem.sh), [@solana/kit](https://github.com/anza-xyz/kit) — one canonical client library per chain
- [TanStack Router / Query](https://tanstack.com) + Vite SPA, form state in the URL
- [Tailwind CSS v4](https://tailwindcss.com) + [Base UI](https://base-ui.com), mobile-first, dark/light
- 100% static — deployed as Cloudflare Workers static assets, no backend, no indexer

## Development

```bash
pnpm install   # postinstall generates polkadot-api descriptors
pnpm dev       # http://localhost:3000
```

Before committing: `pnpm check && pnpm exec tsc --noEmit && pnpm test && pnpm knip`.

Deploys run from CI on push (`wrangler deploy`, config in [wrangler.jsonc](wrangler.jsonc)).

## License

[MIT](LICENSE)
