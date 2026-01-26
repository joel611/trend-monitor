import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockDb } from "../test/mock-db";
import { sourceConfigs } from "@trend-monitor/db/schema";
import { eq } from "drizzle-orm";
import worker from "./index";

describe("Feed Ingestion Worker", () => {
	let mockEnv: any;
	let mockCtx: ExecutionContext;

	beforeEach(async () => {
		// Clear database
		await mockDb.delete(sourceConfigs);

		// Insert test source config
		await mockDb.insert(sourceConfigs).values({
			id: "feed-test",
			type: "feed",
			config: {
				url: "https://example.com/rss",
				name: "Test Feed",
			},
			enabled: true,
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

		mockCtx = {
			waitUntil: mock(() => {}),
			passThroughOnException: mock(() => {}),
		} as any;
	});

	test("should process configured feeds on scheduled trigger", async () => {
		const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Great Article</title>
      <link>https://example.com/article</link>
      <guid>article-123</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
      <description><![CDATA[<p>Amazing content!</p>]]></description>
    </item>
  </channel>
</rss>`;

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mock((url: string) => {
			if (url.includes("example.com/rss")) {
				return Promise.resolve(new Response(mockRss, { status: 200 }));
			}
			return Promise.reject(new Error("Unexpected fetch"));
		}) as any;

		const event = {} as ScheduledEvent;
		await worker.scheduled(event, mockEnv, mockCtx);

		expect(mockEnv.INGESTION_QUEUE.sendBatch).toHaveBeenCalled();
		const queueCall = (mockEnv.INGESTION_QUEUE.sendBatch as any).mock.calls[0][0];
		expect(queueCall).toHaveLength(1);
		expect(queueCall[0].body.sourceId).toBe("article-123");
		expect(queueCall[0].body.title).toBe("Great Article");

		globalThis.fetch = originalFetch;
	});

	describe("Health tracking", () => {
		test("record success metrics after successful fetch", async () => {
			const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Article</title>
      <link>https://example.com/article</link>
      <guid>article-456</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() => Promise.resolve(new Response(mockRss, { status: 200 }))) as any;

			const event = {} as ScheduledEvent;
			await worker.scheduled(event, mockEnv, mockCtx);

			// Verify success was recorded
			const result = await mockDb
				.select()
				.from(sourceConfigs)
				.where(eq(sourceConfigs.id, "feed-test"))
				.get();
			expect(result?.lastSuccessAt).toBeDefined();
			expect(result?.consecutiveFailures).toBe(0);
			expect(result?.lastErrorMessage).toBeNull();

			globalThis.fetch = originalFetch;
		});

		test("record failure metrics after failed fetch", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() => Promise.reject(new Error("Network timeout"))) as any;

			const event = {} as ScheduledEvent;
			await worker.scheduled(event, mockEnv, mockCtx);

			// Verify failure was recorded
			const result = await mockDb
				.select()
				.from(sourceConfigs)
				.where(eq(sourceConfigs.id, "feed-test"))
				.get();
			expect(result?.lastErrorAt).toBeDefined();
			expect(result?.lastErrorMessage).toBe("Network timeout");
			expect(result?.consecutiveFailures).toBe(1);

			globalThis.fetch = originalFetch;
		});

		test("auto-disable source after 10 consecutive failures", async () => {
			// Set consecutive failures to 9
			await mockDb
				.update(sourceConfigs)
				.set({ consecutiveFailures: 9 })
				.where(eq(sourceConfigs.id, "feed-test"));

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() => Promise.reject(new Error("Network timeout"))) as any;

			const event = {} as ScheduledEvent;
			await worker.scheduled(event, mockEnv, mockCtx);

			// Verify source was auto-disabled
			const result = await mockDb
				.select()
				.from(sourceConfigs)
				.where(eq(sourceConfigs.id, "feed-test"))
				.get();
			expect(result?.enabled).toBe(false);
			expect(result?.consecutiveFailures).toBe(10);

			globalThis.fetch = originalFetch;
		});

		test("reset failure counter on success after failures", async () => {
			// Set consecutive failures to 5
			await mockDb
				.update(sourceConfigs)
				.set({ consecutiveFailures: 5 })
				.where(eq(sourceConfigs.id, "feed-test"));

			const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Recovery Article</title>
      <link>https://example.com/recovery</link>
      <guid>article-789</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() => Promise.resolve(new Response(mockRss, { status: 200 }))) as any;

			const event = {} as ScheduledEvent;
			await worker.scheduled(event, mockEnv, mockCtx);

			// Verify failure counter was reset
			const result = await mockDb
				.select()
				.from(sourceConfigs)
				.where(eq(sourceConfigs.id, "feed-test"))
				.get();
			expect(result?.consecutiveFailures).toBe(0);
			expect(result?.lastSuccessAt).toBeDefined();

			globalThis.fetch = originalFetch;
		});
	});
});
