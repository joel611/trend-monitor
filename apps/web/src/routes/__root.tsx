import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Layout } from "../components/Layout";
import { ThemeApplier } from "../components/ThemeApplier";

export const Route = createRootRoute({
	component: () => (
		<>
			<ThemeApplier />
			<ErrorBoundary>
				<Layout>
					<Outlet />
				</Layout>
        <Toaster />
			</ErrorBoundary>
		</>
	),
});
