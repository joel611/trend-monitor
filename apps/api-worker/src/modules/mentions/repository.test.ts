// apps/api-worker/src/db/mentions-repository.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { MentionsRepository } from "./repository";
import type { D1Database } from "@cloudflare/workers-types";
import type { MentionRow } from "@trend-monitor/types";

// Mock D1 database
function createMockDb(): D1Database {
	const data = new Map<string, MentionRow>();

	return {
		prepare: (query: string) => {
			const bindMethod = (...params: any[]) => ({
				first: async () => {
					if (query.includes("SELECT * FROM mentions WHERE id = ?")) {
						return data.get(params[0]) || null;
					}
					if (query.includes("SELECT COUNT(*) as count FROM mentions")) {
						// Apply filters for count
						let filtered = Array.from(data.values());

						// Parse WHERE conditions from params based on query structure
						if (query.includes("WHERE")) {
							const whereParts = query.split("WHERE")[1].split("ORDER BY")[0];
							let paramIndex = 0;

							if (whereParts.includes("matched_keywords LIKE")) {
								const keywordId = params[paramIndex];
								filtered = filtered.filter((row) =>
									row.matched_keywords.includes(keywordId.replace(/%/g, "")),
								);
								paramIndex++;
							}

							if (whereParts.includes("source = ?")) {
								const source = params[paramIndex];
								filtered = filtered.filter((row) => row.source === source);
								paramIndex++;
							}

							if (whereParts.includes("created_at >= ?")) {
								const from = params[paramIndex];
								filtered = filtered.filter((row) => row.created_at >= from);
								paramIndex++;
							}

							if (whereParts.includes("created_at <= ?")) {
								const to = params[paramIndex];
								filtered = filtered.filter((row) => row.created_at <= to);
								paramIndex++;
							}
						}

						return { count: filtered.length };
					}
					return null;
				},
				all: async () => {
					if (query.includes("SELECT * FROM mentions")) {
						let filtered = Array.from(data.values());

						// Parse WHERE conditions from params based on query structure
						if (query.includes("WHERE")) {
							const whereParts = query.split("WHERE")[1].split("ORDER BY")[0];
							let paramIndex = 0;

							if (whereParts.includes("matched_keywords LIKE")) {
								const keywordId = params[paramIndex];
								filtered = filtered.filter((row) =>
									row.matched_keywords.includes(keywordId.replace(/%/g, "")),
								);
								paramIndex++;
							}

							if (whereParts.includes("source = ?")) {
								const source = params[paramIndex];
								filtered = filtered.filter((row) => row.source === source);
								paramIndex++;
							}

							if (whereParts.includes("created_at >= ?")) {
								const from = params[paramIndex];
								filtered = filtered.filter((row) => row.created_at >= from);
								paramIndex++;
							}

							if (whereParts.includes("created_at <= ?")) {
								const to = params[paramIndex];
								filtered = filtered.filter((row) => row.created_at <= to);
								paramIndex++;
							}
						}

						// Sort by created_at DESC
						filtered.sort(
							(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
						);

						// Apply pagination (last two params are limit and offset)
						const limit = params[params.length - 2];
						const offset = params[params.length - 1];

						return {
							results: filtered.slice(offset, offset + limit),
						};
					}
					return { results: [] };
				},
				run: async () => {
					if (query.includes("INSERT")) {
						const [
							id,
							source,
							source_id,
							title,
							content,
							url,
							author,
							created_at,
							fetched_at,
							matched_keywords,
						] = params;
						data.set(id, {
							id,
							source,
							source_id,
							title,
							content,
							url,
							author,
							created_at,
							fetched_at,
							matched_keywords,
						});
					}
					return { success: true };
				},
			});

			return {
				bind: bindMethod,
			} as any;
		},
	} as any;
}

describe("MentionsRepository", () => {
	let db: D1Database;
	let repo: MentionsRepository;

	beforeEach(() => {
		db = createMockDb();
		repo = new MentionsRepository(db);
	});

	describe("list", () => {
		test("returns paginated mentions", async () => {
			// Insert test data
			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m1",
					"reddit",
					"post1",
					"Test Post 1",
					"Content 1",
					"https://reddit.com/1",
					"user1",
					"2026-01-15T10:00:00Z",
					"2026-01-16T10:00:00Z",
					JSON.stringify(["kw1"]),
				)
				.run();

			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m2",
					"x",
					"tweet1",
					null,
					"Content 2",
					"https://x.com/1",
					"user2",
					"2026-01-15T11:00:00Z",
					"2026-01-16T11:00:00Z",
					JSON.stringify(["kw2"]),
				)
				.run();

			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m3",
					"feed",
					"article1",
					"Test Article",
					"Content 3",
					"https://example.com/1",
					"author1",
					"2026-01-15T12:00:00Z",
					"2026-01-16T12:00:00Z",
					JSON.stringify(["kw1", "kw2"]),
				)
				.run();

			const result = await repo.list({ limit: 2, offset: 0 });

			expect(result.mentions.length).toBe(2);
			expect(result.total).toBe(3);
			// Verify descending order by created_at
			expect(result.mentions[0].id).toBe("m3");
			expect(result.mentions[1].id).toBe("m2");
		});

		test("filters by keywordId", async () => {
			// Insert test data
			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m1",
					"reddit",
					"post1",
					"Test Post 1",
					"Content 1",
					"https://reddit.com/1",
					"user1",
					"2026-01-15T10:00:00Z",
					"2026-01-16T10:00:00Z",
					JSON.stringify(["kw1"]),
				)
				.run();

			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m2",
					"x",
					"tweet1",
					null,
					"Content 2",
					"https://x.com/1",
					"user2",
					"2026-01-15T11:00:00Z",
					"2026-01-16T11:00:00Z",
					JSON.stringify(["kw2"]),
				)
				.run();

			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m3",
					"feed",
					"article1",
					"Test Article",
					"Content 3",
					"https://example.com/1",
					"author1",
					"2026-01-15T12:00:00Z",
					"2026-01-16T12:00:00Z",
					JSON.stringify(["kw1", "kw2"]),
				)
				.run();

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
			await db
				.prepare(
					"INSERT INTO mentions (id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"m1",
					"reddit",
					"post1",
					"Test Post",
					"Test Content",
					"https://reddit.com/1",
					"user1",
					"2026-01-15T10:00:00Z",
					"2026-01-16T10:00:00Z",
					JSON.stringify(["kw1"]),
				)
				.run();

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
