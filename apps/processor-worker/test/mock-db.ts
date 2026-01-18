import { mock } from "bun:test";
import { createMockDB } from "@trend-monitor/db";

// Create a singleton mock DB instance
const mockDb = createMockDB();

// Mock cloudflare:workers module to provide the mock DB
mock.module("cloudflare:workers", () => ({
	env: {
		DB: mockDb,
	},
}));
