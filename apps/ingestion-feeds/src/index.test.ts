import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import worker from "./index";

describe("Feed Ingestion Worker", () => {
	let mockEnv: any;
	let mockCtx: ExecutionContext;
	let sqlite: Database;

	beforeEach(async () => {
		sqlite = new Database(":memory:");

		await sqlite.exec(`
			CREATE TABLE IF NOT EXISTS source_configs (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL,
				config TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1,
				created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				last_fetch_at TEXT,
				last_success_at TEXT,
				last_error_at TEXT,
				last_error_message TEXT,
				consecutive_failures INTEGER NOT NULL DEFAULT 0,
				deleted_at TEXT
			)
		`);

		await sqlite.exec(`
			INSERT INTO source_configs (id, type, config, enabled)
			VALUES ('feed-test', 'feed', '${JSON.stringify({
				url: "https://example.com/rss",
				name: "Test Feed",
			})}', 1)
		`);

		mockEnv = {
			DB: {
				prepare: (sql: string) => {
					const stmt = sqlite.prepare(sql);
					return {
						bind: (...values: any[]) => {
							return {
								all: async () => {
									const results = stmt.all(...values) as any[];
									return { results };
								},
							};
						},
					};
				},
			},
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
			const result = sqlite.prepare("SELECT * FROM source_configs WHERE id = ?").get("feed-test") as any;
			expect(result.last_success_at).toBeDefined();
			expect(result.consecutive_failures).toBe(0);
			expect(result.last_error_message).toBeNull();

			globalThis.fetch = originalFetch;
		});

		test("record failure metrics after failed fetch", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() => Promise.reject(new Error("Network timeout"))) as any;

			const event = {} as ScheduledEvent;
			await worker.scheduled(event, mockEnv, mockCtx);

			// Verify failure was recorded
			const result = sqlite.prepare("SELECT * FROM source_configs WHERE id = ?").get("feed-test") as any;
			expect(result.last_error_at).toBeDefined();
			expect(result.last_error_message).toBe("Network timeout");
			expect(result.consecutive_failures).toBe(1);

			globalThis.fetch = originalFetch;
		});

		test("auto-disable source after 10 consecutive failures", async () => {
			// Set consecutive failures to 9
			sqlite.prepare("UPDATE source_configs SET consecutive_failures = ? WHERE id = ?").run(9, "feed-test");

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() => Promise.reject(new Error("Network timeout"))) as any;

			const event = {} as ScheduledEvent;
			await worker.scheduled(event, mockEnv, mockCtx);

			// Verify source was auto-disabled
			const result = sqlite.prepare("SELECT * FROM source_configs WHERE id = ?").get("feed-test") as any;
			expect(result.enabled).toBe(0);
			expect(result.consecutive_failures).toBe(10);

			globalThis.fetch = originalFetch;
		});

		test("reset failure counter on success after failures", async () => {
			// Set consecutive failures to 5
			sqlite.prepare("UPDATE source_configs SET consecutive_failures = ? WHERE id = ?").run(5, "feed-test");

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
			const result = sqlite.prepare("SELECT * FROM source_configs WHERE id = ?").get("feed-test") as any;
			expect(result.consecutive_failures).toBe(0);
			expect(result.last_success_at).toBeDefined();

			globalThis.fetch = originalFetch;
		});
	});
});
