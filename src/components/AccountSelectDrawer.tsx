import { ChevronRight } from "lucide-react";
import { type FC, memo, useCallback, useMemo, useState } from "react";
import { AccountIcon } from "@/components/AccountIcon";
import { Drawer } from "@/components/drawer/Drawer";
import { DrawerContainer } from "@/components/drawer/DrawerContainer";
import { WalletIcon } from "@/components/WalletIcon";
import type { Platform } from "@/config/chains";
import { isValidAddress, shortenAddress } from "@/lib/address";
import {
	isInjectedWallet,
	useWallets,
	type Wallet,
	type WalletAccount,
} from "@/lib/kheopskit";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<Platform, string> = {
	polkadot: "Polkadot",
	ethereum: "Ethereum",
	solana: "Solana",
};

const getAccountName = (account: WalletAccount): string | undefined =>
	"name" in account && typeof account.name === "string"
		? account.name
		: undefined;

const WalletButton: FC<{
	wallet: Wallet;
	onClick: () => void;
}> = ({ wallet, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		className={cn(
			"flex w-full items-center justify-between gap-3 rounded-md border p-2 px-4 text-left transition-colors",
			wallet.isConnected
				? "border-green-600/60 hover:bg-green-500/10"
				: "hover:bg-accent",
		)}
	>
		<div className="size-8 shrink-0">
			<WalletIcon walletId={wallet.id} className="size-8" />
		</div>
		<div className="grow text-left">
			{wallet.name}
			<span className="ml-1 text-xs text-muted-foreground">
				({PLATFORM_LABELS[wallet.platform as Platform] ?? wallet.platform})
			</span>
		</div>
		<div
			className={cn(
				"size-2 shrink-0 rounded-full",
				wallet.isConnected ? "bg-green-500" : "bg-red-500",
			)}
		/>
	</button>
);

const AccountButton = memo<{
	account: WalletAccount;
	selected?: boolean;
	disabled?: boolean;
	onSelect: (accountId: string) => void;
}>(({ account, selected, disabled, onSelect }) => {
	const handleClick = useCallback(() => {
		onSelect(account.id);
	}, [onSelect, account.id]);

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled}
			className={cn(
				"flex w-full items-center gap-4 overflow-hidden rounded-md border p-2 pr-3 pl-4 text-left transition-colors",
				"hover:bg-accent disabled:pointer-events-none",
				selected && "ring-1 ring-ring",
			)}
		>
			<AccountIcon account={account} className="size-8 shrink-0" />
			<div className="flex grow flex-col items-start justify-center overflow-hidden">
				<div className="flex w-full items-center gap-2 overflow-hidden">
					<div className="truncate">
						{getAccountName(account) ?? shortenAddress(account.address)}
					</div>
					<div className="inline-block size-4 shrink-0">
						<WalletIcon walletId={account.walletId} className="size-4" />
					</div>
				</div>
				<div className="truncate text-xs text-muted-foreground">
					{shortenAddress(account.address)}
				</div>
			</div>
			{!disabled && (
				<ChevronRight className="size-5 shrink-0 text-muted-foreground" />
			)}
		</button>
	);
});
AccountButton.displayName = "AccountButton";

const AddressInput: FC<{
	platform?: Platform;
	defaultValue: string;
	onChange: (address: string) => void;
}> = ({ platform, defaultValue, onChange }) => {
	const [localAddress, setLocalAddress] = useState(defaultValue);

	const isValid = useMemo(
		() =>
			platform
				? isValidAddress(platform, localAddress)
				: (["polkadot", "ethereum", "solana"] as const).some((p) =>
						isValidAddress(p, localAddress),
					),
		[platform, localAddress],
	);

	const handleClick = useCallback(() => {
		onChange(localAddress);
	}, [localAddress, onChange]);

	return (
		<div
			className={cn(
				"flex h-10 w-full items-center overflow-hidden rounded-md border bg-background",
				"focus-within:ring-2 focus-within:ring-ring",
				localAddress && !isValid && "border-destructive",
			)}
		>
			<input
				type="text"
				defaultValue={localAddress}
				onChange={(e) => setLocalAddress(e.target.value)}
				autoComplete="off"
				spellCheck={false}
				placeholder={
					platform ? `${PLATFORM_LABELS[platform]} address` : "Address"
				}
				className="grow bg-transparent px-3 text-sm outline-none"
			/>
			<button
				type="button"
				onClick={handleClick}
				disabled={!isValid}
				aria-label="Use address"
				className={cn(
					"h-full border-l px-3 transition-colors",
					isValid
						? "bg-secondary hover:bg-accent"
						: "bg-muted text-muted-foreground",
				)}
			>
				<ChevronRight className="size-5 shrink-0" />
			</button>
		</div>
	);
};

