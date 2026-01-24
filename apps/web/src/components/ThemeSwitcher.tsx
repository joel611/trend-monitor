import { Monitor, Terminal } from "lucide-react";
import { useThemeStore, type Theme } from "../stores/themeStore";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const themes = [
	{ value: "default" as Theme, label: "Default", icon: Monitor },
	{ value: "retro-futuristic" as Theme, label: "Retro-Futuristic", icon: Terminal },
];

export function ThemeSwitcher() {
	const { theme, setTheme } = useThemeStore();

	const currentTheme = themes.find((t) => t.value === theme);
	const CurrentIcon = currentTheme?.icon || Monitor;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors w-full text-left">
				<CurrentIcon className="h-4 w-4" />
				<span className="text-sm">{currentTheme?.label || "Theme"}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{themes.map((t) => (
					<DropdownMenuItem
						key={t.value}
						onClick={() => setTheme(t.value)}
						className="flex items-center gap-2 cursor-pointer"
					>
						<t.icon className="h-4 w-4" />
						<span>{t.label}</span>
						{theme === t.value && <span className="ml-auto text-xs">✓</span>}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
