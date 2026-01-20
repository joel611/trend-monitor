import { describe, test, expect, beforeEach } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";
import { mentions, dailyAggregates } from "@trend-monitor/db";
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
});
