import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { KheopskitProvider } from "@/lib/kheopskit";
import { getRouter, queryClient } from "./router";

const router = getRouter();

const rootElement = document.getElementById("app");
if (!rootElement) throw new Error("Missing #app root element");

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<ThemeProvider>
			<KheopskitProvider>
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
				</QueryClientProvider>
			</KheopskitProvider>
		</ThemeProvider>,
	);
}
