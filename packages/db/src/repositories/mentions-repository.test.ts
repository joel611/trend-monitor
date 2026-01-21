import { describe, expect, test, beforeEach } from "bun:test";
import { MentionsRepository } from "./mentions-repository";
import { createMockDB } from "../mock";
import { mentions, type DbClient } from "../index";

describe("MentionsRepository", () => {
	let db: DbClient;
	let repo: MentionsRepository;

	beforeEach(() => {
		db = createMockDB();
		repo = new MentionsRepository(db);
	});

	describe("createOrIgnore", () => {
		test("creates new mention", async () => {
			const mention = await repo.createOrIgnore({
				source: "reddit",
				sourceId: "abc123",
				title: "Test Post",
				content: "This is about ElysiaJS",
				url: "https://reddit.com/r/test/abc123",
				author: "testuser",
				createdAt: new Date().toISOString(),
				matchedKeywords: ["kw-1"],
			});

			expect(mention).toBeDefined();
			expect(mention?.source).toBe("reddit");
			expect(mention?.sourceId).toBe("abc123");
			expect(mention?.matchedKeywords).toEqual(["kw-1"]);
		});

		test("ignores duplicate (same source + sourceId)", async () => {
			const data = {
				source: "reddit" as const,
				sourceId: "abc123",
				title: "Test Post",
				content: "This is about ElysiaJS",
				url: "https://reddit.com/r/test/abc123",
				author: "testuser",
				createdAt: new Date().toISOString(),
				matchedKeywords: ["kw-1"],
			};

			const first = await repo.createOrIgnore(data);
			const second = await repo.createOrIgnore(data);

			expect(first).toBeDefined();
			expect(second).toBeNull(); // Should return null on duplicate
		});
	});

	describe("list", () => {
		test("returns paginated mentions", async () => {
			// Insert test data using Drizzle
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Test Post 1",
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
				{
					id: "m3",
					source: "feed",
					sourceId: "article1",
					title: "Test Article",
					content: "Content 3",
					url: "https://example.com/1",
					author: "author1",
					createdAt: "2026-01-15T12:00:00Z",
					fetchedAt: "2026-01-16T12:00:00Z",
					matchedKeywords: ["kw1", "kw2"],
				},
			]);

			const result = await repo.list({ limit: 2, offset: 0 });

			expect(result.mentions.length).toBe(2);
			expect(result.total).toBe(3);
			// Verify descending order by created_at
			expect(result.mentions[0].id).toBe("m3");
			expect(result.mentions[1].id).toBe("m2");
		});

		test("filters by keywordId", async () => {
			// Insert test data using Drizzle
			await db.insert(mentions).values([
				{
					id: "m1",
					source: "reddit",
					sourceId: "post1",
					title: "Test Post 1",
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
				{
					id: "m3",
					source: "feed",
					sourceId: "article1",
					title: "Test Article",
					content: "Content 3",
					url: "https://example.com/1",
					author: "author1",
					createdAt: "2026-01-15T12:00:00Z",
					fetchedAt: "2026-01-16T12:00:00Z",
					matchedKeywords: ["kw1", "kw2"],
				},
			]);

			const result = await repo.list({
				keywordId: "kw1",
				limit: 10,
				offset: 0,
			});

			expect(result.mentions.length).toBe(2);
			expect(result.total).toBe(2);
			expect(result.mentions[0].matchedKeywords).toContain("kw1");
			expect(result.mentions[1].matchedKeywords).toContain("kw1");
		});
	});

	describe("findById", () => {
		test("finds mention by ID", async () => {
			await db.insert(mentions).values({
				id: "m1",
				source: "reddit",
				sourceId: "post1",
				title: "Test Post",
				content: "Test Content",
				url: "https://reddit.com/1",
				author: "user1",
				createdAt: "2026-01-15T10:00:00Z",
				fetchedAt: "2026-01-16T10:00:00Z",
				matchedKeywords: ["kw1"],
			});

			const found = await repo.findById("m1");
			expect(found?.id).toBe("m1");
			expect(found?.title).toBe("Test Post");
			expect(found?.source as string).toBe("reddit");
		});

		test("returns null for missing mention", async () => {
			const found = await repo.findById("nonexistent-id");
			expect(found).toBeNull();
		});
	});
});
