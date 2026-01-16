import { mock } from "bun:test";
import { createMockDB } from "../src/lib/db/mock";

// Mock cloudflare:workers module before any imports
mock.module("cloudflare:workers", () => ({
	env: {
		DB: createMockDB(),
	},
}));
