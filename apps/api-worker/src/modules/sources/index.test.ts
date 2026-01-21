import { describe, it, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "../..";
import { db } from "../../lib/db";
import { sourceConfigs } from "@trend-monitor/db";

const client = treaty(app);

describe("Sources API", () => {
	beforeEach(async () => {
		// Clean up database
		await db.delete(sourceConfigs);
	});

	describe("GET /api/sources", () => {
		it("should return empty array when no sources exist", async () => {
			const { data, error } = await client.api.sources.get();

			expect(error).toBeNull();
			expect(data).toEqual({ sources: [] });
		});

		it("should return all sources", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: {
					url: "https://example.com/feed.xml",
					name: "Example Feed",
				},
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources.get();

			expect(error).toBeNull();
			expect(data?.sources).toHaveLength(1);
			expect(data?.sources[0]).toMatchObject({
				id: "src1",
				type: "feed",
				config: {
					url: "https://example.com/feed.xml",
					name: "Example Feed",
				},
				enabled: true,
				health: "warning", // Never fetched
			});
		});

		it("should exclude soft-deleted sources by default", async () => {
			await db.insert(sourceConfigs).values([
				{
					id: "src1",
					type: "feed",
					config: { url: "https://example.com/feed1.xml", name: "Feed 1" },
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
					consecutiveFailures: 0,
					deletedAt: null,
				},
				{
					id: "src2",
					type: "feed",
					config: { url: "https://example.com/feed2.xml", name: "Feed 2" },
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
					consecutiveFailures: 0,
					deletedAt: "2026-01-15T00:00:00Z",
				},
			]);

			const { data, error } = await client.api.sources.get();

			expect(error).toBeNull();
			expect(data?.sources).toHaveLength(1);
			expect(data?.sources[0]?.id).toBe("src1");
		});

		it("should include soft-deleted sources when requested", async () => {
			await db.insert(sourceConfigs).values([
				{
					id: "src1",
					type: "feed",
					config: { url: "https://example.com/feed1.xml", name: "Feed 1" },
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
					consecutiveFailures: 0,
					deletedAt: null,
				},
				{
					id: "src2",
					type: "feed",
					config: { url: "https://example.com/feed2.xml", name: "Feed 2" },
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
					consecutiveFailures: 0,
					deletedAt: "2026-01-15T00:00:00Z",
				},
			]);

			const { data, error } = await client.api.sources.get({
				query: { includeDeleted: true },
			});

			expect(error).toBeNull();
			expect(data?.sources).toHaveLength(2);
		});
	});

	describe("POST /api/sources/validate", () => {
		it("should reject invalid URL format", async () => {
			const { data, error } = await client.api.sources.validate.post({
				url: "not-a-url",
			});

			expect(error).toBeNull();
			expect(data?.valid).toBe(false);
			expect(data?.error).toContain("Invalid URL format");
		});

		it("should reject non-HTTP(S) protocols", async () => {
			const { data, error } = await client.api.sources.validate.post({
				url: "ftp://example.com/feed.xml",
			});

			expect(error).toBeNull();
			expect(data?.valid).toBe(false);
			expect(data?.error).toContain("HTTP or HTTPS");
		});

		// Note: Testing actual feed fetching requires mocking or real feeds
		// These tests would be in integration tests with real/mocked feeds
	});

	describe("POST /api/sources", () => {
		it("should create new source", async () => {
			const { data, error, status } = await client.api.sources.post({
				url: "https://example.com/feed.xml",
				name: "Test Feed",
				type: "feed",
			});

			expect(error).toBeNull();
			expect(status).toBe(201);
			expect(data).toMatchObject({
				type: "feed",
				config: {
					url: "https://example.com/feed.xml",
					name: "Test Feed",
				},
				enabled: true,
				consecutiveFailures: 0,
			});
			expect(data?.id).toBeDefined();
		});

		it("should create source with custom user agent", async () => {
			const { data, error } = await client.api.sources.post({
				url: "https://example.com/feed.xml",
				name: "Test Feed",
				type: "feed",
				customUserAgent: "Custom Bot/1.0",
			});

			expect(error).toBeNull();
			expect(data?.config.customUserAgent).toBe("Custom Bot/1.0");
		});

		it("should reject empty URL", async () => {
			const { error } = await client.api.sources.post({
				url: "",
				name: "Test Feed",
				type: "feed",
			});

			expect(error).toBeDefined();
		});

		it("should reject empty name", async () => {
			const { error } = await client.api.sources.post({
				url: "https://example.com/feed.xml",
				name: "",
				type: "feed",
			});

			expect(error).toBeDefined();
		});
	});

	describe("GET /api/sources/:id", () => {
		it("should return source by id", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).get();

			expect(error).toBeNull();
			expect(data).toMatchObject({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
			});
		});

		it("should return 404 for non-existent source", async () => {
			const { error, status } = await client.api.sources({ id: "nonexistent" }).get();

			expect(status).toBe(404);
			expect(error).toBeDefined();
		});
	});

	describe("PUT /api/sources/:id", () => {
		it("should update source name", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Old Name" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).put({
				name: "New Name",
			});

			expect(error).toBeNull();
			expect(data?.config.name).toBe("New Name");
		});

		it("should update source URL", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).put({
				url: "https://example.com/new-feed.xml",
			});

			expect(error).toBeNull();
			expect(data?.config.url).toBe("https://example.com/new-feed.xml");
		});

		it("should toggle enabled status", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).put({
				enabled: false,
			});

			expect(error).toBeNull();
			expect(data?.enabled).toBe(false);
		});

		it("should return 404 for non-existent source", async () => {
			const { error, status } = await client.api.sources({ id: "nonexistent" }).put({
				name: "New Name",
			});

			expect(status).toBe(404);
			expect(error).toBeDefined();
		});
	});

	describe("DELETE /api/sources/:id", () => {
		it("should soft delete source", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).delete();

			expect(error).toBeNull();
			expect(data).toEqual({ success: true });

			// Verify source is soft-deleted
			const { data: listData } = await client.api.sources.get();
			expect(listData?.sources).toHaveLength(0);

			// Verify source still exists with includeDeleted
			const { data: listAllData } = await client.api.sources.get({
				query: { includeDeleted: true },
			});
			expect(listAllData?.sources).toHaveLength(1);
			expect(listAllData?.sources[0]?.deletedAt).toBeDefined();
		});

		it("should return 404 for non-existent source", async () => {
			const { error, status } = await client.api.sources({ id: "nonexistent" }).delete();

			expect(status).toBe(404);
			expect(error).toBeDefined();
		});
	});

	describe("PATCH /api/sources/:id/toggle", () => {
		it("should toggle enabled from true to false", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).toggle.patch();

			expect(error).toBeNull();
			expect(data?.enabled).toBe(false);
		});

		it("should toggle enabled from false to true", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: false,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
			});

			const { data, error } = await client.api.sources({ id: "src1" }).toggle.patch();

			expect(error).toBeNull();
			expect(data?.enabled).toBe(true);
		});

		it("should return 404 for non-existent source", async () => {
			const { error, status } = await client.api.sources({ id: "nonexistent" }).toggle.patch();

			expect(status).toBe(404);
			expect(error).toBeDefined();
		});
	});

	describe("Health status calculation", () => {
		it("should return warning for never fetched sources", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
				lastFetchAt: null,
			});

			const { data } = await client.api.sources({ id: "src1" }).get();
			expect(data?.health).toBe("warning");
		});

		it("should return success for sources with no failures", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 0,
				lastFetchAt: "2026-01-20T00:00:00Z",
				lastSuccessAt: "2026-01-20T00:00:00Z",
			});

			const { data } = await client.api.sources({ id: "src1" }).get();
			expect(data?.health).toBe("success");
		});

		it("should return warning for sources with 1-5 failures", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 3,
				lastFetchAt: "2026-01-20T00:00:00Z",
				lastErrorAt: "2026-01-20T00:00:00Z",
			});

			const { data } = await client.api.sources({ id: "src1" }).get();
			expect(data?.health).toBe("warning");
		});

		it("should return error for sources with 6+ failures", async () => {
			await db.insert(sourceConfigs).values({
				id: "src1",
				type: "feed",
				config: { url: "https://example.com/feed.xml", name: "Test Feed" },
				enabled: true,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
				consecutiveFailures: 6,
				lastFetchAt: "2026-01-20T00:00:00Z",
				lastErrorAt: "2026-01-20T00:00:00Z",
			});

			const { data } = await client.api.sources({ id: "src1" }).get();
			expect(data?.health).toBe("error");
		});
	});
});
