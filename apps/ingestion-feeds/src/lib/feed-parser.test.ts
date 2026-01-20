import { describe, test, expect } from "bun:test";
import { FeedParser, type FeedItem } from "./feed-parser";

describe("FeedParser - RSS 2.0", () => {
	const parser = new FeedParser();

	test("should parse RSS 2.0 feed", async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Post</title>
      <link>https://example.com/post</link>
      <guid>post-123</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
      <author>test@example.com (Test Author)</author>
      <description><![CDATA[<p>Post content</p>]]></description>
    </item>
  </channel>
</rss>`;

		const items = await parser.parse(xml);

		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Test Post");
		expect(items[0].link).toBe("https://example.com/post");
		expect(items[0].id).toBe("post-123");
		expect(items[0].publishedAt).toBeTruthy();
		expect(items[0].author).toBe("Test Author");
		expect(items[0].content).toContain("Post content");
	});

	test("should handle Reddit RSS format", async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Reddit Post</title>
      <link>https://www.reddit.com/r/test/comments/abc123/</link>
      <guid>https://www.reddit.com/r/test/comments/abc123/</guid>
      <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
      <author>/u/testuser</author>
      <description><![CDATA[<p>Reddit content</p>]]></description>
      <category>test</category>
    </item>
  </channel>
</rss>`;

		const items = await parser.parse(xml);
		expect(items[0].author).toBe("/u/testuser");
		expect(items[0].id).toBe("https://www.reddit.com/r/test/comments/abc123/");
	});
});

describe("FeedParser - Atom", () => {
	const parser = new FeedParser();

	test("should parse Atom feed", async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry>
    <title>Atom Post</title>
    <link href="https://example.com/atom-post"/>
    <id>atom-post-456</id>
    <updated>2026-01-20T10:30:00Z</updated>
    <author><name>Atom Author</name></author>
    <content type="html"><![CDATA[<p>Atom content</p>]]></content>
  </entry>
</feed>`;

		const items = await parser.parse(xml);

		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Atom Post");
		expect(items[0].link).toBe("https://example.com/atom-post");
		expect(items[0].id).toBe("atom-post-456");
		expect(items[0].publishedAt).toBeTruthy();
		expect(items[0].author).toBe("Atom Author");
		expect(items[0].content).toContain("Atom content");
	});
});

describe("FeedParser - Edge Cases", () => {
	const parser = new FeedParser();

	test("should handle empty feed", async () => {
		const xml = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
		const items = await parser.parse(xml);
		expect(items).toEqual([]);
	});

	test("should handle missing optional fields", async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Minimal Post</title>
      <link>https://example.com/minimal</link>
    </item>
  </channel>
</rss>`;

		const items = await parser.parse(xml);
		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Minimal Post");
		expect(items[0].link).toBe("https://example.com/minimal");
	});
});
