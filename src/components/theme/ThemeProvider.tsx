import {
	createContext,
	type FC,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "taohop:theme";

const getStoredTheme = (): Theme => {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" ? stored : "system";
};

const resolveTheme = (theme: Theme): "light" | "dark" =>
	theme === "system"
		? window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light"
		: theme;

const applyTheme = (theme: Theme) => {
	document.documentElement.classList.toggle(
		"dark",
		resolveTheme(theme) === "dark",
	);
};

const ThemeContext = createContext<{
	theme: Theme;
	setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
	const [theme, setThemeState] = useState<Theme>(getStoredTheme);

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next);
		if (next === "system") localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, next);
		applyTheme(next);
	}, []);

	useEffect(() => {
		applyTheme(theme);
		if (theme !== "system") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [theme]);

	return (
		<ThemeContext.Provider value={{ theme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};
