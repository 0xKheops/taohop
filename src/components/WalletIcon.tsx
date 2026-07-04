import { Wallet as GenericWalletIcon } from "lucide-react";
import { type FC, useMemo } from "react";
import { useWallets } from "@/lib/kheopskit";
import { cn } from "@/lib/utils";

export const WalletIcon: FC<{
	walletId: string | null | undefined;
	className?: string;
}> = ({ walletId, className }) => {
	const { wallets } = useWallets();

	const icon = useMemo(
		() => wallets.find((w) => w.id === walletId)?.icon,
		[wallets, walletId],
	);

	if (icon) {
		return (
			<img
				src={icon}
				alt=""
				className={cn("shrink-0 object-contain", className)}
			/>
		);
	}

	return (
		<GenericWalletIcon className={cn("shrink-0 stroke-current", className)} />
	);
};
