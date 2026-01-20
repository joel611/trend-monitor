import { describe, test, expect, beforeEach, mock } from "bun:test";
import { FeedClient } from "./feed-client";

describe("FeedClient", () => {
	let client: FeedClient;
	const mockFetch = mock(() => Promise.resolve(new Response()));

	beforeEach(() => {
		globalThis.fetch = mockFetch;
		mockFetch.mockClear();
		client = new FeedClient({
			defaultUserAgent: "test-agent/1.0",
		});
	});

	test("should fetch and parse RSS feed", async () => {
		const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Post</title>
      <link>https://example.com/post</link>
      <guid>post-123</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
      <description><![CDATA[<p>Test content</p>]]></description>
    </item>
  </channel>
</rss>`;

		mockFetch.mockResolvedValueOnce(
			new Response(mockRss, {
				status: 200,
				headers: { "Content-Type": "application/rss+xml" },
			}),
		);

		const posts = await client.fetchFeed("https://example.com/rss");

		expect(posts).toHaveLength(1);
		expect(posts[0].id).toBe("post-123");
		expect(posts[0].title).toBe("Test Post");
		expect(posts[0].content).toBe("Test content");
		expect(posts[0].url).toBe("https://example.com/post");

		// Verify correct URL was called
		const call = mockFetch.mock.calls[0];
		expect(call[0]).toBe("https://example.com/rss");
		expect(call[1]?.headers?.["User-Agent"]).toBe("test-agent/1.0");
	});

	test("should use custom user agent when provided", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(`<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`),
		);

		await client.fetchFeed("https://example.com/rss", "custom-agent/2.0");

		const call = mockFetch.mock.calls[0];
		expect(call[1]?.headers?.["User-Agent"]).toBe("custom-agent/2.0");
	});

	test("should handle HTTP errors", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response("Not Found", {
				status: 404,
			}),
		);

		await expect(client.fetchFeed("https://example.com/nonexistent")).rejects.toThrow(
			"Failed to fetch feed",
		);
	});

	test("should parse Atom feed", async () => {
		const mockAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom Post</title>
    <link href="https://example.com/atom"/>
    <id>atom-123</id>
    <updated>2026-01-20T10:30:00Z</updated>
    <content type="html"><![CDATA[<p>Atom content</p>]]></content>
  </entry>
</feed>`;

		mockFetch.mockResolvedValueOnce(new Response(mockAtom));

		const posts = await client.fetchFeed("https://example.com/atom");
		expect(posts).toHaveLength(1);
		expect(posts[0].id).toBe("atom-123");
	});
});
