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
