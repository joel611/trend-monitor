import { describe, expect, test } from "bun:test";
import type { Keyword } from "@trend-monitor/db";
import { KeywordMatcher } from "./keyword-matcher";

describe("KeywordMatcher", () => {
	const matcher = new KeywordMatcher();

	const keywords: Keyword[] = [
		{
			id: "kw-1",
			name: "ElysiaJS",
			aliases: ["elysia"],
			tags: [],
			status: "active",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
		{
			id: "kw-2",
			name: "Cloudflare D1",
			aliases: ["D1", "CF D1"],
			tags: [],
			status: "active",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	test("matches keyword in content (case insensitive)", () => {
		const matches = matcher.matchKeywords(
			"I'm building an API with elysiajs and it's great!",
			keywords,
		);

		expect(matches).toEqual(["kw-1"]);
	});

	test("matches alias in content", () => {
		const matches = matcher.matchKeywords("Using D1 for my database needs", keywords);

		expect(matches).toEqual(["kw-2"]);
	});

	test("matches multiple keywords", () => {
		const matches = matcher.matchKeywords("ElysiaJS with Cloudflare D1 is amazing", keywords);

		expect(matches.sort()).toEqual(["kw-1", "kw-2"]);
	});

	test("returns empty array when no matches", () => {
		const matches = matcher.matchKeywords("Just talking about React and PostgreSQL", keywords);

		expect(matches).toEqual([]);
	});

	test("deduplicates when keyword appears multiple times", () => {
		const matches = matcher.matchKeywords(
			"ElysiaJS is great. I love ElysiaJS. ElysiaJS rocks!",
			keywords,
		);

		expect(matches).toEqual(["kw-1"]);
	});
});
