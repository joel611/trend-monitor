import { mock } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";

// Create mock DB
const mockDb = createMockDB();

// Mock cloudflare:workers env to provide the mock DB
mock.module("cloudflare:workers", () => ({
	env: {
		DB: mockDb, // This will be used by src/lib/db/index.ts
	},
}));
