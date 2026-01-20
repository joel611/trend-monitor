# RSS/Atom Feed Ingestion Worker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a generic Cloudflare Worker that fetches posts from any RSS/Atom feed (Reddit, Hacker News, blogs, etc.) and publishes them to the ingestion queue for keyword matching.

**Architecture:** Cron-triggered worker that fetches RSS/Atom feeds from configured URLs (no authentication required), maintains checkpoint state in KV for incremental fetching, and publishes normalized events to Cloudflare Queue.

**Tech Stack:** TypeScript, Cloudflare Workers, RSS 2.0/Atom feeds (XML), D1 (config), KV (checkpoints), Queues

---

## Background

### RSS/Atom Feed Information

**No Authentication Required:**
- Most RSS/Atom feeds are public
- Simple HTTP GET requests with User-Agent header
- Works with Reddit, Hacker News, blogs, news sites, etc.

**Supported Sources:**
- **Reddit subreddits**: `https://www.reddit.com/r/{subreddit}/.rss`
- **Hacker News**: `https://news.ycombinator.com/rss`
- **X/Twitter accounts**: `https://rss.xcancel.com/{username}/rss` (via xcancel.com RSS proxy)
- **Blogs/websites**: Any standard RSS 2.0 or Atom feed
- **News sites**: Most provide RSS feeds

**RSS 2.0 Format:**
```xml
<item>
  <title>Post Title</title>
  <link>https://example.com/post</link>
  <guid>unique-id</guid>
  <pubDate>Mon, 20 Jan 2026 10:30:00 +0000</pubDate>
  <author>author@example.com (Author Name)</author>
  <description><![CDATA[Post content HTML]]></description>
</item>
```

**Atom Format:**
```xml
<entry>
  <title>Post Title</title>
  <link href="https://example.com/post"/>
  <id>unique-id</id>
  <updated>2026-01-20T10:30:00Z</updated>
  <author><name>Author Name</name></author>
  <content type="html"><![CDATA[Post content HTML]]></content>
</entry>
```

**Key Features:**
- ✅ No authentication needed
- ✅ Standard XML formats (RSS 2.0, Atom 1.0)
- ✅ Works with any feed URL
- ⚠️ Limited to recent posts (~25-100 per feed)
- ⚠️ Content often in HTML format (need to extract text)
- ⚠️ Rate limiting based on User-Agent and IP

