import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockDb, clearMockKV, clearMockQueue } from "../../test/mock-db";
import { sourceConfigs } from "@trend-monitor/db/schema";
import app from "../index";

describe("Trigger Routes", () => {
	let mockEnv: any;

	beforeEach(async () => {
		// Clear all mocks
		await mockDb.delete(sourceConfigs);
		clearMockKV();
		clearMockQueue();

		// Insert test source config
		await mockDb.insert(sourceConfigs).values({
			id: "test-feed-1",
			type: "feed",
			config: {
				url: "https://example.com/feed1",
				name: "Test Feed 1",
			},
			enabled: true,
		});

		await mockDb.insert(sourceConfigs).values({
			id: "test-feed-2",
			type: "feed",
			config: {
				url: "https://example.com/feed2",
				name: "Test Feed 2",
			},
			enabled: false,
		});

		mockEnv = {
			DB: mockDb,
			CHECKPOINT: {
				get: mock(() => Promise.resolve(null)),
				put: mock(() => Promise.resolve()),
			},
			INGESTION_QUEUE: {
				sendBatch: mock(() => Promise.resolve()),
			},
			FEED_USER_AGENT: "test-agent/1.0",
		};
	});

	describe("POST /trigger/all", () => {
		test("returns success with no sources when database is empty", async () => {
			// Clear all sources
			await mockDb.delete(sourceConfigs);

			const response = await app.fetch(
				new Request("http://localhost/trigger/all", { method: "POST" }),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.summary.totalSources).toBe(0);
			expect(data.summary.totalEvents).toBe(0);
		});

		test("processes enabled sources and returns summary", async () => {
			const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Article</title>
      <link>https://example.com/article</link>
      <guid>article-1</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() =>
				Promise.resolve(new Response(mockRss, { status: 200 })),
			) as any;

			const response = await app.fetch(
				new Request("http://localhost/trigger/all", { method: "POST" }),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.summary.totalSources).toBe(1); // Only enabled source
			expect(data.summary.successfulSources).toBe(1);
			expect(data.summary.failedSources).toBe(0);
			expect(data.results).toHaveLength(1);
			expect(data.results[0].sourceId).toBe("test-feed-1");
			expect(data.results[0].status).toBe("success");

			globalThis.fetch = originalFetch;
		});

		test("handles failed sources and includes errors in results", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() =>
				Promise.reject(new Error("Network error")),
			) as any;

			const response = await app.fetch(
				new Request("http://localhost/trigger/all", { method: "POST" }),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true); // Overall success even if sources fail
			expect(data.summary.failedSources).toBe(1);
			expect(data.results[0].status).toBe("failed");
			expect(data.results[0].error).toBe("Network error");

			globalThis.fetch = originalFetch;
		});
	});

	describe("POST /trigger/:id", () => {
		test("returns error for non-existent source", async () => {
			const response = await app.fetch(
				new Request("http://localhost/trigger/non-existent-id", {
					method: "POST",
				}),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(false);
			expect(data.error).toContain("not found");
		});

		test("returns error for disabled source", async () => {
			const response = await app.fetch(
				new Request("http://localhost/trigger/test-feed-2", { method: "POST" }),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(false);
			expect(data.error).toContain("disabled");
		});

		test("processes enabled source successfully", async () => {
			const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Single Source Article</title>
      <link>https://example.com/article2</link>
      <guid>article-2</guid>
      <pubDate>Mon, 20 Jan 2026 11:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() =>
				Promise.resolve(new Response(mockRss, { status: 200 })),
			) as any;

			const response = await app.fetch(
				new Request("http://localhost/trigger/test-feed-1", { method: "POST" }),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.sourceId).toBe("test-feed-1");
			expect(data.sourceName).toBe("Test Feed 1");
			expect(data.eventsCount).toBeGreaterThanOrEqual(0);
			expect(data.checkpoint).toBeDefined();

			globalThis.fetch = originalFetch;
		});

		test("handles source processing failure", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() =>
				Promise.reject(new Error("Feed unavailable")),
			) as any;

			const response = await app.fetch(
				new Request("http://localhost/trigger/test-feed-1", { method: "POST" }),
				mockEnv,
				{} as any,
			);

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(false);
			expect(data.error).toBe("Feed unavailable");

			globalThis.fetch = originalFetch;
		});
	});
});
