import { describe, test, expect, beforeEach } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";
import { mentions, dailyAggregates, keywords } from "@trend-monitor/db";
import { AggregationRepository } from "./repositories/aggregation-repository";
import { AggregationService } from "./services/aggregation-service";

describe("Aggregator Integration", () => {
	let db: ReturnType<typeof createMockDB>;
	let service: AggregationService;

	beforeEach(() => {
		db = createMockDB();
		const repo = new AggregationRepository(db);
		service = new AggregationService(repo);
	});

	test("full aggregation workflow from mentions to daily aggregates", async () => {
		// 1. Insert keywords
		await db.insert(keywords).values([
			{
				id: "k1",
				name: "typescript",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-20T00:00:00Z",
				updatedAt: "2026-01-20T00:00:00Z",
			},
			{
				id: "k2",
				name: "cloudflare",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-20T00:00:00Z",
				updatedAt: "2026-01-20T00:00:00Z",
			},
		]);

		// 2. Insert mentions across multiple days and sources
		await db.insert(mentions).values([
			// Day 1 - Reddit
			{
				id: "m1",
				source: "reddit",
				sourceId: "r1",
				content: "typescript is great",
				url: "https://reddit.com/1",
				createdAt: "2026-01-20T10:00:00Z",
				fetchedAt: "2026-01-20T10:05:00Z",
				matchedKeywords: ["k1"],
			},
			{
				id: "m2",
				source: "reddit",
				sourceId: "r2",
				content: "typescript and cloudflare",
				url: "https://reddit.com/2",
				createdAt: "2026-01-20T14:00:00Z",
				fetchedAt: "2026-01-20T14:05:00Z",
				matchedKeywords: ["k1", "k2"],
			},
			// Day 1 - X
			{
				id: "m3",
				source: "x",
				sourceId: "x1",
				content: "cloudflare workers",
				url: "https://x.com/1",
				createdAt: "2026-01-20T16:00:00Z",
				fetchedAt: "2026-01-20T16:05:00Z",
				matchedKeywords: ["k2"],
			},
			// Day 2 - Reddit
			{
				id: "m4",
				source: "reddit",
				sourceId: "r3",
				content: "typescript types",
				url: "https://reddit.com/3",
				createdAt: "2026-01-21T10:00:00Z",
				fetchedAt: "2026-01-21T10:05:00Z",
				matchedKeywords: ["k1"],
			},
		]);

		// 3. Run aggregation
		const summary = await service.runAggregation(7);

		// 4. Verify summary
		expect(summary.datesProcessed).toContain("2026-01-20");
		expect(summary.datesProcessed).toContain("2026-01-21");
		expect(summary.totalAggregates).toBeGreaterThanOrEqual(4);

		// 5. Verify daily aggregates are correct
		const aggregates = await db.select().from(dailyAggregates);

		// Day 1, k1, reddit = 2 mentions
		const day1k1reddit = aggregates.find(
			(a) => a.date === "2026-01-20" && a.keywordId === "k1" && a.source === "reddit",
		);
		expect(day1k1reddit?.mentionsCount).toBe(2);

		// Day 1, k2, reddit = 1 mention
		const day1k2reddit = aggregates.find(
			(a) => a.date === "2026-01-20" && a.keywordId === "k2" && a.source === "reddit",
		);
		expect(day1k2reddit?.mentionsCount).toBe(1);

		// Day 1, k2, x = 1 mention
		const day1k2x = aggregates.find(
			(a) => a.date === "2026-01-20" && a.keywordId === "k2" && a.source === "x",
		);
		expect(day1k2x?.mentionsCount).toBe(1);

		// Day 2, k1, reddit = 1 mention
		const day2k1reddit = aggregates.find(
			(a) => a.date === "2026-01-21" && a.keywordId === "k1" && a.source === "reddit",
		);
		expect(day2k1reddit?.mentionsCount).toBe(1);

		// 6. Run aggregation again (should be idempotent)
		const summary2 = await service.runAggregation(7);
		expect(summary2.datesProcessed).toEqual([]); // No pending dates

		const aggregates2 = await db.select().from(dailyAggregates);
		expect(aggregates2.length).toBe(aggregates.length); // Same count
	});
});
