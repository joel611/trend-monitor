import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-gray-50">
					<div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
						<h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
						<p className="text-gray-600 mb-4">
							{this.state.error?.message || "An unexpected error occurred"}
						</p>
						<Button onClick={() => window.location.reload()}>Reload Page</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
