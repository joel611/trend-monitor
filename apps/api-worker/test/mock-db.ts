import { mock } from "bun:test";
import { createMockDB } from "../src/lib/db/mock";

// Create a singleton mock DB instance that is reused across all tests
const mockDb = createMockDB();

// Mock cloudflare:workers module to provide the mock DB
// This is called before any imports, so the db/index.ts will use this mock
mock.module("cloudflare:workers", () => ({
	env: {
		DB: mockDb, // Provide the Drizzle client directly
	},
}));
