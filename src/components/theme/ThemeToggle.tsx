import { Moon, Sun } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

export const ThemeToggle: FC = () => {
	const { theme, setTheme } = useTheme();

	const isDark =
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);

	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? <Sun /> : <Moon />}
		</Button>
	);
};
