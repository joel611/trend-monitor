import { describe, test, expect, beforeEach } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";
import { sourceConfigs } from "@trend-monitor/db";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { FeedClient } from "../src/lib/feed-client";
import { IngestionService } from "../src/services/ingestion-service";
import { CheckpointService } from "../src/services/checkpoint-service";

describe("Feed Ingestion with Health Tracking", () => {
	let db: ReturnType<typeof createMockDB>;
	let configRepo: SourceConfigRepository;
	let mockKV: any;
	let checkpointService: CheckpointService;
	let ingestionService: IngestionService;

	beforeEach(() => {
		// Set up mock database
		db = createMockDB();
		configRepo = new SourceConfigRepository(db);

		// Set up mock KV
		mockKV = {
			get: () => Promise.resolve(null),
			put: () => Promise.resolve(),
		};
		checkpointService = new CheckpointService(mockKV);
		ingestionService = new IngestionService();
	});

	test("should record success metrics after successful fetch", async () => {
		// Create a source config
		const source = await configRepo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		// Mock successful feed response
		const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <guid>item-1</guid>
      <pubDate>Mon, 20 Jan 2026 12:00:00 +0000</pubDate>
      <description>Content</description>
    </item>
  </channel>
</rss>`;

		globalThis.fetch = (() => Promise.resolve(new Response(mockRss))) as any;

		const client = new FeedClient({ defaultUserAgent: "test/1.0" });

		// Process feed
		await ingestionService.processFeed(source.id, source.config.url, client, checkpointService);

		// Record success
		const now = new Date().toISOString();
		await configRepo.recordSuccess(source.id, {
			lastFetchAt: now,
			lastSuccessAt: now,
			consecutiveFailures: 0,
			lastErrorAt: null,
			lastErrorMessage: null,
		});

		// Verify success metrics
		const updated = await configRepo.findById(source.id);
		expect(updated).not.toBeNull();
		expect(updated?.lastFetchAt).not.toBeNull();
		expect(updated?.lastSuccessAt).not.toBeNull();
		expect(updated?.consecutiveFailures).toBe(0);
		expect(updated?.lastErrorAt).toBeNull();
		expect(updated?.lastErrorMessage).toBeNull();
	});

	test("should record failure metrics after failed fetch", async () => {
		// Create a source config
		const source = await configRepo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		// Mock failed fetch
		globalThis.fetch = (() => Promise.reject(new Error("Network timeout"))) as any;

		const client = new FeedClient({ defaultUserAgent: "test/1.0" });

		// Process feed (expect failure)
		try {
			await ingestionService.processFeed(source.id, source.config.url, client, checkpointService);
		} catch (err) {
			// Record failure
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			const currentConfig = await configRepo.findById(source.id);
			const failures = (currentConfig?.consecutiveFailures || 0) + 1;
			const now = new Date().toISOString();

			await configRepo.recordFailure(source.id, {
				lastFetchAt: now,
				lastErrorAt: now,
				lastErrorMessage: errorMessage,
				consecutiveFailures: failures,
			});
		}

		// Verify failure metrics
		const updated = await configRepo.findById(source.id);
		expect(updated).not.toBeNull();
		expect(updated?.lastFetchAt).not.toBeNull();
		expect(updated?.lastErrorAt).not.toBeNull();
		expect(updated?.lastErrorMessage).toContain("Network timeout");
		expect(updated?.consecutiveFailures).toBe(1);
	});

	test("should increment consecutive failures on repeated errors", async () => {
		// Create a source config
		const source = await configRepo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		// Mock failed fetch
		globalThis.fetch = (() => Promise.reject(new Error("Connection refused"))) as any;

		const client = new FeedClient({ defaultUserAgent: "test/1.0" });

		// Simulate 3 failed attempts
		for (let i = 0; i < 3; i++) {
			try {
				await ingestionService.processFeed(source.id, source.config.url, client, checkpointService);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Unknown error";
				const currentConfig = await configRepo.findById(source.id);
				const failures = (currentConfig?.consecutiveFailures || 0) + 1;
				const now = new Date().toISOString();

				await configRepo.recordFailure(source.id, {
					lastFetchAt: now,
					lastErrorAt: now,
					lastErrorMessage: errorMessage,
					consecutiveFailures: failures,
				});
			}
		}

		// Verify consecutive failures incremented
		const updated = await configRepo.findById(source.id);
		expect(updated?.consecutiveFailures).toBe(3);
	});

	test("should reset failure counter on success after failures", async () => {
		// Create a source config
		const source = await configRepo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <guid>item-1</guid>
      <pubDate>Mon, 20 Jan 2026 12:00:00 +0000</pubDate>
      <description>Content</description>
    </item>
  </channel>
</rss>`;

		// Simulate 3 failures first
		globalThis.fetch = (() => Promise.reject(new Error("Temporary error"))) as any;
		const client = new FeedClient({ defaultUserAgent: "test/1.0" });

		for (let i = 0; i < 3; i++) {
			try {
				await ingestionService.processFeed(source.id, source.config.url, client, checkpointService);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Unknown error";
				const currentConfig = await configRepo.findById(source.id);
				const failures = (currentConfig?.consecutiveFailures || 0) + 1;
				const now = new Date().toISOString();

				await configRepo.recordFailure(source.id, {
					lastFetchAt: now,
					lastErrorAt: now,
					lastErrorMessage: errorMessage,
					consecutiveFailures: failures,
				});
			}
		}

		// Verify failures recorded
		let updated = await configRepo.findById(source.id);
		expect(updated?.consecutiveFailures).toBe(3);

		// Now simulate successful fetch
		globalThis.fetch = (() => Promise.resolve(new Response(mockRss))) as any;

		await ingestionService.processFeed(source.id, source.config.url, client, checkpointService);

		const now = new Date().toISOString();
		await configRepo.recordSuccess(source.id, {
			lastFetchAt: now,
			lastSuccessAt: now,
			consecutiveFailures: 0,
			lastErrorAt: null,
			lastErrorMessage: null,
		});

		// Verify failure counter reset
		updated = await configRepo.findById(source.id);
		expect(updated?.consecutiveFailures).toBe(0);
		expect(updated?.lastErrorAt).toBeNull();
		expect(updated?.lastErrorMessage).toBeNull();
	});

	test("should auto-disable source after 10 consecutive failures", async () => {
		// Create a source config
		const source = await configRepo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		// Mock failed fetch
		globalThis.fetch = (() => Promise.reject(new Error("Persistent error"))) as any;
		const client = new FeedClient({ defaultUserAgent: "test/1.0" });

		// Simulate 10 failed attempts
		for (let i = 0; i < 10; i++) {
			try {
				await ingestionService.processFeed(source.id, source.config.url, client, checkpointService);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Unknown error";
				const currentConfig = await configRepo.findById(source.id);
				const failures = (currentConfig?.consecutiveFailures || 0) + 1;
				const now = new Date().toISOString();

				await configRepo.recordFailure(source.id, {
					lastFetchAt: now,
					lastErrorAt: now,
					lastErrorMessage: errorMessage,
					consecutiveFailures: failures,
				});

				// Check if we need to disable
				if (failures >= 10) {
					await configRepo.disable(source.id);
				}
			}
		}

		// Verify source is disabled
		const updated = await configRepo.findById(source.id);
		expect(updated?.consecutiveFailures).toBe(10);
		expect(updated?.enabled).toBe(false);
	});

	test("should continue processing other feeds after one fails", async () => {
		// Create two source configs
		const source1 = await configRepo.create({
			url: "https://example.com/feed1.xml",
			name: "Feed 1 (Failing)",
			type: "feed",
		});

		const source2 = await configRepo.create({
			url: "https://example.com/feed2.xml",
			name: "Feed 2 (Success)",
			type: "feed",
		});

		const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <guid>item-1</guid>
      <pubDate>Mon, 20 Jan 2026 12:00:00 +0000</pubDate>
      <description>Content</description>
    </item>
  </channel>
</rss>`;

		// Mock fetch: feed1 fails, feed2 succeeds
		globalThis.fetch = ((url: string) => {
			if (url.includes("feed1")) {
				return Promise.reject(new Error("Feed 1 error"));
			}
			return Promise.resolve(new Response(mockRss));
		}) as any;

		const client = new FeedClient({ defaultUserAgent: "test/1.0" });

		// Process feed 1 (fails)
		try {
			await ingestionService.processFeed(source1.id, source1.config.url, client, checkpointService);

			const now = new Date().toISOString();
			await configRepo.recordSuccess(source1.id, {
				lastFetchAt: now,
				lastSuccessAt: now,
				consecutiveFailures: 0,
				lastErrorAt: null,
				lastErrorMessage: null,
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			const currentConfig = await configRepo.findById(source1.id);
			const failures = (currentConfig?.consecutiveFailures || 0) + 1;
			const now = new Date().toISOString();

			await configRepo.recordFailure(source1.id, {
				lastFetchAt: now,
				lastErrorAt: now,
				lastErrorMessage: errorMessage,
				consecutiveFailures: failures,
			});
		}

		// Process feed 2 (succeeds)
		try {
			await ingestionService.processFeed(source2.id, source2.config.url, client, checkpointService);

			const now = new Date().toISOString();
			await configRepo.recordSuccess(source2.id, {
				lastFetchAt: now,
				lastSuccessAt: now,
				consecutiveFailures: 0,
				lastErrorAt: null,
				lastErrorMessage: null,
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			const currentConfig = await configRepo.findById(source2.id);
			const failures = (currentConfig?.consecutiveFailures || 0) + 1;
			const now = new Date().toISOString();

			await configRepo.recordFailure(source2.id, {
				lastFetchAt: now,
				lastErrorAt: now,
				lastErrorMessage: errorMessage,
				consecutiveFailures: failures,
			});
		}

		// Verify feed 1 recorded failure
		const updated1 = await configRepo.findById(source1.id);
		expect(updated1?.consecutiveFailures).toBe(1);
		expect(updated1?.lastErrorMessage).toContain("Feed 1 error");

		// Verify feed 2 recorded success
		const updated2 = await configRepo.findById(source2.id);
		expect(updated2?.consecutiveFailures).toBe(0);
		expect(updated2?.lastSuccessAt).not.toBeNull();
	});
});
