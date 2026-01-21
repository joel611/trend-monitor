import { describe, it, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "../..";
import { db } from "../../lib/db";
import { mentions } from "@trend-monitor/db";

const client = treaty(app);

describe("Mentions API", () => {
	beforeEach(async () => {
		// Clean up database using Drizzle
		await db.delete(mentions);
	});

	describe("GET /api/mentions", () => {
		it("should return empty array when no mentions exist", async () => {
			const { data, error } = await client.api.mentions.get();

			expect(error).toBeNull();
			expect(data?.mentions).toEqual([]);
			expect(data?.total).toBe(0);
			expect(data?.limit).toBe(20);
			expect(data?.offset).toBe(0);
		});

		it("should return paginated mentions", async () => {
			// Insert test mentions using Drizzle
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Post 1",
					content: "Content 1",
					url: "https://reddit.com/1",
					author: "user1",
					createdAt: "2026-01-15T10:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
				{
					id: "m2",
					source: "x",
					sourceId: "tweet1",
					title: null,
					content: "Content 2",
					url: "https://x.com/1",
					author: "user2",
					createdAt: "2026-01-15T11:00:00Z",
					fetchedAt: "2026-01-16T11:00:00Z",
					matchedKeywords: ["kw2"],
				},
			]);

			const { data, error } = await client.api.mentions.get();

			expect(error).toBeNull();
			expect(data?.mentions).toHaveLength(2);
			expect(data?.total).toBe(2);
			// Verify descending order by created_at
			expect(data?.mentions[0]?.id).toBe("m2");
			expect(data?.mentions[1]?.id).toBe("m1");
		});

		it("should filter by keywordId", async () => {
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Post 1",
					content: "Content 1",
					url: "https://reddit.com/1",
					author: "user1",
					createdAt: "2026-01-15T10:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
				{
					id: "m2",
					source: "x",
					sourceId: "tweet1",
					title: null,
					content: "Content 2",
					url: "https://x.com/1",
					author: "user2",
					createdAt: "2026-01-15T11:00:00Z",
					fetchedAt: "2026-01-16T11:00:00Z",
					matchedKeywords: ["kw2"],
				},
			]);

			const { data, error } = await client.api.mentions.get({
				query: { keywordId: "kw1" },
			});

			expect(error).toBeNull();
			expect(data?.mentions).toHaveLength(1);
			expect(data?.mentions[0]?.id).toBe("m1");
		});

		it("should filter by source", async () => {
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Post 1",
					content: "Content 1",
					url: "https://reddit.com/1",
					author: "user1",
					createdAt: "2026-01-15T10:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
				{
					id: "m2",
					source: "x",
					sourceId: "tweet1",
					title: null,
					content: "Content 2",
					url: "https://x.com/1",
					author: "user2",
					createdAt: "2026-01-15T11:00:00Z",
					fetchedAt: "2026-01-16T11:00:00Z",
					matchedKeywords: ["kw2"],
				},
			]);

			const { data, error } = await client.api.mentions.get({
				query: { source: "reddit" },
			});

			expect(error).toBeNull();
			expect(data?.mentions).toHaveLength(1);
			expect(data?.mentions[0]?.source).toBe("reddit");
		});

		it("should filter by time range", async () => {
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Post 1",
					content: "Content 1",
					url: "https://reddit.com/1",
					author: "user1",
					createdAt: "2026-01-14T10:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
				{
					id: "m2",
					source: "x",
					sourceId: "tweet1",
					title: null,
					content: "Content 2",
					url: "https://x.com/1",
					author: "user2",
					createdAt: "2026-01-15T11:00:00Z",
					fetchedAt: "2026-01-16T11:00:00Z",
					matchedKeywords: ["kw2"],
				},
			]);

			const { data, error } = await client.api.mentions.get({
				query: {
					from: "2026-01-15T00:00:00Z",
					to: "2026-01-15T23:59:59Z",
				},
			});

			expect(error).toBeNull();
			expect(data?.mentions).toHaveLength(1);
			expect(data?.mentions[0]?.id).toBe("m2");
		});

		it("should support pagination", async () => {
			// Insert 3 mentions using Drizzle
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Post 1",
					content: "Content 1",
					url: "https://reddit.com/1",
					author: "user1",
					createdAt: "2026-01-15T11:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
				{
					id: "m2",
					source: "reddit",
					sourceId: "post2",
					title: "Post 2",
					content: "Content 2",
					url: "https://reddit.com/2",
					author: "user1",
					createdAt: "2026-01-15T12:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
				{
					id: "m3",
					source: "reddit",
					sourceId: "post3",
					title: "Post 3",
					content: "Content 3",
					url: "https://reddit.com/3",
					author: "user1",
					createdAt: "2026-01-15T13:00:00Z",
					fetchedAt: "2026-01-16T10:00:00Z",
					matchedKeywords: ["kw1"],
				},
			]);

			const { data, error } = await client.api.mentions.get({
				query: { limit: 2, offset: 1 },
			});

			expect(error).toBeNull();
			expect(data?.mentions).toHaveLength(2);
			expect(data?.total).toBe(3);
			expect(data?.limit).toBe(2);
			expect(data?.offset).toBe(1);
			// Verify correct page (descending order, so m3, m2 are first page, m2, m1 after offset 1)
			expect(data?.mentions[0]?.id).toBe("m2");
			expect(data?.mentions[1]?.id).toBe("m1");
		});
	});

	describe("GET /api/mentions/:id", () => {
		it("should return mention by id", async () => {
			await db.insert(mentions).values({
				id: "m1",
				source: "reddit",
				sourceId: "post1",
				title: "Test Post",
				content: "Test content",
				url: "https://reddit.com/1",
				author: "testuser",
				createdAt: "2026-01-15T10:00:00Z",
				fetchedAt: "2026-01-16T10:00:00Z",
				matchedKeywords: ["kw1", "kw2"],
			});

			const { data, error } = await client.api.mentions({ id: "m1" }).get();

			expect(error).toBeNull();
			expect(data).toMatchObject({
				id: "m1",
				source: "reddit",
				sourceId: "post1",
				title: "Test Post",
				content: "Test content",
				url: "https://reddit.com/1",
				author: "testuser",
				matchedKeywords: ["kw1", "kw2"],
			});
		});

		it("should return 404 for non-existent mention", async () => {
			const { error, status } = await client.api.mentions({ id: "nonexistent" }).get();

			expect(status).toBe(404);
			expect(error).toMatchObject({
				value: { message: "Mention not found" },
			});
		});
	});
});
