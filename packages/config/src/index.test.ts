import { describe, expect, test } from "bun:test";
import { AGGREGATION_WINDOWS, EMERGING_THRESHOLDS, SOURCES } from "./index";

describe("AGGREGATION_WINDOWS", () => {
	test("has week window of 7 days", () => {
		expect(AGGREGATION_WINDOWS.week).toBe(7);
	});

	test("has month window of 30 days", () => {
		expect(AGGREGATION_WINDOWS.month).toBe(30);
	});

	test("has quarter window of 90 days", () => {
		expect(AGGREGATION_WINDOWS.quarter).toBe(90);
	});

	test("values are accessible", () => {
		// TypeScript enforces readonly at compile time
		// Runtime access should work normally
		expect(AGGREGATION_WINDOWS.week).toBeDefined();
		expect(AGGREGATION_WINDOWS.month).toBeDefined();
		expect(AGGREGATION_WINDOWS.quarter).toBeDefined();
	});
});

describe("EMERGING_THRESHOLDS", () => {
	test("has minPrevious threshold", () => {
		expect(EMERGING_THRESHOLDS.minPrevious).toBe(3);
	});

	test("has minCurrent threshold", () => {
		expect(EMERGING_THRESHOLDS.minCurrent).toBe(10);
	});

	test("minCurrent is greater than minPrevious", () => {
		expect(EMERGING_THRESHOLDS.minCurrent).toBeGreaterThan(EMERGING_THRESHOLDS.minPrevious);
	});
});

describe("SOURCES", () => {
	test("includes reddit", () => {
		expect(SOURCES).toContain("reddit");
	});

	test("includes x", () => {
		expect(SOURCES).toContain("x");
	});

	test("includes feed", () => {
		expect(SOURCES).toContain("feed");
	});

	test("has exactly 3 sources", () => {
		expect(SOURCES).toHaveLength(3);
	});

	test("is a tuple array", () => {
		// TypeScript enforces readonly tuple at compile time
		// Runtime access should work normally
		expect(Array.isArray(SOURCES)).toBe(true);
		expect(SOURCES.length).toBe(3);
	});
});
