import { ChevronDown } from "lucide-react";
import { type FC, useCallback, useMemo } from "react";
import { AccountIcon } from "@/components/AccountIcon";
import { AccountSelectDrawer } from "@/components/AccountSelectDrawer";
import type { Platform } from "@/config/chains";
import { useOpenClose } from "@/hooks/useOpenClose";
import { isValidAddress, shortenAddress } from "@/lib/address";
import { useWallets } from "@/lib/kheopskit";
import { cn } from "@/lib/utils";

export type AccountSelection =
	| { kind: "account"; accountId: string }
	| { kind: "address"; address: string }
	| null;

/** Resolve a selection to its address using the connected accounts list. */
export const useSelectionAddress = (
	selection: AccountSelection,
): string | undefined => {
	const { accounts } = useWallets();
	return useMemo(() => {
		if (!selection) return undefined;
		if (selection.kind === "address") return selection.address;
		return accounts.find((a) => a.id === selection.accountId)?.address;
	}, [selection, accounts]);
};

export const AccountField: FC<{
	label: string;
	platform: Platform;
	selection: AccountSelection;
	onChange: (selection: AccountSelection) => void;
	/** Only allow picking own connected accounts (no raw address input). */
	ownedOnly?: boolean;
}> = ({ label, platform, selection, onChange, ownedOnly }) => {
	const { isOpen, open, close } = useOpenClose();
	const { accounts } = useWallets();

	const selectedAccount = useMemo(
		() =>
			selection?.kind === "account"
				? accounts.find((a) => a.id === selection.accountId)
				: undefined,
		[selection, accounts],
	);

	const handleChange = useCallback(
		(idOrAddress: string) => {
			if (isValidAddress(platform, idOrAddress)) {
				onChange({ kind: "address", address: idOrAddress });
			} else {
				onChange({ kind: "account", accountId: idOrAddress });
			}
			close();
		},
		[platform, onChange, close],
	);

	return (
		<>
			<button
				type="button"
				onClick={open}
				className={cn(
					"flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors",
					"hover:bg-accent",
				)}
			>
				{selectedAccount ? (
					<>
						<AccountIcon
							account={selectedAccount}
							className="size-5 shrink-0"
						/>
						<span className="truncate">
							{"name" in selectedAccount &&
							typeof selectedAccount.name === "string"
								? selectedAccount.name
								: shortenAddress(selectedAccount.address)}
						</span>
						<span className="truncate text-xs text-muted-foreground">
							{shortenAddress(selectedAccount.address)}
						</span>
					</>
				) : selection?.kind === "address" ? (
					<span className="truncate">{shortenAddress(selection.address)}</span>
				) : (
					<span className="text-muted-foreground">{label}</span>
				)}
				<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
			</button>
			<AccountSelectDrawer
				title={label}
				isOpen={isOpen}
				platform={platform}
				ownedOnly={ownedOnly}
				idOrAddress={
					selection?.kind === "account"
						? selection.accountId
						: selection?.kind === "address"
							? selection.address
							: undefined
				}
				onDismiss={close}
				onChange={handleChange}
			/>
		</>
	);
};
