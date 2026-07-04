import { TalismanOrb } from "@talismn/orb";
import type { FC } from "react";
import { isAddress as isEvmAddress } from "viem";
import { EthereumIdenticon } from "@/components/identicons/EthereumIdenticon";
import { PolkadotIdenticon } from "@/components/identicons/PolkadotIdenticon";
import type { WalletAccount } from "@/lib/kheopskit";
import { cn } from "@/lib/utils";

export const AccountIcon: FC<{
	account: WalletAccount;
	className?: string;
}> = ({ account, className }) => {
	// Talisman renders its own orb identicon — match what users see in-wallet.
	// Solana has no canonical identicon convention; the orb works on any seed.
	if (account.walletId.includes("talisman") || account.platform === "solana") {
		return (
			<TalismanOrb
				seed={account.address}
				className={cn("rounded-full", className)}
			/>
		);
	}

	if (account.platform === "polkadot" && !isEvmAddress(account.address)) {
		return (
			<PolkadotIdenticon
				address={account.address}
				className={cn("size-full", className)}
			/>
		);
	}

	return (
		<EthereumIdenticon
			address={account.address}
			className={cn("size-full", className)}
		/>
	);
};
