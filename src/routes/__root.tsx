import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ConnectButton } from "@/components/ConnectButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import "../styles.css";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});

function RootComponent() {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
				<div className="flex items-center gap-2">
					<img src="/favicon.svg" alt="" className="size-6" />
					<span className="text-gradient-brand font-bold text-lg tracking-tight">
						taohop
					</span>
				</div>
				<div className="flex items-center gap-2">
					<ThemeToggle />
					<ConnectButton />
				</div>
			</header>
			<main className="flex grow flex-col items-center px-4 py-6">
				<Outlet />
			</main>
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
					{
						name: "TanStack Query",
						render: <ReactQueryDevtoolsPanel />,
					},
				]}
			/>
		</div>
	);
}