**Sources:**
- [RSS 2.0 Specification](https://www.rssboard.org/rss-draft-1)
- [Atom Specification](https://datatracker.ietf.org/doc/html/rfc4287)
- [RSS Parser GitHub](https://github.com/rbren/rss-parser)

---

## Task 1: Feed Source Configuration Schema

**Files:**
- Modify: `packages/types/src/index.ts` (add after IngestionEvent interface)

**Step 1: Write failing test for FeedSourceConfig type**

Create: `packages/types/src/index.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { FeedSourceConfig } from "./index";

describe("FeedSourceConfig", () => {
	test("should accept valid feed configuration", () => {
		const config: FeedSourceConfig = {
			url: "https://www.reddit.com/r/programming/.rss",
			name: "Reddit r/programming",
		};
		expect(config.url).toBe("https://www.reddit.com/r/programming/.rss");
		expect(config.name).toBe("Reddit r/programming");
	});

	test("should accept feed with custom user agent", () => {
		const config: FeedSourceConfig = {
			url: "https://news.ycombinator.com/rss",
			name: "Hacker News",
			customUserAgent: "my-bot/1.0",
		};
		expect(config.customUserAgent).toBe("my-bot/1.0");
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/types
bun test
```

Expected: FAIL with "Cannot find module './index.test.ts'"

**Step 3: Add FeedSourceConfig type to index.ts**

In `packages/types/src/index.ts`, add after IngestionEvent interface:

```typescript
// RSS/Atom feed source configuration
export interface FeedSourceConfig {
	url: string; // RSS/Atom feed URL
	name: string; // Display name for the feed (e.g., "Reddit r/programming", "Hacker News")
	customUserAgent?: string; // Optional custom User-Agent for specific feeds
}
```

**Step 4: Run test to verify it passes**

```bash
cd packages/types
bun test
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add packages/types/src/index.ts packages/types/src/index.test.ts
git commit -m "feat(types): add feed source configuration type

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: RSS/Atom Parser Utility

**Files:**
- Create: `apps/ingestion-feeds/src/lib/feed-parser.ts`
- Create: `apps/ingestion-feeds/src/lib/feed-parser.test.ts`

**Step 1: Write failing test for RSS and Atom parsing**

Create: `apps/ingestion-feeds/src/lib/feed-parser.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { FeedParser, type FeedItem } from "./feed-parser";

describe("FeedParser - RSS 2.0", () => {
	const parser = new FeedParser();

	test("should parse RSS 2.0 feed", () => {
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

		const items = parser.parse(xml);

		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Test Post");
		expect(items[0].link).toBe("https://example.com/post");
		expect(items[0].id).toBe("post-123");
		expect(items[0].publishedAt).toBe("Mon, 20 Jan 2026 10:30:00 +0000");
		expect(items[0].author).toBe("Test Author");
		expect(items[0].content).toContain("Post content");
	});

	test("should handle Reddit RSS format", () => {
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

		const items = parser.parse(xml);
		expect(items[0].author).toBe("/u/testuser");
		expect(items[0].id).toBe("https://www.reddit.com/r/test/comments/abc123/");
	});
});

describe("FeedParser - Atom", () => {
	const parser = new FeedParser();

	test("should parse Atom feed", () => {
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

		const items = parser.parse(xml);

		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Atom Post");
		expect(items[0].link).toBe("https://example.com/atom-post");
		expect(items[0].id).toBe("atom-post-456");
		expect(items[0].publishedAt).toBe("2026-01-20T10:30:00Z");
		expect(items[0].author).toBe("Atom Author");
		expect(items[0].content).toContain("Atom content");
	});
});

describe("FeedParser - Edge Cases", () => {
	const parser = new FeedParser();

	test("should handle empty feed", () => {
		const xml = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
		const items = parser.parse(xml);
		expect(items).toEqual([]);
	});

	test("should handle missing optional fields", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Minimal Post</title>
      <link>https://example.com/minimal</link>
    </item>
  </channel>
</rss>`;

		const items = parser.parse(xml);
		expect(items).toHaveLength(1);
		expect(items[0].title).toBe("Minimal Post");
		expect(items[0].link).toBe("https://example.com/minimal");
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Cannot find module './feed-parser'"

**Step 3: Implement feed parser**

Create: `apps/ingestion-feeds/src/lib/feed-parser.ts`

```typescript
export interface FeedItem {
	title: string;
	link: string;
	id: string;
	publishedAt: string;
	author?: string;
	content: string;
}

export class FeedParser {
	parse(xml: string): FeedItem[] {
		// Detect feed type
		if (xml.includes("<feed") && xml.includes("xmlns")) {
			return this.parseAtom(xml);
		}
		return this.parseRss(xml);
	}

	private parseRss(xml: string): FeedItem[] {
		const items: FeedItem[] = [];
		const itemMatches = xml.matchAll(/<item>(.*?)<\/item>/gs);

		for (const match of itemMatches) {
			const itemXml = match[1];

			const title = this.extractTag(itemXml, "title") || "";
			const link = this.extractTag(itemXml, "link") || "";
			const id = this.extractTag(itemXml, "guid") || link;
			const publishedAt = this.extractTag(itemXml, "pubDate") || "";
			const author = this.extractAuthor(itemXml, "author");
			const content = this.extractCDATA(itemXml, "description") || "";

			items.push({
				title,
				link,
				id,
				publishedAt,
				author,
				content,
			});
		}

		return items;
	}

	private parseAtom(xml: string): FeedItem[] {
		const items: FeedItem[] = [];
		const entryMatches = xml.matchAll(/<entry>(.*?)<\/entry>/gs);

		for (const match of entryMatches) {
			const entryXml = match[1];

			const title = this.extractTag(entryXml, "title") || "";
			const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/);
			const link = linkMatch ? linkMatch[1] : "";
			const id = this.extractTag(entryXml, "id") || link;
			const publishedAt = this.extractTag(entryXml, "updated") || this.extractTag(entryXml, "published") || "";
			const authorNameMatch = entryXml.match(/<author>.*?<name>([^<]+)<\/name>.*?<\/author>/s);
			const author = authorNameMatch ? authorNameMatch[1] : undefined;
			const content = this.extractCDATA(entryXml, "content") || this.extractCDATA(entryXml, "summary") || "";

			items.push({
				title,
				link,
				id,
				publishedAt,
				author,
				content,
			});
		}

		return items;
	}

	private extractTag(xml: string, tagName: string): string | undefined {
		const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, "i");
		const match = xml.match(regex);
		return match ? match[1].trim() : undefined;
	}

	private extractCDATA(xml: string, tagName: string): string | undefined {
		// Handle CDATA sections
		const cdataRegex = new RegExp(
			`<${tagName}[^>]*><!\\[CDATA\\[(.*?)\\]\\]><\/${tagName}>`,
			"is",
		);
		const cdataMatch = xml.match(cdataRegex);
		if (cdataMatch) {
			return cdataMatch[1].trim();
		}

		// Fallback to regular tag extraction
		return this.extractTag(xml, tagName);
	}

	private extractAuthor(xml: string, tagName: string): string | undefined {
		const authorText = this.extractTag(xml, tagName);
		if (!authorText) return undefined;

		// Handle "email (Name)" format
		const nameMatch = authorText.match(/\(([^)]+)\)/);
		if (nameMatch) {
			return nameMatch[1];
		}

		return authorText;
	}
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/lib/feed-parser.ts apps/ingestion-feeds/src/lib/feed-parser.test.ts
git commit -m "feat(ingestion-feeds): implement RSS/Atom parser

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: HTML to Text Utility

**Files:**
- Create: `apps/ingestion-feeds/src/lib/html-to-text.ts`
- Create: `apps/ingestion-feeds/src/lib/html-to-text.test.ts`

**Step 1: Write failing test for HTML stripping**

Create: `apps/ingestion-feeds/src/lib/html-to-text.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { htmlToText } from "./html-to-text";

describe("htmlToText", () => {
	test("should strip HTML tags", () => {
		const html = "<p>This is <strong>bold</strong> text.</p>";
		const text = htmlToText(html);
		expect(text).toBe("This is bold text.");
	});

	test("should decode HTML entities", () => {
		const html = "<p>Quotes: &quot;hello&quot; and &amp; symbol</p>";
		const text = htmlToText(html);
		expect(text).toBe('Quotes: "hello" and & symbol');
	});

	test("should handle line breaks", () => {
		const html = "<p>Line 1</p><p>Line 2</p>";
		const text = htmlToText(html);
		expect(text).toBe("Line 1\n\nLine 2");
	});

	test("should handle links", () => {
		const html = '<a href="https://example.com">Link text</a>';
		const text = htmlToText(html);
		expect(text).toBe("Link text");
	});

	test("should handle empty or whitespace-only content", () => {
		expect(htmlToText("")).toBe("");
		expect(htmlToText("   ")).toBe("");
		expect(htmlToText("<p></p>")).toBe("");
	});

	test("should preserve code blocks", () => {
		const html =
			"<p>Check out this code:</p><pre><code>const x = 42;</code></pre><p>Pretty cool!</p>";
		const text = htmlToText(html);
		expect(text).toContain("Check out this code:");
		expect(text).toContain("const x = 42;");
		expect(text).toContain("Pretty cool!");
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Cannot find module './html-to-text'"

**Step 3: Implement HTML to text converter**

Create: `apps/ingestion-feeds/src/lib/html-to-text.ts`

```typescript
export function htmlToText(html: string): string {
	if (!html) return "";

	let text = html;

	// Replace block elements with newlines
	text = text.replace(/<\/p>/gi, "\n\n");
	text = text.replace(/<br\s*\/?>/gi, "\n");
	text = text.replace(/<\/div>/gi, "\n");
	text = text.replace(/<\/h[1-6]>/gi, "\n\n");
	text = text.replace(/<\/li>/gi, "\n");

	// Remove all remaining HTML tags
	text = text.replace(/<[^>]+>/g, "");

	// Decode common HTML entities
	text = text.replace(/&quot;/g, '"');
	text = text.replace(/&amp;/g, "&");
	text = text.replace(/&lt;/g, "<");
	text = text.replace(/&gt;/g, ">");
	text = text.replace(/&nbsp;/g, " ");
	text = text.replace(/&#39;/g, "'");
	text = text.replace(/&apos;/g, "'");

	// Clean up whitespace
	text = text.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines
	text = text.replace(/[ \t]+/g, " "); // Collapse spaces
	text = text.trim();

	return text;
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/lib/html-to-text.ts apps/ingestion-feeds/src/lib/html-to-text.test.ts
git commit -m "feat(ingestion-feeds): add HTML to text converter

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Feed Client

**Files:**
- Create: `apps/ingestion-feeds/src/lib/feed-client.ts`
- Create: `apps/ingestion-feeds/src/lib/feed-client.test.ts`

**Step 1: Write failing test for feed fetching**

Create: `apps/ingestion-feeds/src/lib/feed-client.test.ts`

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Cannot find module './feed-client'"

**Step 3: Implement FeedClient**

Create: `apps/ingestion-feeds/src/lib/feed-client.ts`

```typescript
import { FeedParser, type FeedItem } from "./feed-parser";
import { htmlToText } from "./html-to-text";

export interface FeedClientConfig {
	defaultUserAgent: string;
}

export interface FeedPost {
	id: string;
	title: string;
	content: string;
	url: string;
	author?: string;
	publishedAt: string;
}

export class FeedClient {
	private parser: FeedParser;
	private config: FeedClientConfig;

	constructor(config: FeedClientConfig) {
		this.config = config;
		this.parser = new FeedParser();
	}

	async fetchFeed(feedUrl: string, customUserAgent?: string): Promise<FeedPost[]> {
		const response = await fetch(feedUrl, {
			headers: {
				"User-Agent": customUserAgent || this.config.defaultUserAgent,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch feed from ${feedUrl}: ${response.status} ${response.statusText}`,
			);
		}

		const xml = await response.text();
		const items = this.parser.parse(xml);

		return items.map((item) => this.transformItem(item));
	}

	private transformItem(item: FeedItem): FeedPost {
		// Convert HTML content to plain text
		const content = htmlToText(item.content);

		return {
			id: item.id,
			title: item.title,
			content,
			url: item.link,
			author: item.author,
			publishedAt: item.publishedAt,
		};
	}
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/lib/feed-client.ts apps/ingestion-feeds/src/lib/feed-client.test.ts
git commit -m "feat(ingestion-feeds): implement feed client

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Checkpoint Service

**Files:**
- Create: `apps/ingestion-feeds/src/services/checkpoint-service.ts`
- Create: `apps/ingestion-feeds/src/services/checkpoint-service.test.ts`

**Step 1: Write failing test for checkpoint storage**

Create: `apps/ingestion-feeds/src/services/checkpoint-service.test.ts`

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { CheckpointService } from "./checkpoint-service";

describe("CheckpointService", () => {
	let service: CheckpointService;
	let mockKV: KVNamespace;

	beforeEach(() => {
		mockKV = {
			get: mock(() => Promise.resolve(null)),
			put: mock(() => Promise.resolve()),
		} as any;

		service = new CheckpointService(mockKV);
	});

	test("should get checkpoint for a feed", async () => {
		(mockKV.get as any).mockResolvedValueOnce(
			JSON.stringify({
				lastPublishedAt: "Mon, 20 Jan 2026 10:00:00 +0000",
				lastFetchedAt: "2026-01-20T11:00:00Z",
			}),
		);

		const checkpoint = await service.getCheckpoint("feed-123");

		expect(checkpoint).toEqual({
			lastPublishedAt: "Mon, 20 Jan 2026 10:00:00 +0000",
			lastFetchedAt: "2026-01-20T11:00:00Z",
		});
		expect(mockKV.get).toHaveBeenCalledWith("checkpoint:feed:feed-123");
	});

	test("should return null for missing checkpoint", async () => {
		const checkpoint = await service.getCheckpoint("new-feed");
		expect(checkpoint).toBeNull();
	});

	test("should save checkpoint", async () => {
		await service.saveCheckpoint("feed-456", {
			lastPublishedAt: "Mon, 20 Jan 2026 11:00:00 +0000",
			lastFetchedAt: "2026-01-20T12:00:00Z",
		});

		expect(mockKV.put).toHaveBeenCalledWith(
			"checkpoint:feed:feed-456",
			JSON.stringify({
				lastPublishedAt: "Mon, 20 Jan 2026 11:00:00 +0000",
				lastFetchedAt: "2026-01-20T12:00:00Z",
			}),
		);
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Cannot find module './checkpoint-service'"

**Step 3: Implement CheckpointService**

Create: `apps/ingestion-feeds/src/services/checkpoint-service.ts`

```typescript
export interface Checkpoint {
	lastPublishedAt: string; // Feed pubDate/updated timestamp of last processed post
	lastFetchedAt: string; // ISO timestamp when we last fetched
}

export class CheckpointService {
	constructor(private kv: KVNamespace) {}

	async getCheckpoint(feedId: string): Promise<Checkpoint | null> {
		const key = `checkpoint:feed:${feedId}`;
		const value = await this.kv.get(key);

		if (!value) {
			return null;
		}

		return JSON.parse(value) as Checkpoint;
	}

	async saveCheckpoint(feedId: string, checkpoint: Checkpoint): Promise<void> {
		const key = `checkpoint:feed:${feedId}`;
		await this.kv.put(key, JSON.stringify(checkpoint));
	}
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/services/checkpoint-service.ts apps/ingestion-feeds/src/services/checkpoint-service.test.ts
git commit -m "feat(ingestion-feeds): add checkpoint service

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Source Configuration Repository

**Files:**
- Create: `apps/ingestion-feeds/src/repositories/source-config-repository.ts`
- Create: `apps/ingestion-feeds/src/repositories/source-config-repository.test.ts`

**Step 1: Write failing test for loading source configs**

Create: `apps/ingestion-feeds/src/repositories/source-config-repository.test.ts`

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";
import { SourceConfigRepository } from "./source-config-repository";

describe("SourceConfigRepository", () => {
	let db: ReturnType<typeof createMockDB>;
	let repo: SourceConfigRepository;

	beforeEach(async () => {
		db = createMockDB();
		repo = new SourceConfigRepository(db);

		await db.exec(`
			CREATE TABLE IF NOT EXISTS source_configs (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL,
				config TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1
			)
		`);
	});

	test("should load active feed source configurations", async () => {
		await db.exec(`
			INSERT INTO source_configs (id, type, config, enabled)
			VALUES
				('feed-1', 'feed', '${JSON.stringify({
					url: "https://www.reddit.com/r/programming/.rss",
					name: "Reddit r/programming",
				})}', 1),
				('feed-2', 'feed', '${JSON.stringify({
					url: "https://news.ycombinator.com/rss",
					name: "Hacker News",
				})}', 1),
				('feed-3', 'feed', '${JSON.stringify({
					url: "https://disabled.com/feed",
					name: "Disabled Feed",
				})}', 0)
		`);

		const configs = await repo.getActiveConfigs();

		expect(configs).toHaveLength(2);
		expect(configs[0].config.url).toBe("https://www.reddit.com/r/programming/.rss");
		expect(configs[1].config.url).toBe("https://news.ycombinator.com/rss");
	});

	test("should return empty array when no configs exist", async () => {
		const configs = await repo.getActiveConfigs();
		expect(configs).toEqual([]);
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Cannot find module './source-config-repository'"

**Step 3: Implement SourceConfigRepository**

Create: `apps/ingestion-feeds/src/repositories/source-config-repository.ts`

```typescript
import type { FeedSourceConfig } from "@trend-monitor/types";

export interface SourceConfigRow {
	id: string;
	config: FeedSourceConfig;
}

export class SourceConfigRepository {
	constructor(private db: D1Database) {}

	async getActiveConfigs(): Promise<SourceConfigRow[]> {
		const result = await this.db
			.prepare("SELECT id, config FROM source_configs WHERE type = ? AND enabled = 1")
			.bind("feed")
			.all<{ id: string; config: string }>();

		return result.results.map((row) => ({
			id: row.id,
			config: JSON.parse(row.config) as FeedSourceConfig,
		}));
	}
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/repositories/source-config-repository.ts apps/ingestion-feeds/src/repositories/source-config-repository.test.ts
git commit -m "feat(ingestion-feeds): add source config repository

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Ingestion Service - Post Transformation

**Files:**
- Create: `apps/ingestion-feeds/src/services/ingestion-service.ts`
- Create: `apps/ingestion-feeds/src/services/ingestion-service.test.ts`

**Step 1: Write failing test for transforming posts to IngestionEvents**

Create: `apps/ingestion-feeds/src/services/ingestion-service.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { IngestionService } from "./ingestion-service";
import { Source } from "@trend-monitor/types";
import type { FeedPost } from "../lib/feed-client";

describe("IngestionService", () => {
	const service = new IngestionService();

	test("should transform feed post to IngestionEvent", () => {
		const post: FeedPost = {
			id: "post-123",
			title: "How to use Cloudflare Workers",
			content: "Here's a detailed guide on Cloudflare Workers and D1 database",
			url: "https://blog.example.com/cloudflare-workers",
			author: "Tech Blogger",
			publishedAt: "Mon, 20 Jan 2026 12:00:00 +0000",
		};

		const event = service.transformPost(post, "https://blog.example.com/rss");

		expect(event.source).toBe(Source.Feed);
		expect(event.sourceId).toBe("post-123");
		expect(event.title).toBe("How to use Cloudflare Workers");
		expect(event.content).toBe("Here's a detailed guide on Cloudflare Workers and D1 database");
		expect(event.url).toBe("https://blog.example.com/cloudflare-workers");
		expect(event.author).toBe("Tech Blogger");
		expect(event.createdAt).toBe("2026-01-20T12:00:00.000Z");
		expect(event.metadata).toEqual({
			feedUrl: "https://blog.example.com/rss",
		});
	});

	test("should parse ISO timestamp from Atom feed", () => {
		const post: FeedPost = {
			id: "atom-456",
			title: "Test",
			content: "Test content",
			url: "https://example.com/post",
			publishedAt: "2026-01-15T08:30:45Z",
		};

		const event = service.transformPost(post, "https://example.com/atom");

		expect(event.createdAt).toBe("2026-01-15T08:30:45.000Z");
	});

	test("should parse RSS pubDate format", () => {
		const post: FeedPost = {
			id: "rss-789",
			title: "Test",
			content: "Test content",
			url: "https://example.com/post",
			publishedAt: "Wed, 15 Jan 2026 08:30:45 +0000",
		};

		const event = service.transformPost(post, "https://example.com/rss");

		expect(event.createdAt).toBe("2026-01-15T08:30:45.000Z");
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Cannot find module './ingestion-service'"

**Step 3: Implement IngestionService transformation**

Create: `apps/ingestion-feeds/src/services/ingestion-service.ts`

```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";
import type { FeedPost } from "../lib/feed-client";

export class IngestionService {
	transformPost(post: FeedPost, feedUrl: string): IngestionEvent {
		return {
			source: Source.Feed,
			sourceId: post.id,
			title: post.title,
			content: post.content,
			url: post.url,
			author: post.author,
			createdAt: this.parseDate(post.publishedAt),
			fetchedAt: new Date().toISOString(),
			metadata: {
				feedUrl,
			},
		};
	}

	private parseDate(dateString: string): string {
		// Handles both RSS (RFC 822) and Atom (ISO 8601) formats
		return new Date(dateString).toISOString();
	}
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/services/ingestion-service.ts apps/ingestion-feeds/src/services/ingestion-service.test.ts
git commit -m "feat(ingestion-feeds): add post transformation to IngestionEvent

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Ingestion Service - Process Feed with Checkpointing

**Files:**
- Modify: `apps/ingestion-feeds/src/services/ingestion-service.ts`
- Modify: `apps/ingestion-feeds/src/services/ingestion-service.test.ts`

**Step 1: Write failing test for processing a feed**

Add to `apps/ingestion-feeds/src/services/ingestion-service.test.ts`:

```typescript
import { mock } from "bun:test";
import type { FeedClient } from "../lib/feed-client";
import type { CheckpointService, Checkpoint } from "./checkpoint-service";

describe("IngestionService - Process Feed", () => {
	test("should process feed and return new posts only", async () => {
		const mockClient: FeedClient = {
			fetchFeed: mock(() =>
				Promise.resolve([
					{
						id: "new-post",
						title: "New Post",
						content: "New content",
						url: "https://example.com/new",
						publishedAt: "Mon, 20 Jan 2026 12:00:00 +0000",
					},
					{
						id: "old-post",
						title: "Old Post",
						content: "Old content",
						url: "https://example.com/old",
						publishedAt: "Mon, 20 Jan 2026 10:00:00 +0000",
					},
				]),
			),
		} as any;

		const checkpoint: Checkpoint = {
			lastPublishedAt: "Mon, 20 Jan 2026 11:00:00 +0000",
			lastFetchedAt: "2026-01-20T11:00:00Z",
		};

		const mockCheckpointService: CheckpointService = {
			getCheckpoint: mock(() => Promise.resolve(checkpoint)),
			saveCheckpoint: mock(() => Promise.resolve()),
		} as any;

		const service = new IngestionService();
		const result = await service.processFeed(
			"feed-123",
			"https://example.com/rss",
			mockClient,
			mockCheckpointService,
		);

		expect(result.events).toHaveLength(1);
		expect(result.events[0].sourceId).toBe("new-post");
		expect(result.newCheckpoint?.lastPublishedAt).toBe("Mon, 20 Jan 2026 12:00:00 +0000");

		expect(mockCheckpointService.saveCheckpoint).toHaveBeenCalledWith(
			"feed-123",
			expect.objectContaining({ lastPublishedAt: "Mon, 20 Jan 2026 12:00:00 +0000" }),
		);
	});

	test("should process all posts when no checkpoint exists", async () => {
		const mockClient: FeedClient = {
			fetchFeed: mock(() =>
				Promise.resolve([
					{
						id: "post-1",
						title: "Post 1",
						content: "Content 1",
						url: "https://example.com/1",
						publishedAt: "Mon, 20 Jan 2026 12:00:00 +0000",
					},
				]),
			),
		} as any;

		const mockCheckpointService: CheckpointService = {
			getCheckpoint: mock(() => Promise.resolve(null)),
			saveCheckpoint: mock(() => Promise.resolve()),
		} as any;

		const service = new IngestionService();
		const result = await service.processFeed(
			"new-feed",
			"https://example.com/rss",
			mockClient,
			mockCheckpointService,
		);

		expect(result.events).toHaveLength(1);
	});

	test("should return empty events if no new posts", async () => {
		const mockClient: FeedClient = {
			fetchFeed: mock(() =>
				Promise.resolve([
					{
						id: "old-post",
						title: "Old",
						content: "Old content",
						url: "https://example.com/old",
						publishedAt: "Mon, 20 Jan 2026 09:00:00 +0000",
					},
				]),
			),
		} as any;

		const checkpoint: Checkpoint = {
			lastPublishedAt: "Mon, 20 Jan 2026 10:00:00 +0000",
			lastFetchedAt: "2026-01-20T10:00:00Z",
		};

		const mockCheckpointService: CheckpointService = {
			getCheckpoint: mock(() => Promise.resolve(checkpoint)),
			saveCheckpoint: mock(() => Promise.resolve()),
		} as any;

		const service = new IngestionService();
		const result = await service.processFeed(
			"feed-456",
			"https://example.com/rss",
			mockClient,
			mockCheckpointService,
		);

		expect(result.events).toEqual([]);
		expect(result.newCheckpoint).toBeNull();
	});

	test("should use custom user agent from config", async () => {
		const mockClient: FeedClient = {
			fetchFeed: mock(() => Promise.resolve([])),
		} as any;

		const mockCheckpointService: CheckpointService = {
			getCheckpoint: mock(() => Promise.resolve(null)),
			saveCheckpoint: mock(() => Promise.resolve()),
		} as any;

		const service = new IngestionService();
		await service.processFeed(
			"custom-feed",
			"https://example.com/rss",
			mockClient,
			mockCheckpointService,
			"custom-bot/1.0",
		);

		expect(mockClient.fetchFeed).toHaveBeenCalledWith(
			"https://example.com/rss",
			"custom-bot/1.0",
		);
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL with "Property 'processFeed' does not exist"

**Step 3: Implement processFeed method**

Modify `apps/ingestion-feeds/src/services/ingestion-service.ts`:

```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";
import type { FeedPost, FeedClient } from "../lib/feed-client";
import type { CheckpointService, Checkpoint } from "./checkpoint-service";

interface ProcessResult {
	events: IngestionEvent[];
	newCheckpoint: Checkpoint | null;
}

export class IngestionService {
	transformPost(post: FeedPost, feedUrl: string): IngestionEvent {
		// ... existing code ...
	}

	private parseDate(dateString: string): string {
		// ... existing code ...
	}

	async processFeed(
		feedId: string,
		feedUrl: string,
		client: FeedClient,
		checkpointService: CheckpointService,
		customUserAgent?: string,
	): Promise<ProcessResult> {
		// Get checkpoint
		const checkpoint = await checkpointService.getCheckpoint(feedId);

		// Fetch posts from feed
		const posts = await client.fetchFeed(feedUrl, customUserAgent);

		// Filter posts newer than checkpoint
		let newPosts = posts;
		if (checkpoint) {
			const checkpointDate = new Date(checkpoint.lastPublishedAt);
			newPosts = posts.filter((post) => {
				const postDate = new Date(post.publishedAt);
				return postDate > checkpointDate;
			});
		}

		// Transform to events
		const events = newPosts.map((post) => this.transformPost(post, feedUrl));

		// Update checkpoint if we got new posts
		let newCheckpoint: Checkpoint | null = null;
		if (newPosts.length > 0) {
			// Find the most recent post
			const mostRecent = newPosts.reduce((latest, post) => {
				const latestDate = new Date(latest.publishedAt);
				const postDate = new Date(post.publishedAt);
				return postDate > latestDate ? post : latest;
			});

			newCheckpoint = {
				lastPublishedAt: mostRecent.publishedAt,
				lastFetchedAt: new Date().toISOString(),
			};

			await checkpointService.saveCheckpoint(feedId, newCheckpoint);
		}

		return {
			events,
			newCheckpoint,
		};
	}
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/services/ingestion-service.ts apps/ingestion-feeds/src/services/ingestion-service.test.ts
git commit -m "feat(ingestion-feeds): add feed processing with checkpointing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Main Worker - Scheduled Handler

**Files:**
- Modify: `apps/ingestion-feeds/src/index.ts`
- Create: `apps/ingestion-feeds/src/index.test.ts`

**Step 1: Write failing integration test for scheduled handler**

Create: `apps/ingestion-feeds/src/index.test.ts`

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";
import worker from "./index";

describe("Feed Ingestion Worker", () => {
	let mockEnv: any;
	let mockCtx: ExecutionContext;

	beforeEach(async () => {
		const db = createMockDB();

		await db.exec(`
			CREATE TABLE IF NOT EXISTS source_configs (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL,
				config TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1
			)
		`);

		await db.exec(`
			INSERT INTO source_configs (id, type, config, enabled)
			VALUES ('feed-test', 'feed', '${JSON.stringify({
				url: "https://example.com/rss",
				name: "Test Feed",
			})}', 1)
		`);

		mockEnv = {
			DB: db,
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
		expect(queueCall[0].sourceId).toBe("article-123");
		expect(queueCall[0].title).toBe("Great Article");

		globalThis.fetch = originalFetch;
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: FAIL (worker not fully implemented)

**Step 3: Implement scheduled handler**

Modify `apps/ingestion-feeds/src/index.ts`:

```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "./lib/feed-client";
import { SourceConfigRepository } from "./repositories/source-config-repository";
import { CheckpointService } from "./services/checkpoint-service";
import { IngestionService } from "./services/ingestion-service";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log("Feed ingestion running at:", new Date().toISOString());

		try {
			// Initialize services
			const feedClient = new FeedClient({
				defaultUserAgent: env.FEED_USER_AGENT,
			});

			const configRepo = new SourceConfigRepository(env.DB);
			const checkpointService = new CheckpointService(env.CHECKPOINT);
			const ingestionService = new IngestionService();

			// Load active source configurations
			const configs = await configRepo.getActiveConfigs();

			if (configs.length === 0) {
				console.log("No active feed source configurations found");
				return;
			}

			console.log(`Processing ${configs.length} feed(s)`);

			// Process each feed and collect events
			const allEvents: IngestionEvent[] = [];

			for (const configRow of configs) {
				try {
					const result = await ingestionService.processFeed(
						configRow.id,
						configRow.config.url,
						feedClient,
						checkpointService,
						configRow.config.customUserAgent,
					);

					allEvents.push(...result.events);

					console.log(
						`Processed ${configRow.config.name}: ${result.events.length} new posts, checkpoint: ${result.newCheckpoint?.lastPublishedAt || "none"}`,
					);
				} catch (err) {
					console.error(`Failed to process feed ${configRow.config.name}:`, err);
					// Continue with other feeds
				}
			}

			// Send events to queue in batch
			if (allEvents.length > 0) {
				await env.INGESTION_QUEUE.sendBatch(allEvents);
				console.log(`Published ${allEvents.length} events to ingestion queue`);
			} else {
				console.log("No new posts found");
			}
		} catch (err) {
			console.error("Feed ingestion failed:", err);
			throw err;
		}
	},
};
```

**Step 4: Run test to verify it passes**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add apps/ingestion-feeds/src/index.ts apps/ingestion-feeds/src/index.test.ts
git commit -m "feat(ingestion-feeds): implement scheduled handler

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Configuration and Documentation

**Files:**
- Modify: `apps/ingestion-feeds/wrangler.toml`
- Create: `apps/ingestion-feeds/README.md`

**Step 1: Update wrangler.toml**

Modify `apps/ingestion-feeds/wrangler.toml`:

```toml
name = "trend-monitor-ingestion-feeds"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[dev]
port = 8789
inspector_port = 9234

[triggers]
crons = ["*/15 * * * *"]

[[queues.producers]]
queue = "ingestion-queue"
binding = "INGESTION_QUEUE"

[[d1_databases]]
binding = "DB"
database_name = "trend-monitor-local"
database_id = "local"

[[kv_namespaces]]
binding = "CHECKPOINT"
id = "local"

[vars]
FEED_USER_AGENT = "trend-monitor-feed-ingestion/1.0 (Cloudflare Workers)"
```

**Step 2: Create comprehensive README**

Create: `apps/ingestion-feeds/README.md`

```markdown
# Feed Ingestion Worker

Universal RSS/Atom feed ingestion worker for monitoring Reddit, X/Twitter, Hacker News, blogs, and any feed source.

## Features

- ✅ **No authentication required** - Works with any public RSS/Atom feed
- ✅ **Multi-source support** - Reddit, X/Twitter, Hacker News, blogs, news sites
- ✅ **RSS 2.0 and Atom 1.0** - Handles both feed formats automatically
- ✅ **Incremental fetching** - KV-based checkpoints track last processed post
- ✅ **HTML to plain text** - Automatically converts feed content
- ✅ **Custom user agents** - Per-feed user agent configuration

## Supported Sources

### Reddit Subreddits
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-reddit-programming', 'feed', '{
  "url": "https://www.reddit.com/r/programming/.rss",
  "name": "Reddit r/programming"
}', 1);
```

### Hacker News
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-hackernews', 'feed', '{
  "url": "https://news.ycombinator.com/rss",
  "name": "Hacker News"
}', 1);
```

### X/Twitter Accounts
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-x-trq212', 'feed', '{
  "url": "https://rss.xcancel.com/trq212/rss",
  "name": "X @trq212"
}', 1);
```

### Blogs/Websites
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-cloudflare-blog', 'feed', '{
  "url": "https://blog.cloudflare.com/rss/",
  "name": "Cloudflare Blog"
}', 1);
```

### Custom User Agent (if needed)
```sql
INSERT INTO source_configs (id, type, config, enabled) VALUES
('feed-custom', 'feed', '{
  "url": "https://example.com/feed.xml",
  "name": "Custom Feed",
  "customUserAgent": "my-bot/1.0"
}', 1);
```

## Setup

### Local Development

```bash
bun run dev
```

### Testing

```bash
bun test
```

### Deployment

```bash
bun run deploy
```

## How It Works

1. **Cron triggers** worker every 15 minutes
2. **Loads active configs** from D1 `source_configs` table
3. **For each feed:**
   - Fetches RSS/Atom XML
   - Parses with automatic format detection
   - Loads checkpoint (last processed post timestamp)
   - Filters posts newer than checkpoint
   - Transforms to `IngestionEvent` format
   - Updates checkpoint
4. **Publishes events** to ingestion queue in batch

## Monitoring

View worker logs:

```bash
wrangler tail
```

Check queue:

```bash
wrangler queues consumer list ingestion-queue
```

## Troubleshooting

**No events published**
- Check configs: `SELECT * FROM source_configs WHERE type = 'feed' AND enabled = 1`
- Verify feed URLs are accessible
- Check worker logs for errors

**Feed fetch errors**
- Some sites block automated requests
- Try custom User-Agent in config
- Verify feed URL returns valid XML

**Parsing errors**
- Worker supports RSS 2.0 and Atom 1.0
- Check feed format: `curl https://example.com/feed.xml`
- Report unsupported formats as issues

## Recommended Feeds

**Tech News:**
- Hacker News: `https://news.ycombinator.com/rss`
- TechCrunch: `https://techcrunch.com/feed/`
- The Verge: `https://www.theverge.com/rss/index.xml`

**X/Twitter Accounts (via xcancel.com):**
- @trq212: `https://rss.xcancel.com/trq212/rss`
- Any account: `https://rss.xcancel.com/{username}/rss`

**Subreddits:**
- r/programming: `https://www.reddit.com/r/programming/.rss`
- r/webdev: `https://www.reddit.com/r/webdev/.rss`
- r/CloudFlare: `https://www.reddit.com/r/CloudFlare/.rss`

**Blogs:**
- Cloudflare: `https://blog.cloudflare.com/rss/`
- Vercel: `https://vercel.com/blog/feed`
```

**Step 3: Commit**

```bash
git add apps/ingestion-feeds/wrangler.toml apps/ingestion-feeds/README.md
git commit -m "docs(ingestion-feeds): add configuration and documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Database Migration

**Files:**
- Create: `apps/api-worker/migrations/0002_add_source_configs.sql`

**Step 1: Write migration SQL**

Create: `apps/api-worker/migrations/0002_add_source_configs.sql`

```sql
-- Create source_configs table for feed source configuration
CREATE TABLE IF NOT EXISTS source_configs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('feed', 'x')),
    config TEXT NOT NULL,  -- JSON string
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for querying by type
CREATE INDEX idx_source_configs_type ON source_configs(type);

-- Index for querying enabled configs
CREATE INDEX idx_source_configs_enabled ON source_configs(enabled);
```

**Step 2: Apply migration to local D1**

```bash
cd apps/api-worker
wrangler d1 execute trend-monitor-local --local --file migrations/0002_add_source_configs.sql
```

Expected: Migration applied successfully

**Step 3: Insert sample feed configurations**

```bash
cd apps/api-worker
wrangler d1 execute trend-monitor-local --local --command "
INSERT INTO source_configs (id, type, config, enabled) VALUES
  ('feed-reddit-programming', 'feed', '{\"url\":\"https://www.reddit.com/r/programming/.rss\",\"name\":\"Reddit r/programming\"}', 1),
  ('feed-hackernews', 'feed', '{\"url\":\"https://news.ycombinator.com/rss\",\"name\":\"Hacker News\"}', 1),
  ('feed-x-trq212', 'feed', '{\"url\":\"https://rss.xcancel.com/trq212/rss\",\"name\":\"X @trq212\"}', 1)
"
```

Expected: 3 rows inserted

**Step 4: Verify**

```bash
cd apps/api-worker
wrangler d1 execute trend-monitor-local --local --command "SELECT * FROM source_configs"
```

Expected: Returns 3 feed configurations

**Step 5: Commit**

```bash
git add apps/api-worker/migrations/0002_add_source_configs.sql
git commit -m "feat(db): add source_configs table migration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Integration Testing

**Files:**
- Create: `apps/ingestion-feeds/test/integration.test.ts`

**Step 1: Write end-to-end integration test**

Create: `apps/ingestion-feeds/test/integration.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { FeedClient } from "../src/lib/feed-client";
import { IngestionService } from "../src/services/ingestion-service";
import { CheckpointService } from "../src/services/checkpoint-service";

describe("Feed Ingestion Integration", () => {
	test("full flow: fetch RSS, filter by checkpoint, transform", async () => {
		const mockKV = {
			get: () => Promise.resolve(null),
			put: () => Promise.resolve(),
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
```

**Step 2: Run integration tests**

```bash
cd apps/ingestion-feeds
bun test test/integration.test.ts
```

Expected: PASS (2 tests)

**Step 3: Run all tests**

```bash
cd apps/ingestion-feeds
bun test
bun run typecheck
```

Expected: All tests passing, no type errors

**Step 4: Commit**

```bash
git add apps/ingestion-feeds/test/integration.test.ts
git commit -m "test(ingestion-feeds): add end-to-end integration tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Final Documentation

**Files:**
- Modify: `CLAUDE.md`
- Create: `apps/ingestion-feeds/DEPLOYMENT.md`

**Step 1: Update project CLAUDE.md**

Modify `CLAUDE.md`, update the "Project Status" section:

Find:
```markdown
- **Not yet implemented**: Ingestion workers, aggregator worker, web frontend
```

Replace with:
```markdown
- **Implemented**:
  - **Feed Ingestion Worker** - Universal RSS/Atom feed ingestion
    - No authentication required (public feeds)
    - Supports Reddit, Hacker News, blogs, any RSS/Atom feed
    - RSS 2.0 and Atom 1.0 format support
    - Incremental fetching with KV checkpoints
    - HTML to text conversion
    - Per-feed custom user agent support
    - Full test coverage (all tests passing)
- **Not yet implemented**: aggregator worker, web frontend
```

**Step 2: Create deployment guide**

Create: `apps/ingestion-feeds/DEPLOYMENT.md`

```markdown
# Feed Ingestion Worker - Deployment Guide

## Prerequisites

- Cloudflare account with Workers enabled
- D1 database created
- KV namespace for checkpoints
- Queue configured (`ingestion-queue`)

## Step 1: Database Setup

Apply migration:

```bash
cd apps/api-worker
wrangler d1 execute trend-monitor-production --file migrations/0002_add_source_configs.sql
```

## Step 2: Configure Feeds

Add feed sources to monitor:

```bash
wrangler d1 execute trend-monitor-production --command "
INSERT INTO source_configs (id, type, config, enabled) VALUES
  ('feed-reddit-programming', 'feed', '{\"url\":\"https://www.reddit.com/r/programming/.rss\",\"name\":\"Reddit r/programming\"}', 1),
  ('feed-reddit-webdev', 'feed', '{\"url\":\"https://www.reddit.com/r/webdev/.rss\",\"name\":\"Reddit r/webdev\"}', 1),
  ('feed-hackernews', 'feed', '{\"url\":\"https://news.ycombinator.com/rss\",\"name\":\"Hacker News\"}', 1),
  ('feed-x-trq212', 'feed', '{\"url\":\"https://rss.xcancel.com/trq212/rss\",\"name\":\"X @trq212\"}', 1),
  ('feed-cloudflare-blog', 'feed', '{\"url\":\"https://blog.cloudflare.com/rss/\",\"name\":\"Cloudflare Blog\"}', 1)
"
```

## Step 3: Deploy Worker

```bash
cd apps/ingestion-feeds
bun run deploy
```

## Step 4: Verify Deployment

```bash
wrangler deployments list
wrangler tail
```

## Step 5: Monitor Queue

```bash
wrangler queues consumer list ingestion-queue
```

## Recommended Feed Sources

### Tech News
- Hacker News: `https://news.ycombinator.com/rss`
- TechCrunch: `https://techcrunch.com/feed/`
- Ars Technica: `https://feeds.arstechnica.com/arstechnica/index`

### X/Twitter Accounts (via xcancel.com)
- @trq212: `https://rss.xcancel.com/trq212/rss`
- Any account: `https://rss.xcancel.com/{username}/rss`

### Reddit (Popular Tech Subreddits)
- r/programming: `https://www.reddit.com/r/programming/.rss`
- r/webdev: `https://www.reddit.com/r/webdev/.rss`
- r/javascript: `https://www.reddit.com/r/javascript/.rss`
- r/CloudFlare: `https://www.reddit.com/r/CloudFlare/.rss`

### Company Blogs
- Cloudflare: `https://blog.cloudflare.com/rss/`
- Vercel: `https://vercel.com/blog/feed`
- GitHub: `https://github.blog/feed/`

## Troubleshooting

**Worker not triggering:**
- Check cron: `wrangler deployments list`
- Verify schedule in wrangler.toml

**No events in queue:**
- Check logs: `wrangler tail`
- Test feed manually: `curl https://example.com/feed.xml`
- Verify feeds are valid XML

**Feed blocked:**
- Try custom User-Agent in config
- Some sites require specific user agents
```

**Step 3: Run final checks**

```bash
cd apps/ingestion-feeds
bun run test
bun run typecheck
bun run lint
```

Expected: All passing

**Step 4: Commit**

```bash
git add CLAUDE.md apps/ingestion-feeds/DEPLOYMENT.md
git commit -m "docs: update project status with feed ingestion worker

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] All 13 tasks completed
- [ ] All tests passing (`bun run test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Database migration created
- [ ] RSS 2.0 and Atom 1.0 support
- [ ] Integration tests validate full flow
- [ ] README and deployment guide complete
- [ ] CLAUDE.md updated

---

## Key Benefits of Generic Feed Worker

**Versatility:**
- ✅ Handles Reddit subreddits via RSS
- ✅ Handles X/Twitter accounts via xcancel.com RSS proxy (no API needed!)
- ✅ Handles Hacker News
- ✅ Handles any blog/news site with RSS/Atom
- ✅ Single worker for all feed sources
- ✅ Easy to add new sources (just configure URL)

**Simplicity:**
- No separate Reddit or X workers needed
- No authentication/API keys required (even for X/Twitter!)
- Standard feed formats (RSS 2.0, Atom 1.0)
- Automatic format detection

**Future-Proof:**
- Can add any RSS/Atom source
- Custom user agents per feed
- Flexible configuration

**X/Twitter Support:**
- ✅ No X API subscription needed
- ✅ Works via public RSS proxy (xcancel.com)
- ✅ Monitor any public X account
- ✅ Same checkpoint/deduplication logic as other feeds

---

## Next Steps

After implementing this plan:

1. **Deploy Worker**: Deploy to Cloudflare and verify cron triggers
2. **Configure Sources**: Add popular feeds (Reddit, X, HN, blogs) to `source_configs` table
3. **Monitor Queue**: Verify events flow to processor worker
4. **Add More Sources**: Expand monitoring to additional feeds and X accounts
5. **Implement Aggregator**: Daily stats aggregation worker
6. **Add Web Dashboard**: Frontend to visualize trends
