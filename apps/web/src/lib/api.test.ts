import { describe, it, expect } from "bun:test";
import { apiClient } from "./api";

describe("API client", () => {
	it("should be an Eden Treaty client", () => {
		// Eden Treaty client is a function that provides type-safe API access
		expect(apiClient).toBeDefined();
		expect(typeof apiClient).toBe("function");
	});
});
