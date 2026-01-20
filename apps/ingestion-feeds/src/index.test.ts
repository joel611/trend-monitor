import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
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
				enabled INTEGER NOT NULL DEFAULT 1
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
});
