import { useEffect } from "react";
import { useThemeStore } from "../stores/themeStore";

export function ThemeApplier() {
	const theme = useThemeStore((state) => state.theme);

	useEffect(() => {
		document.documentElement.className = theme;
	}, [theme]);

	return null;
}
