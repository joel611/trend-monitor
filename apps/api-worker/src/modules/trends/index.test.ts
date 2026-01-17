import { describe, it, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "../..";
import { db, dailyAggregates, keywords } from "../../lib/db";

const client = treaty(app);

describe("Trends API", () => {
	beforeEach(async () => {
		// Clean up database using Drizzle
		await db.delete(dailyAggregates);
		await db.delete(keywords);
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
			// Insert test keyword using Drizzle
			await db.insert(keywords).values({
				id: "kw1",
				name: "React",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			// Insert daily aggregates for current period
			const today = new Date().toISOString().split("T")[0];
			await db.insert(dailyAggregates).values({
				id: "da1",
				date: today,
				keywordId: "kw1",
				source: "reddit",
				mentionsCount: 15,
			});

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
			// Insert test keyword using Drizzle
			await db.insert(keywords).values({
				id: "kw1",
				name: "Vue",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			// Insert daily aggregates
			const today = new Date().toISOString().split("T")[0];
			await db.insert(dailyAggregates).values({
				id: "da1",
				date: today,
				keywordId: "kw1",
				source: "reddit",
				mentionsCount: 10,
			});

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
			// Insert test keyword using Drizzle
			await db.insert(keywords).values({
				id: "kw1",
				name: "Angular",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			// Insert aggregates for different sources
			const today = new Date().toISOString().split("T")[0];
			await db.insert(dailyAggregates).values([
				{
					id: "da1",
					date: today,
					keywordId: "kw1",
					source: "reddit",
					mentionsCount: 5,
				},
				{
					id: "da2",
					date: today,
					keywordId: "kw1",
					source: "x",
					mentionsCount: 10,
				},
			]);

			const { data, error } = await client.api.trends({ keywordId: "kw1" }).get({
				query: { source: "reddit" },
			});

			expect(error).toBeNull();
			expect(data?.timeSeries.every((point) => point.source === "reddit")).toBe(true);
		});

		it("should accept date range parameters", async () => {
			// Insert test keyword using Drizzle
			await db.insert(keywords).values({
				id: "kw1",
				name: "Svelte",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

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
