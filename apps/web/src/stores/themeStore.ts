import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "default" | "retro-futuristic";

interface ThemeStore {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
	persist(
		(set) => ({
			theme: "default",
			setTheme: (theme) => set({ theme }),
		}),
		{
			name: "theme-storage",
		},
	),
);
