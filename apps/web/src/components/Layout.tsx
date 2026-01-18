import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface LayoutProps {
	children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex">
							<Link
								to="/"
								className="flex items-center px-2 text-gray-900 font-semibold text-xl"
							>
								Trend Monitor
							</Link>
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								<Link
									to="/"
									className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900"
									activeProps={{ className: "border-b-2 border-primary-500" }}
								>
									Overview
								</Link>
								<Link
									to="/keywords"
									className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
									activeProps={{ className: "border-b-2 border-primary-500 text-gray-900" }}
								>
									Keywords
								</Link>
							</div>
						</div>
					</div>
				</div>
			</nav>
			<main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
				{children}
			</main>
		</div>
	);
}
