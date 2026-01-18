import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/404")({
	component: NotFound,
});

function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center h-96">
			<h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
			<p className="text-xl text-gray-600 mb-8">Page not found</p>
			<Link to="/">
				<Button>Go to Homepage</Button>
			</Link>
		</div>
	);
}
