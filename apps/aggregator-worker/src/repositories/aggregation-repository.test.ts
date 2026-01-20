import { describe, test, expect, beforeEach } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";
import { mentions, dailyAggregates } from "@trend-monitor/db";
import { sql } from "drizzle-orm";
import { AggregationRepository } from "./aggregation-repository";

describe("AggregationRepository", () => {
	let db: ReturnType<typeof createMockDB>;
	let repo: AggregationRepository;

	beforeEach(() => {
		db = createMockDB();
		repo = new AggregationRepository(db);
	});

	test("getPendingDateRanges returns dates with mentions but no aggregates", async () => {
		// Insert mentions for 2026-01-20 and 2026-01-21
		await db.insert(mentions).values([
			{
				id: "m1",
				source: "reddit",
				sourceId: "r1",
				content: "test",
				url: "https://reddit.com/1",
				createdAt: "2026-01-20T10:00:00Z",
				fetchedAt: "2026-01-20T10:05:00Z",
				matchedKeywords: ["k1"],
			},
			{
				id: "m2",
				source: "reddit",
				sourceId: "r2",
				content: "test",
				url: "https://reddit.com/2",
				createdAt: "2026-01-21T10:00:00Z",
				fetchedAt: "2026-01-21T10:05:00Z",
				matchedKeywords: ["k1"],
			},
		]);

		// Insert aggregate for 2026-01-20 only
		await db.insert(dailyAggregates).values({
			id: "a1",
			date: "2026-01-20",
			keywordId: "k1",
			source: "reddit",
			mentionsCount: 1,
		});

		const pending = await repo.getPendingDateRanges(2);

		expect(pending).toEqual(["2026-01-21"]);
	});

	test("getAggregationStatsForDate groups mentions by keyword and source", async () => {
		await db.insert(mentions).values([
			{
				id: "m1",
				source: "reddit",
				sourceId: "r1",
				content: "test",
				url: "https://reddit.com/1",
				createdAt: "2026-01-20T10:00:00Z",
				fetchedAt: "2026-01-20T10:05:00Z",
				matchedKeywords: ["k1", "k2"],
			},
			{
				id: "m2",
				source: "reddit",
				sourceId: "r2",
				content: "test",
				url: "https://reddit.com/2",
				createdAt: "2026-01-20T14:00:00Z",
				fetchedAt: "2026-01-20T14:05:00Z",
				matchedKeywords: ["k1"],
			},
			{
				id: "m3",
				source: "x",
				sourceId: "x1",
				content: "test",
				url: "https://x.com/1",
				createdAt: "2026-01-20T16:00:00Z",
				fetchedAt: "2026-01-20T16:05:00Z",
				matchedKeywords: ["k1"],
			},
		]);

		const stats = await repo.getAggregationStatsForDate("2026-01-20");

		expect(stats).toHaveLength(3);
		expect(stats).toContainEqual({
			date: "2026-01-20",
			keywordId: "k1",
			source: "reddit",
			count: 2,
		});
		expect(stats).toContainEqual({
			date: "2026-01-20",
			keywordId: "k2",
			source: "reddit",
			count: 1,
		});
		expect(stats).toContainEqual({
			date: "2026-01-20",
			keywordId: "k1",
			source: "x",
			count: 1,
		});
	});

	test("upsertDailyAggregates inserts new records", async () => {
		const stats = [
			{ date: "2026-01-20", keywordId: "k1", source: "reddit" as const, count: 5 },
			{ date: "2026-01-20", keywordId: "k2", source: "x" as const, count: 3 },
		];

		await repo.upsertDailyAggregates(stats);

		const result = await db
			.select()
			.from(dailyAggregates)
			.where(sql`${dailyAggregates.date} = '2026-01-20'`);

		expect(result).toHaveLength(2);
		expect(result[0].mentionsCount).toBe(5);
		expect(result[1].mentionsCount).toBe(3);
	});

	test("upsertDailyAggregates updates existing records", async () => {
		// Insert existing aggregate
		await db.insert(dailyAggregates).values({
			id: "a1",
			date: "2026-01-20",
			keywordId: "k1",
			source: "reddit",
			mentionsCount: 5,
		});

		const stats = [{ date: "2026-01-20", keywordId: "k1", source: "reddit" as const, count: 10 }];

		await repo.upsertDailyAggregates(stats);

		const result = await db
			.select()
			.from(dailyAggregates)
			.where(sql`${dailyAggregates.date} = '2026-01-20'`);

		expect(result).toHaveLength(1);
		expect(result[0].mentionsCount).toBe(10);
		expect(result[0].id).toBe("a1"); // Same record
	});
});
