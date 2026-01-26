import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

interface LayoutProps {
	children: ReactNode;
}

function SidebarContent() {
	return (
		<>
			{/* Navigation */}
			<nav className="flex-1 p-4">
				<div className="flex flex-col gap-1">
					<Link
						to="/"
						className="px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
						activeProps={{
							className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
						}}
					>
						Overview
					</Link>
					<Link
						to="/keywords"
						className="px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
						activeProps={{
							className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
						}}
					>
						Keywords
					</Link>
					<Link
						to="/sources"
						className="px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
						activeProps={{
							className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
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
		</>
	);
}

export function Layout({ children }: LayoutProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<div className="flex h-screen">
			{/* Desktop Sidebar */}
			<aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
				{/* Header */}
				<div className="p-6 border-b border-sidebar-border">
					<h1 className="text-xl font-semibold text-sidebar-foreground">Trend Monitor</h1>
				</div>

				<SidebarContent />
			</aside>

			{/* Mobile Sheet */}
			<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
				<SheetContent side="left" className="w-64 p-0 bg-sidebar">
					<SheetHeader className="p-6 border-b border-sidebar-border">
						<SheetTitle className="text-sidebar-foreground">Trend Monitor</SheetTitle>
					</SheetHeader>
					<div className="flex flex-col h-[calc(100%-5rem)]">
						<SidebarContent />
					</div>
				</SheetContent>
			</Sheet>

			{/* Main Content */}
			<main className="flex-1 flex flex-col overflow-hidden">
				{/* Mobile Header */}
				<div className="md:hidden flex items-center gap-4 p-4 border-b border-border bg-background">
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
						aria-label="Open menu"
					>
						<Menu className="h-6 w-6" />
					</button>
					<h1 className="text-lg font-semibold">Trend Monitor</h1>
				</div>

				<div className="flex-1 overflow-auto p-6">{children}</div>
			</main>
		</div>
	);
}
