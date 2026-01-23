import { mock } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";

export const mockDb = createMockDB();

mock.module("cloudflare:workers", () => ({
	env: {
		DB: mockDb,
	},
}));
