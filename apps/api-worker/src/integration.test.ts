import { describe, it, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "./index";
import { db, dailyAggregates, mentions, keywords } from "./lib/db";

const client = treaty(app);

describe("API Integration Tests", () => {
	let createdKeywordId: string;

	beforeEach(async () => {
		// Clean up database using Drizzle
		await db.delete(dailyAggregates);
		await db.delete(mentions);
		await db.delete(keywords);
	});

	describe("Full workflow: create keyword -> list keywords -> update keyword -> delete keyword", () => {
		it("should complete full CRUD workflow for keywords", async () => {
			// 1. Create keyword
			const createResponse = await client.api.keywords.post({
				name: "ElysiaJS",
				aliases: ["elysia"],
				tags: ["framework", "backend"],
			});

			expect(createResponse.status).toBe(201);
			expect(createResponse.data?.name).toBe("ElysiaJS");
			expect(createResponse.data?.id).toBeDefined();
			createdKeywordId = createResponse.data!.id;

			// 2. List keywords
			const listResponse = await client.api.keywords.get();
			expect(listResponse.status).toBe(200);
			expect(listResponse.data?.keywords.length).toBe(1);
			expect(listResponse.data?.total).toBe(1);

			// 3. Get keyword by ID
			const getResponse = await client.api.keywords({
				id: createdKeywordId,
			}).get();
			expect(getResponse.status).toBe(200);
			expect(getResponse.data?.name).toBe("ElysiaJS");

			// 4. Update keyword
			const updateResponse = await client.api.keywords({
				id: createdKeywordId,
			}).put({
				tags: ["framework", "backend", "typescript"],
			});
			expect(updateResponse.status).toBe(200);
			expect(updateResponse.data?.tags).toContain("typescript");

			// 5. Delete keyword (archive)
			const deleteResponse = await client.api.keywords({
				id: createdKeywordId,
			}).delete();
			expect(deleteResponse.status).toBe(204);

			// Verify keyword is archived using Drizzle
			const { eq } = await import("drizzle-orm");
			const archivedKeywords = await db
				.select()
				.from(keywords)
				.where(eq(keywords.id, createdKeywordId))
				.limit(1);
			expect(archivedKeywords[0]?.status).toBe("archived");
		});
	});

	describe("Full workflow: create keyword -> add aggregates -> view trends", () => {
		it("should retrieve trends overview with aggregated data", async () => {
			// 1. Create keywords
			const keyword1 = await client.api.keywords.post({
				name: "React",
				aliases: ["ReactJS"],
				tags: ["frontend"],
			});

			const keyword2 = await client.api.keywords.post({
				name: "Vue",
				aliases: ["VueJS"],
				tags: ["frontend"],
			});

			expect(keyword1.status).toBe(201);
			expect(keyword2.status).toBe(201);

			// 2. Add daily aggregates
			const today = new Date().toISOString().split("T")[0];
			const yesterday = new Date(Date.now() - 86400000)
				.toISOString()
				.split("T")[0];

			// Add aggregates for React
			await db.insert(dailyAggregates).values({
				id: "da1",
				date: today,
				keywordId: keyword1.data!.id,
				source: "reddit",
				mentionsCount: 15,
			});

			await db.insert(dailyAggregates).values({
				id: "da2",
				date: yesterday,
				keywordId: keyword1.data!.id,
				source: "reddit",
				mentionsCount: 10,
			});

			// Add aggregates for Vue
			await db.insert(dailyAggregates).values({
				id: "da3",
				date: today,
				keywordId: keyword2.data!.id,
				source: "x",
				mentionsCount: 8,
			});

			// 3. Get trends overview
			const trendsResponse = await client.api.trends.overview.get();
			expect(trendsResponse.status).toBe(200);
			expect(trendsResponse.data?.topKeywords).toBeDefined();
			expect(trendsResponse.data?.topKeywords.length).toBeGreaterThan(0);
			expect(trendsResponse.data?.totalMentions).toBeGreaterThan(0);

			// 4. Get keyword-specific trend
			const keywordTrendResponse = await client.api.trends({
				keywordId: keyword1.data!.id,
			}).get();
			expect(keywordTrendResponse.status).toBe(200);
			expect(keywordTrendResponse.data?.keywordId).toBe(keyword1.data!.id);
			expect(keywordTrendResponse.data?.name).toBe("React");
			expect(keywordTrendResponse.data?.timeSeries).toBeDefined();
			expect(keywordTrendResponse.data?.totalMentions).toBeGreaterThan(0);
		});
	});

	describe("Full workflow: create keywords -> add mentions -> filter mentions", () => {
		it("should filter mentions by keyword and source", async () => {
			// 1. Create keyword
			const keyword = await client.api.keywords.post({
				name: "TypeScript",
				aliases: ["TS"],
				tags: ["language"],
			});

			expect(keyword.status).toBe(201);

			// 2. Add mentions
			const today = new Date().toISOString();
			await db.insert(mentions).values({
				id: "m1",
				source: "reddit",
				sourceId: "post1",
				content: "TypeScript is great!",
				url: "https://reddit.com/1",
				createdAt: today,
				fetchedAt: today,
				matchedKeywords: [keyword.data!.id],
			});

			await db.insert(mentions).values({
				id: "m2",
				source: "x",
				sourceId: "tweet1",
				content: "Loving TypeScript",
				url: "https://x.com/1",
				createdAt: today,
				fetchedAt: today,
				matchedKeywords: [keyword.data!.id],
			});

			// 3. Get all mentions
			const allMentions = await client.api.mentions.get({
				query: { limit: 10, offset: 0 },
			});
			expect(allMentions.status).toBe(200);
			expect(allMentions.data?.mentions.length).toBe(2);

			// 4. Filter by keyword
			const keywordMentions = await client.api.mentions.get({
				query: { keywordId: keyword.data!.id, limit: 10, offset: 0 },
			});
			expect(keywordMentions.status).toBe(200);
			expect(keywordMentions.data?.mentions.length).toBe(2);

			// 5. Filter by source
			const redditMentions = await client.api.mentions.get({
				query: { source: "reddit", limit: 10, offset: 0 },
			});
			expect(redditMentions.status).toBe(200);
			expect(redditMentions.data?.mentions.length).toBe(1);
			expect(redditMentions.data?.mentions[0]?.source).toBe("reddit");
		});
	});

	describe("Error handling workflows", () => {
		it("should return 404 for non-existent keyword", async () => {
			const response = await client.api.keywords({
				id: "nonexistent",
			}).get();
			expect(response.status).toBe(404);
		});

		it("should return 404 for non-existent keyword trend", async () => {
			const response = await client.api.trends({
				keywordId: "nonexistent",
			}).get();
			expect(response.status).toBe(404);
		});

		it("should reject invalid keyword creation (empty name)", async () => {
			const response = await client.api.keywords.post({
				name: "",
			});
			expect(response.status).toBe(400);
		});

		it("should reject keyword update for non-existent keyword", async () => {
			const response = await client.api.keywords({
				id: "nonexistent",
			}).put({
				name: "Updated",
			});
			expect(response.status).toBe(404);
		});

		it("should reject keyword deletion for non-existent keyword", async () => {
			const response = await client.api.keywords({
				id: "nonexistent",
			}).delete();
			expect(response.status).toBe(404);
		});
	});

	describe("Pagination and filtering", () => {
		it("should filter keywords by status", async () => {
			// Create active keyword
			const keyword1 = await client.api.keywords.post({
				name: "Active1",
			});

			// Create and archive another keyword
			const keyword2 = await client.api.keywords.post({
				name: "ToArchive",
			});
			await client.api.keywords({ id: keyword2.data!.id }).delete();

			// Filter by active status
			const activeKeywords = await client.api.keywords.get({
				query: { status: "active" },
			});
			expect(activeKeywords.status).toBe(200);
			expect(activeKeywords.data?.keywords.length).toBe(1);
			expect(activeKeywords.data?.keywords[0]?.name).toBe("Active1");

			// Filter by archived status
			const archivedKeywords = await client.api.keywords.get({
				query: { status: "archived" },
			});
			expect(archivedKeywords.status).toBe(200);
			expect(archivedKeywords.data?.keywords.length).toBe(1);
			expect(archivedKeywords.data?.keywords[0]?.name).toBe("ToArchive");
		});

		it("should filter keywords by tag", async () => {
			await client.api.keywords.post({
				name: "Frontend1",
				tags: ["frontend"],
			});

			await client.api.keywords.post({
				name: "Backend1",
				tags: ["backend"],
			});

			const frontendKeywords = await client.api.keywords.get({
				query: { tag: "frontend" },
			});
			expect(frontendKeywords.status).toBe(200);
			expect(frontendKeywords.data?.keywords.length).toBe(1);
			expect(frontendKeywords.data?.keywords[0]?.name).toBe("Frontend1");
		});

		it("should paginate mentions", async () => {
			// Create 5 mentions
			const today = new Date().toISOString();
			for (let i = 0; i < 5; i++) {
				await db.insert(mentions).values({
					id: `m${i}`,
					source: "reddit",
					sourceId: `post${i}`,
					content: `Content ${i}`,
					url: `https://reddit.com/${i}`,
					createdAt: today,
					fetchedAt: today,
					matchedKeywords: [],
				});
			}

			// Get first page (limit 2)
			const page1 = await client.api.mentions.get({
				query: { limit: 2, offset: 0 },
			});
			expect(page1.status).toBe(200);
			expect(page1.data?.mentions.length).toBe(2);
			expect(page1.data?.total).toBe(5);

			// Get second page
			const page2 = await client.api.mentions.get({
				query: { limit: 2, offset: 2 },
			});
			expect(page2.status).toBe(200);
			expect(page2.data?.mentions.length).toBe(2);
		});
	});
});
