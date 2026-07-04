import type { Platform } from "@/config/chains";
import { isValidAddress } from "@/lib/address";
import type { WalletAccount } from "@/lib/kheopskit";
import type { AccountSelection } from "./AccountField";

const storageKey = (platform: Platform) => `taohop:lastAccount:${platform}`;

export const rememberAccount = (platform: Platform, accountId: string) => {
	try {
		localStorage.setItem(storageKey(platform), accountId);
	} catch {
		// storage full/unavailable — preselection is best-effort
	}
};

const getRememberedAccount = (platform: Platform): string | null => {
	try {
		return localStorage.getItem(storageKey(platform));
	} catch {
		return null;
	}
};

/**
 * Best-matching selection for a platform: keep the current one when it is
 * still valid, otherwise the last account used on that platform (if still
 * connected), otherwise the first connected account. Never selects an
 * account that isn't in the live accounts list — wallets get disconnected
 * between actions.
 */
export const resolveAccountSelection = (
	current: AccountSelection,
	platform: Platform,
	accounts: readonly Pick<WalletAccount, "id" | "platform">[],
	allowAddress: boolean,
	lastUsedId: string | null = getRememberedAccount(platform),
): AccountSelection => {
	const platformAccounts = accounts.filter((a) => a.platform === platform);

	if (
		current?.kind === "account" &&
		platformAccounts.some((a) => a.id === current.accountId)
	)
		return current;
	if (
		allowAddress &&
		current?.kind === "address" &&
		isValidAddress(platform, current.address)
	)
		return current;

	const candidate =
		(lastUsedId && platformAccounts.find((a) => a.id === lastUsedId)) ||
		platformAccounts[0];
	return candidate ? { kind: "account", accountId: candidate.id } : null;
};
