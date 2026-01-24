import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface LayoutProps {
	children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
	return (
		<div className="flex h-screen">
			{/* Sidebar */}
			<aside className="w-64 border-r border-border bg-sidebar flex flex-col">
				{/* Header */}
				<div className="p-6 border-b border-sidebar-border">
					<h1 className="text-xl font-semibold text-sidebar-foreground">Trend Monitor</h1>
				</div>

				{/* Navigation */}
				<nav className="flex-1 p-4">
					<div className="flex flex-col gap-1">
						<Link
							to="/"
							className="px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
							activeProps={{
								className:
									"bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
							}}
						>
							Overview
						</Link>
						<Link
							to="/keywords"
							className="px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
							activeProps={{
								className:
									"bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
							}}
						>
							Keywords
						</Link>
						<Link
							to="/sources"
							className="px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
							activeProps={{
								className:
									"bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
							}}
						>
							Sources
						</Link>
					</div>
				</nav>

				{/* Footer with Theme Switcher */}
				<div className="p-4 border-t border-sidebar-border">
					<ThemeSwitcher />
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				<div className="flex-1 overflow-auto p-6">{children}</div>
			</main>
		</div>
	);
}
