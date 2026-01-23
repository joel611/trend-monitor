import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Layout } from "../components/Layout";

export const Route = createRootRoute({
	component: () => (
		<ErrorBoundary>
			<Layout>
				<Outlet />
			</Layout>
		</ErrorBoundary>
	),
});