const AccountSelectDrawerContent: FC<{
	title?: string;
	idOrAddress?: string | null;
	ownedOnly?: boolean;
	platform?: Platform;
	onClose: () => void;
	onChange?: (accountIdOrAddress: string) => void;
}> = ({ title, idOrAddress, ownedOnly, platform, onClose, onChange }) => {
	const { wallets, accounts } = useWallets();

	const filteredWallets = useMemo(() => {
		const injected = wallets.filter(isInjectedWallet);
		return platform
			? injected.filter((w) => w.platform === platform)
			: injected;
	}, [wallets, platform]);

	const filteredAccounts = useMemo(
		() =>
			platform ? accounts.filter((a) => a.platform === platform) : accounts,
		[accounts, platform],
	);

	const handleWalletClick = useCallback(
		(wallet: Wallet) => async () => {
			try {
				if (wallet.isConnected) await wallet.disconnect();
				else await wallet.connect();
			} catch (err) {
				console.error("Failed to toggle wallet connection", wallet.id, err);
			}
		},
		[],
	);

	const handleAccountSelect = useCallback(
		(id: string) => {
			onChange?.(id);
		},
		[onChange],
	);

	const address =
		idOrAddress &&
		(["polkadot", "ethereum", "solana"] as const).some((p) =>
			isValidAddress(p, idOrAddress),
		)
			? idOrAddress
			: "";

	return (
		<DrawerContainer
			title={
				title ?? (filteredAccounts.length ? "Select account" : "Connect wallet")
			}
			onClose={onClose}
		>
			{!ownedOnly && onChange && (
				<div>
					<h4 className="mb-1 text-sm font-medium text-muted-foreground">
						Address
					</h4>
					<AddressInput
						platform={platform}
						defaultValue={address}
						onChange={onChange}
					/>
				</div>
			)}
			<div>
				<h4 className="mb-1 text-sm font-medium text-muted-foreground">
					Installed wallets
				</h4>
				{filteredWallets.length ? (
					<ul className="flex flex-col gap-2">
						{filteredWallets.map((wallet) => (
							<li key={wallet.id}>
								<WalletButton
									wallet={wallet}
									onClick={handleWalletClick(wallet)}
								/>
							</li>
						))}
					</ul>
				) : (
					<div className="text-sm text-muted-foreground">No wallets found</div>
				)}
			</div>
			{!!filteredAccounts.length && (
				<div>
					<h4 className="mb-1 text-sm font-medium text-muted-foreground">
						Connected accounts
					</h4>
					<div className="flex flex-col gap-2">
						{filteredAccounts.map((account) => (
							<AccountButton
								key={account.id}
								account={account}
								selected={account.id === idOrAddress}
								onSelect={handleAccountSelect}
								disabled={!onChange}
							/>
						))}
					</div>
				</div>
			)}
		</DrawerContainer>
	);
};

export const AccountSelectDrawer: FC<{
	title?: string;
	isOpen: boolean;
	ownedOnly?: boolean;
	platform?: Platform;
	idOrAddress?: string | null | undefined;
	onDismiss: () => void;
	onChange?: (idOrAddress: string) => void;
}> = ({
	title,
	isOpen,
	idOrAddress,
	platform,
	ownedOnly,
	onChange,
	onDismiss,
}) => {
	return (
		<Drawer anchor="right" isOpen={isOpen} onDismiss={onDismiss}>
			<AccountSelectDrawerContent
				title={title}
				ownedOnly={ownedOnly}
				platform={platform}
				idOrAddress={idOrAddress}
				onClose={onDismiss}
				onChange={onChange}
			/>
		</Drawer>
	);
};
