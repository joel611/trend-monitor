import { describe, test, expect, beforeEach } from "bun:test";
import { mentions, dailyAggregates } from "@trend-monitor/db";
import worker from "./index";
import { db } from "./lib/db";

describe("Aggregator Worker", () => {
	beforeEach(async () => {
		// Clear existing data from singleton DB
		await db.delete(mentions);
		await db.delete(dailyAggregates);
	});

	test("scheduled handler runs aggregation", async () => {
		// Insert test mentions
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
		]);

		const event = {
			scheduledTime: Date.now(),
			cron: "0 * * * *",
		} as ScheduledEvent;

		const env = { DB: db, CACHE: {} as KVNamespace };
		const ctx = {
			waitUntil: () => {},
			passThroughOnException: () => {},
		} as ExecutionContext;

		await worker.scheduled(event, env, ctx);

		// Verify aggregation ran (this test mainly checks it doesn't crash)
		// Detailed logic is tested in service tests
	});
});
