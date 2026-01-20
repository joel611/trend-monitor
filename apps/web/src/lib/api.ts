import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api-worker/src/index";

const getBaseURL = (): string => {
	// Use environment variable if available, otherwise default to localhost
	return import.meta.env.VITE_API_URL || "http://localhost:8787";
};

// Create Eden Treaty client with type safety from API worker
export const api = treaty<App>(getBaseURL());
