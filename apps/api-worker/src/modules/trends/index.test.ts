import { describe, it, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "../..";
import { db } from "../../lib/db";

const client = treaty(app);

describe("Trends API", () => {
	beforeEach(async () => {
		// Clean up database
		await db.prepare("DELETE FROM daily_aggregates").run();
		await db.prepare("DELETE FROM keywords").run();
	});

	describe("GET /api/trends/overview", () => {
		it("should return empty trends when no data exists", async () => {
			const { data, error } = await client.api.trends.overview.get();

			expect(error).toBeNull();
			expect(data).toMatchObject({
				topKeywords: [],
				emergingKeywords: [],
				totalMentions: 0,
				sourceBreakdown: [],
			});
		});

		it("should return trends overview with top keywords", async () => {
			// Insert test keyword
			await db
				.prepare(
					`INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					"kw1",
					"React",
					"[]",
					"[]",
					"active",
					"2026-01-01T00:00:00Z",
					"2026-01-01T00:00:00Z",
				)
				.run();

			// Insert daily aggregates for current period
			const today = new Date().toISOString().split("T")[0];
			await db
				.prepare(
					`INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count)
         VALUES (?, ?, ?, ?, ?)`,
				)
				.bind("da1", today, "kw1", "reddit", 15)
				.run();

			const { data, error } = await client.api.trends.overview.get();

			expect(error).toBeNull();
			expect(data?.topKeywords).toHaveLength(1);
			expect(data?.topKeywords[0]).toMatchObject({
				keywordId: "kw1",
				name: "React",
				currentPeriod: 15,
			});
			expect(data?.totalMentions).toBeGreaterThan(0);
		});

		it("should accept date range parameters", async () => {
			const { data, error } = await client.api.trends.overview.get({
				query: {
					from: "2026-01-01",
					to: "2026-01-10",
				},
			});

			expect(error).toBeNull();
			expect(data).toBeDefined();
		});
	});

	describe("GET /api/trends/:keywordId", () => {
		it("should return 404 for non-existent keyword", async () => {
			const { status, error } = await client.api.trends({
				keywordId: "nonexistent",
			}).get();

			expect(status).toBe(404);
			expect(error).toBeDefined();
		});

		it("should return keyword trend data", async () => {
			// Insert test keyword
			await db
				.prepare(
					`INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					"kw1",
					"Vue",
					"[]",
					"[]",
					"active",
					"2026-01-01T00:00:00Z",
					"2026-01-01T00:00:00Z",
				)
				.run();

			// Insert daily aggregates
			const today = new Date().toISOString().split("T")[0];
			await db
				.prepare(
					`INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count)
         VALUES (?, ?, ?, ?, ?)`,
				)
				.bind("da1", today, "kw1", "reddit", 10)
				.run();

			const { data, error } = await client.api.trends({ keywordId: "kw1" }).get();

			expect(error).toBeNull();
			expect(data).toMatchObject({
				keywordId: "kw1",
				name: "Vue",
			});
			expect(data?.timeSeries).toBeDefined();
			expect(Array.isArray(data?.timeSeries)).toBe(true);
			expect(data?.totalMentions).toBeDefined();
			expect(data?.averagePerDay).toBeDefined();
		});

		it("should filter by source", async () => {
			// Insert test keyword
			await db
				.prepare(
					`INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					"kw1",
					"Angular",
					"[]",
					"[]",
					"active",
					"2026-01-01T00:00:00Z",
					"2026-01-01T00:00:00Z",
				)
				.run();

			// Insert aggregates for different sources
			const today = new Date().toISOString().split("T")[0];
			await db
				.prepare(
					`INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count)
         VALUES (?, ?, ?, ?, ?)`,
				)
				.bind("da1", today, "kw1", "reddit", 5)
				.run();

			await db
				.prepare(
					`INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count)
         VALUES (?, ?, ?, ?, ?)`,
				)
				.bind("da2", today, "kw1", "x", 10)
				.run();

			const { data, error } = await client.api.trends({ keywordId: "kw1" }).get({
				query: { source: "reddit" },
			});

			expect(error).toBeNull();
			expect(data?.timeSeries.every((point) => point.source === "reddit")).toBe(true);
		});

		it("should accept date range parameters", async () => {
			// Insert test keyword
			await db
				.prepare(
					`INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					"kw1",
					"Svelte",
					"[]",
					"[]",
					"active",
					"2026-01-01T00:00:00Z",
					"2026-01-01T00:00:00Z",
				)
				.run();

			const { data, error } = await client.api.trends({ keywordId: "kw1" }).get({
				query: {
					from: "2026-01-01",
					to: "2026-01-10",
				},
			});

			expect(error).toBeNull();
			expect(data).toBeDefined();
		});
	});
});
