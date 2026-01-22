import { describe, test, expect, beforeAll, mock } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "../../index";
import { db } from "../../lib/db";
import { sourceConfigs } from "@trend-monitor/db";

describe("Sources API", () => {
	const client = treaty(app);

	beforeAll(async () => {
		// Clean up test data
		await db.delete(sourceConfigs);
	});

	test("GET /api/sources - list all sources", async () => {
		const { data, error } = await client.api.sources.get();

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(Array.isArray(data)).toBe(true);
	});

	test("POST /api/sources/validate - validate feed without saving", async () => {
		// Mock the fetch for feed validation
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(
					`<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <description>Test Description</description>
    <item>
      <title>Test Item</title>
      <link>https://example.com/item1</link>
    </item>
  </channel>
</rss>`,
					{ headers: { "content-type": "application/rss+xml" } }
				)
			)
		);

		const { data, error } = await client.api.sources.validate.post({
			url: "https://example.com/feed.xml",
		});

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.valid).toBe(true);
		expect(data?.metadata?.title).toBe("Test Feed");
		expect(data?.preview).toBeDefined();
	});

	test("POST /api/sources - create new source", async () => {
		const { data, error } = await client.api.sources.post({
			url: "https://example.com/feed.xml",
			name: "Example Feed",
			type: "feed",
		});

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.id).toBeDefined();
		expect(data?.config.url).toBe("https://example.com/feed.xml");
		expect(data?.config.name).toBe("Example Feed");
		expect(data?.enabled).toBe(true);
	});

	test("GET /api/sources/:id - get single source", async () => {
		// Create a source first
		const createResult = await client.api.sources.post({
			url: "https://test.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		const sourceId = createResult.data?.id as string;

		const { data, error } = await client.api.sources({ id: sourceId }).get();

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.id).toBe(sourceId);
		expect(data?.config.name).toBe("Test Feed");
	});

	test("PUT /api/sources/:id - update source", async () => {
		// Create a source first
		const createResult = await client.api.sources.post({
			url: "https://update-test.com/feed.xml",
			name: "Original Name",
			type: "feed",
		});

		const sourceId = createResult.data?.id as string;

		const { data, error } = await client.api.sources({ id: sourceId }).put({
			name: "Updated Name",
			url: "https://update-test.com/new-feed.xml",
		});

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.config.name).toBe("Updated Name");
		expect(data?.config.url).toBe("https://update-test.com/new-feed.xml");
	});

	test("DELETE /api/sources/:id - soft delete", async () => {
		// Create a source first
		const createResult = await client.api.sources.post({
			url: "https://delete-test.com/feed.xml",
			name: "To Delete",
			type: "feed",
		});

		const sourceId = createResult.data?.id as string;

		const { data, error } = await client.api.sources({ id: sourceId }).delete();

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.success).toBe(true);

		// Verify it's soft deleted (findById still returns it, but with deletedAt set)
		const getResult = await client.api.sources({ id: sourceId }).get();
		expect(getResult.data?.deletedAt).toBeDefined();
	});

	test("PATCH /api/sources/:id/toggle - toggle enabled status", async () => {
		// Create a source first
		const createResult = await client.api.sources.post({
			url: "https://toggle-test.com/feed.xml",
			name: "Toggle Test",
			type: "feed",
		});

		const sourceId = createResult.data?.id as string;
		const initialEnabled = createResult.data?.enabled;

		const { data, error } = await client.api.sources({ id: sourceId }).toggle.patch();

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data?.enabled).toBe(!initialEnabled);
	});

	test("GET /api/sources - should include health status", async () => {
		const { data, error } = await client.api.sources.get();

		expect(error).toBeNull();
		expect(data).toBeDefined();

		if (data && data.length > 0) {
			expect(data[0].health).toBeDefined();
			expect(["success", "warning", "error"]).toContain(data[0].health);
		}
	});
});
