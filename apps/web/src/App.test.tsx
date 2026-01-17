import { describe, expect, test } from "bun:test";
import "./__tests__/setup";

describe("Web App Setup", () => {
	test("happy-dom is configured", () => {
		// Verify DOM environment is available
		expect(document).toBeDefined();
		expect(document.createElement).toBeDefined();
	});

	test("document has body element", () => {
		expect(document.body).toBeDefined();
		expect(document.body.tagName).toBe("BODY");
	});

	test("can create and append elements", () => {
		const div = document.createElement("div");
		div.textContent = "Test Content";
		document.body.appendChild(div);

		expect(document.body.innerHTML).toContain("Test Content");

		document.body.removeChild(div);
	});

	test("global fetch is mocked", () => {
		expect(global.fetch).toBeDefined();
		expect(typeof global.fetch).toBe("function");
	});
});
