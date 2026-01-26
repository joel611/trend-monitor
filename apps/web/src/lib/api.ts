import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api-worker/src/index";
import type { App as IngestionApp } from "../../../ingestion-feeds/src/index";

const getBaseURL = (): string => {
	// Use environment variable if available, otherwise default to localhost
	return import.meta.env.VITE_API_URL || "http://localhost:8787";
};

const getIngestionURL = (): string => {
	// Use environment variable if available, otherwise default to localhost
	return import.meta.env.VITE_INGESTION_URL || "http://localhost:8792";
};

// Create Eden Treaty client with type safety from API worker
export const apiClient = treaty<App>(getBaseURL());

// Create Eden Treaty client for ingestion-feeds worker
export const ingestionClient = treaty<IngestionApp>(getIngestionURL());
