/**
 * React Testing Setup with happy-dom
 * Provides a lightweight DOM environment for testing React components
 */

import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register happy-dom as the global DOM implementation
GlobalRegistrator.register();

// Clean up after each test
afterEach(() => {
	document.body.innerHTML = "";
});

// Mock fetch for API calls
global.fetch = async (url: string | URL | Request) => {
	const urlStr = typeof url === "string" ? url : url.toString();

	// Mock /api/keywords endpoint
	if (urlStr.includes("/api/keywords")) {
		return new Response(JSON.stringify({ keywords: [] }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Mock /api/health endpoint
	if (urlStr.includes("/api/health")) {
		return new Response(JSON.stringify({ status: "ok" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Default 404 response
	return new Response(null, { status: 404 });
};
