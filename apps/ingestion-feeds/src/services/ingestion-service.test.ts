import { describe, test, expect, mock } from "bun:test";
import { IngestionService } from "./ingestion-service";
import { Source } from "@trend-monitor/types";
import type { FeedPost } from "../lib/feed-client";
import type { FeedClient } from "../lib/feed-client";
import type { CheckpointService, Checkpoint } from "./checkpoint-service";

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
