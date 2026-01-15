import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<div className="flex h-screen items-center justify-center">
			<h1 className="text-4xl font-bold">Trend Monitor - Coming Soon</h1>
		</div>
	);
}
