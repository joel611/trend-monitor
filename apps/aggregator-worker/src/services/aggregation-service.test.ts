import { beforeEach, describe, expect, test } from "bun:test";
import { dailyAggregates, mentions } from "@trend-monitor/db";
import { createMockDB } from "@trend-monitor/db/mock";
import { sql } from "drizzle-orm";
import { AggregationRepository } from "@trend-monitor/db/repositories";
import { AggregationService } from "./aggregation-service";

describe("AggregationService", () => {
	let db: ReturnType<typeof createMockDB>;
	let service: AggregationService;

	beforeEach(() => {
		db = createMockDB();
		const repo = new AggregationRepository(db);
		service = new AggregationService(repo);
	});

	test("aggregateDate processes mentions and creates aggregates", async () => {
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
				createdAt: "2026-01-20T14:00:00Z",
				fetchedAt: "2026-01-20T14:05:00Z",
				matchedKeywords: ["k1"],
			},
		]);

		await service.aggregateDate("2026-01-20");

		const result = await db
			.select()
			.from(dailyAggregates)
			.where(sql`${dailyAggregates.date} = '2026-01-20'`);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			date: "2026-01-20",
			keywordId: "k1",
			source: "reddit",
			mentionsCount: 2,
		});
	});

	test("runAggregation processes all pending dates", async () => {
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

		const summary = await service.runAggregation(7);

		expect(summary.datesProcessed).toContain("2026-01-20");
		expect(summary.datesProcessed).toContain("2026-01-21");
		expect(summary.totalAggregates).toBeGreaterThanOrEqual(2);
	});
});
