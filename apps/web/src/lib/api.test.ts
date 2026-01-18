import { describe, it, expect } from "bun:test";
import { api } from "./api";

describe("API client", () => {
	it("should be an Eden Treaty client", () => {
		// Eden Treaty client is a function that provides type-safe API access
		expect(api).toBeDefined();
		expect(typeof api).toBe("function");
	});
});
