import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { ErrorBoundary } from "../components/ErrorBoundary";

export const Route = createRootRoute({
	component: () => (
		<ErrorBoundary>
			<Layout>
				<Outlet />
			</Layout>
		</ErrorBoundary>
	),
});
