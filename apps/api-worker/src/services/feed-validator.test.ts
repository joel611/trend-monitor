import { describe, test, expect, mock } from "bun:test";
import { FeedValidatorService } from "./feed-validator";

describe("FeedValidatorService", () => {
	const validator = new FeedValidatorService();

	test("parse valid RSS 2.0 feed", async () => {
		const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <description>A test RSS feed</description>
    <link>https://example.com</link>
    <item>
      <title>Test Item</title>
      <link>https://example.com/item1</link>
      <description>Item description</description>
      <pubDate>Mon, 20 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

		// Mock fetch
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(rssXml, {
					headers: { "content-type": "application/rss+xml" },
				})
			)
		);

		const result = await validator.validate("https://example.com/feed.xml");

		expect(result.valid).toBe(true);
		expect(result.metadata?.title).toBe("Test Feed");
		expect(result.metadata?.format).toBe("rss");
		expect(result.preview).toBeDefined();
		expect(result.preview?.length).toBe(1);
		expect(result.preview?.[0].title).toBe("Test Item");
	});

	test("parse valid Atom 1.0 feed", async () => {
		const atomXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <subtitle>A test Atom feed</subtitle>
  <link href="https://example.com"/>
  <entry>
    <title>Test Entry</title>
    <link href="https://example.com/entry1"/>
    <summary>Entry summary</summary>
    <updated>2026-01-20T12:00:00Z</updated>
  </entry>
</feed>`;

		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(atomXml, {
					headers: { "content-type": "application/atom+xml" },
				})
			)
		);

		const result = await validator.validate("https://example.com/feed.atom");

		expect(result.valid).toBe(true);
		expect(result.metadata?.title).toBe("Test Atom Feed");
		expect(result.metadata?.format).toBe("atom");
		expect(result.preview).toBeDefined();
	});

	test("reject invalid XML", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(new Response("not xml at all"))
		);

		const result = await validator.validate("https://example.com/invalid");

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	test("reject non-feed content (HTML)", async () => {
		const html = "<!DOCTYPE html><html><body>Not a feed</body></html>";

		globalThis.fetch = mock(() => Promise.resolve(new Response(html)));

		const result = await validator.validate("https://example.com/page.html");

		expect(result.valid).toBe(false);
		expect(result.error).toContain("feed");
	});

	test("handle network timeout", async () => {
		globalThis.fetch = mock(() =>
			Promise.reject(new Error("Network timeout"))
		);

		const result = await validator.validate("https://example.com/feed");

		expect(result.valid).toBe(false);
		expect(result.error).toContain("timeout");
	});

	test("return limited preview items (max 10)", async () => {
		const items = Array.from({ length: 15 }, (_, i) => `
    <item>
      <title>Item ${i + 1}</title>
      <link>https://example.com/item${i + 1}</link>
      <description>Description ${i + 1}</description>
    </item>`).join("");

		const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Many Items Feed</title>
    ${items}
  </channel>
</rss>`;

		globalThis.fetch = mock(() =>
			Promise.resolve(new Response(rssXml))
		);

		const result = await validator.validate("https://example.com/feed");

		expect(result.valid).toBe(true);
		expect(result.preview?.length).toBe(10);
	});

	test("respect custom user agent", async () => {
		let capturedUserAgent: string | undefined;

		globalThis.fetch = mock((url, options) => {
			const headers = options?.headers as Record<string, string>;
			capturedUserAgent = headers?.["User-Agent"];
			return Promise.resolve(
				new Response(`<?xml version="1.0"?><rss><channel></channel></rss>`)
			);
		});

		await validator.validate(
			"https://example.com/feed",
			"CustomBot/1.0"
		);

		expect(capturedUserAgent).toBe("CustomBot/1.0");
	});
});
