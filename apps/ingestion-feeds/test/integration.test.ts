import { describe, test, expect } from "bun:test";
import { FeedClient } from "../src/lib/feed-client";
import { IngestionService } from "../src/services/ingestion-service";
import { CheckpointService } from "../src/services/checkpoint-service";

describe("Feed Ingestion Integration", () => {
	test("full flow: fetch RSS, filter by checkpoint, transform", async () => {
		let storedCheckpoint: string | null = null;
		const mockKV = {
			get: () => Promise.resolve(storedCheckpoint),
			put: (_key: string, value: string) => {
				storedCheckpoint = value;
				return Promise.resolve();
			},
		} as any;

		const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>New Article about Cloudflare</title>
      <link>https://blog.example.com/new-article</link>
      <guid>new-123</guid>
      <pubDate>Mon, 20 Jan 2026 12:00:00 +0000</pubDate>
      <author>blogger@example.com (Tech Blogger)</author>
      <description><![CDATA[<p>Learn about <strong>Cloudflare Workers</strong>!</p>]]></description>
    </item>
    <item>
      <title>Old Article</title>
      <link>https://blog.example.com/old-article</link>
      <guid>old-456</guid>
      <pubDate>Mon, 20 Jan 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[<p>Old content</p>]]></description>
    </item>
  </channel>
</rss>`;

		globalThis.fetch = ((url: string) => {
			if (url.includes("example.com/rss")) {
				return Promise.resolve(new Response(mockRss));
			}
			return Promise.reject(new Error("Unexpected URL"));
		}) as any;

		const client = new FeedClient({
			defaultUserAgent: "test/1.0",
		});

		const checkpointService = new CheckpointService(mockKV);
		const ingestionService = new IngestionService();

		// Set checkpoint to filter old posts
		await checkpointService.saveCheckpoint("test-feed", {
			lastPublishedAt: "Mon, 20 Jan 2026 11:00:00 +0000",
			lastFetchedAt: "2026-01-20T11:00:00Z",
		});

		const result = await ingestionService.processFeed(
			"test-feed",
			"https://blog.example.com/rss",
			client,
			checkpointService,
		);

		// Should only get the new post
		expect(result.events).toHaveLength(1);
		expect(result.events[0].sourceId).toBe("new-123");
		expect(result.events[0].title).toBe("New Article about Cloudflare");
		expect(result.events[0].content).toContain("Cloudflare Workers");
		expect(result.events[0].content).not.toContain("<p>");
		expect(result.events[0].content).not.toContain("<strong>");
		expect(result.events[0].author).toBe("Tech Blogger");
		expect(result.events[0].metadata).toEqual({ feedUrl: "https://blog.example.com/rss" });

		// Checkpoint should be updated
		expect(result.newCheckpoint?.lastPublishedAt).toBe("Mon, 20 Jan 2026 12:00:00 +0000");
	});

	test("should handle Atom feed format", async () => {
		const mockKV = {
			get: () => Promise.resolve(null),
			put: () => Promise.resolve(),
		} as any;

		const mockAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom-entry"/>
    <id>atom-123</id>
    <updated>2026-01-20T12:00:00Z</updated>
    <author><name>Atom Author</name></author>
    <content type="html"><![CDATA[<p>Atom content</p>]]></content>
  </entry>
</feed>`;

		globalThis.fetch = (() => Promise.resolve(new Response(mockAtom))) as any;

		const client = new FeedClient({ defaultUserAgent: "test/1.0" });
		const checkpointService = new CheckpointService(mockKV);
		const ingestionService = new IngestionService();

		const result = await ingestionService.processFeed(
			"atom-feed",
			"https://example.com/atom",
			client,
			checkpointService,
		);

		expect(result.events).toHaveLength(1);
		expect(result.events[0].sourceId).toBe("atom-123");
		expect(result.events[0].author).toBe("Atom Author");
	});
});
