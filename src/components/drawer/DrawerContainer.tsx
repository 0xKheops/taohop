import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DrawerContainer: FC<{
	title: ReactNode;
	className?: string;
	headerClassName?: string;
	contentClassName?: string;
	children: ReactNode;
	onClose?: () => void;
}> = ({
	title,
	className,
	headerClassName,
	contentClassName,
	children,
	onClose,
}) => {
	return (
		<div
			className={cn(
				"flex h-full w-96 max-w-full flex-col bg-background text-foreground",
				className,
			)}
		>
			<div
				className={cn(
					"flex h-12 shrink-0 items-center justify-between border-b px-4",
					headerClassName,
				)}
			>
				<Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
				{onClose && (
					<Dialog.Close
						aria-label="Close"
						className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						<X className="size-5" />
					</Dialog.Close>
				)}
			</div>
			<div
				className={cn(
					"flex grow flex-col gap-4 overflow-y-auto overflow-x-hidden p-4",
					contentClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
};
