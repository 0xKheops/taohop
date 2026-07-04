import {
	type AccountOf,
	isInjectedWallet,
	type WalletOf,
} from "@kheopskit/core";
import { ethereum } from "@kheopskit/core/ethereum";
import { polkadot } from "@kheopskit/core/polkadot";
import { solana } from "@kheopskit/core/solana";
import { createKheopskit } from "@kheopskit/react";

const platforms = [polkadot(), ethereum(), solana()] as const;

export const { KheopskitProvider, useWallets } = createKheopskit({
	platforms,
	autoReconnect: true,
});

export type WalletAccount = AccountOf<(typeof platforms)[number]>;
export type Wallet = WalletOf<(typeof platforms)[number]>;

export { isInjectedWallet };
