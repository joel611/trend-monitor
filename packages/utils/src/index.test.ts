import { describe, expect, test } from "bun:test";
import { matchKeyword, normalizeText, toDateBucket } from "./index";

describe("normalizeText", () => {
	test("converts to lowercase", () => {
		expect(normalizeText("HELLO")).toBe("hello");
	});

	test("trims whitespace", () => {
		expect(normalizeText("  hello  ")).toBe("hello");
	});

	test("handles empty string", () => {
		expect(normalizeText("")).toBe("");
	});

	test("handles mixed case and whitespace", () => {
		expect(normalizeText("  TypeScript  ")).toBe("typescript");
	});
});

describe("matchKeyword", () => {
	test("matches exact keyword", () => {
		const result = matchKeyword("Hello TypeScript", "typescript", []);
		expect(result).toBe(true);
	});

	test("matches keyword case-insensitively", () => {
		const result = matchKeyword("Hello TYPESCRIPT world", "typescript", []);
		expect(result).toBe(true);
	});

	test("matches alias", () => {
		const result = matchKeyword("Hello TS world", "typescript", ["ts"]);
		expect(result).toBe(true);
	});

	test("does not match when keyword is not present", () => {
		const result = matchKeyword("Hello world", "typescript", []);
		expect(result).toBe(false);
	});

	test("matches multiple aliases", () => {
		const result = matchKeyword("Learning JS", "javascript", ["js", "ecmascript"]);
		expect(result).toBe(true);
	});

	test("handles empty aliases array", () => {
		const result = matchKeyword("Python is great", "python", []);
		expect(result).toBe(true);
	});

	test("handles empty text", () => {
		const result = matchKeyword("", "typescript", ["ts"]);
		expect(result).toBe(false);
	});
});

describe("toDateBucket", () => {
	test("formats date as YYYY-MM-DD", () => {
		const date = new Date("2026-01-16T12:34:56Z");
		expect(toDateBucket(date)).toBe("2026-01-16");
	});

	test("handles single-digit month and day", () => {
		const date = new Date("2026-03-05T00:00:00Z");
		expect(toDateBucket(date)).toBe("2026-03-05");
	});

	test("handles end of year", () => {
		const date = new Date("2025-12-31T23:59:59Z");
		expect(toDateBucket(date)).toBe("2025-12-31");
	});

	test("handles start of year", () => {
		const date = new Date("2026-01-01T00:00:00Z");
		expect(toDateBucket(date)).toBe("2026-01-01");
	});
});
