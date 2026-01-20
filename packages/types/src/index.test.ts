import { describe, expect, test } from "bun:test";
import type { FeedSourceConfig, IngestionEvent, Keyword } from "./index";
import { KeywordStatus, Source } from "./index";

describe("KeywordStatus enum", () => {
	test("has Active status", () => {
		expect(KeywordStatus.Active as string).toBe("active");
	});

	test("has Archived status", () => {
		expect(KeywordStatus.Archived as string).toBe("archived");
	});
});

describe("Source enum", () => {
	test("has all expected sources", () => {
		expect(Object.values(Source)).toEqual(expect.arrayContaining(["reddit", "x", "feed"]));
	});
});

describe("Keyword type", () => {
	test("creates valid keyword object", () => {
		const keyword: Keyword = {
			id: "1",
			name: "TypeScript",
			aliases: ["ts"],
			tags: ["language", "javascript"],
			status: KeywordStatus.Active,
			createdAt: "2026-01-16T00:00:00Z",
			updatedAt: "2026-01-16T00:00:00Z",
		};

		expect(keyword.name).toBe("TypeScript");
		expect(keyword.aliases).toEqual(["ts"]);
		expect(keyword.status).toBe(KeywordStatus.Active);
	});
});

describe("IngestionEvent type", () => {
	test("creates valid ingestion event", () => {
		const event: IngestionEvent = {
			source: Source.Reddit,
			sourceId: "abc123",
			title: "Test Post",
			content: "This is a test post about TypeScript",
			url: "https://reddit.com/r/typescript/abc123",
			author: "testuser",
			createdAt: "2026-01-16T00:00:00Z",
			fetchedAt: "2026-01-16T00:01:00Z",
		};

		expect(event.source).toBe(Source.Reddit);
		expect(event.sourceId).toBe("abc123");
		expect(event.title).toBe("Test Post");
	});

	test("handles optional metadata", () => {
		const event: IngestionEvent = {
			source: Source.X,
			sourceId: "tweet123",
			content: "TypeScript is awesome! #typescript",
			url: "https://x.com/user/status/123",
			createdAt: "2026-01-16T00:00:00Z",
			fetchedAt: "2026-01-16T00:01:00Z",
			metadata: {
				retweets: 42,
				likes: 100,
			},
		};

		expect(event.metadata).toBeDefined();
		expect(event.metadata?.retweets).toBe(42);
	});
});

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
