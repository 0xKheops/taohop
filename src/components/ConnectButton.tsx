import { CircleUserRound } from "lucide-react";
import type { FC } from "react";
import { AccountSelectDrawer } from "@/components/AccountSelectDrawer";
import { Button } from "@/components/ui/button";
import { useOpenClose } from "@/hooks/useOpenClose";
import { useWallets } from "@/lib/kheopskit";

export const ConnectButton: FC = () => {
	const { open, close, isOpen } = useOpenClose();
	const { accounts } = useWallets();

	return (
		<>
			<Button
				variant="outline"
				onClick={open}
				aria-label="Connect wallet"
				className="gap-2"
			>
				<CircleUserRound className="size-5" />
				<span className="max-sm:hidden">
					{accounts.length ? `${accounts.length} connected` : "Connect"}
				</span>
			</Button>
			<AccountSelectDrawer
				title="Wallets"
				isOpen={isOpen}
				onDismiss={close}
				ownedOnly
			/>
		</>
	);
};
