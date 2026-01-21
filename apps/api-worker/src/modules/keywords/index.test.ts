import { describe, it, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import app from "../..";
import { db } from "../../lib/db";
import { keywords } from "@trend-monitor/db";
import { sql } from "drizzle-orm";

const client = treaty(app);

describe("Keywords API", () => {
	beforeEach(async () => {
		// Clean up database using Drizzle
		await db.delete(keywords);
	});

	describe("GET /api/keywords", () => {
		it("should return empty array when no keywords exist", async () => {
			const { data, error } = await client.api.keywords.get();

			expect(error).toBeNull();
			expect(data).toEqual({ keywords: [], total: 0 });
		});

		it("should return all keywords", async () => {
			await db.insert(keywords).values({
				id: "kw1",
				name: "React",
				aliases: ["ReactJS"],
				tags: ["frontend"],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			const { data, error } = await client.api.keywords.get();

			expect(error).toBeNull();
			expect(data?.keywords).toHaveLength(1);
			expect(data?.total).toBe(1);
			expect(data?.keywords[0]).toMatchObject({
				id: "kw1",
				name: "React",
				aliases: ["ReactJS"],
				tags: ["frontend"],
				status: "active",
			});
		});

		it("should filter by status", async () => {
			await db.insert(keywords).values([
				{
					id: "kw1",
					name: "React",
					aliases: [],
					tags: [],
					status: "active",
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
				},
				{
					id: "kw2",
					name: "Vue",
					aliases: [],
					tags: [],
					status: "archived",
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
				},
			]);

			const { data, error } = await client.api.keywords.get({ query: { status: "active" } });

			expect(error).toBeNull();
			expect(data?.keywords).toHaveLength(1);
			expect(data?.total).toBe(1);
			expect(data?.keywords[0]?.name).toBe("React");
		});

		it("should filter by tag", async () => {
			await db.insert(keywords).values([
				{
					id: "kw1",
					name: "React",
					aliases: [],
					tags: ["frontend"],
					status: "active",
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
				},
				{
					id: "kw2",
					name: "PostgreSQL",
					aliases: [],
					tags: ["database"],
					status: "active",
					createdAt: "2026-01-01T00:00:00Z",
					updatedAt: "2026-01-01T00:00:00Z",
				},
			]);

			const { data, error } = await client.api.keywords.get({ query: { tag: "frontend" } });

			expect(error).toBeNull();
			expect(data?.keywords).toHaveLength(1);
			expect(data?.total).toBe(1);
			expect(data?.keywords[0]?.name).toBe("React");
		});
	});

	describe("GET /api/keywords/:id", () => {
		it("should return keyword by id", async () => {
			await db.insert(keywords).values({
				id: "kw1",
				name: "React",
				aliases: ["ReactJS"],
				tags: ["frontend"],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			const { data, error } = await client.api.keywords({ id: "kw1" }).get();

			expect(error).toBeNull();
			expect(data).toMatchObject({
				id: "kw1",
				name: "React",
				aliases: ["ReactJS"],
				tags: ["frontend"],
				status: "active",
			});
		});

		it("should return 404 for non-existent keyword", async () => {
			const { error, status } = await client.api.keywords({ id: "nonexistent" }).get();

			expect(status).toBe(404);
			expect(error).toBeDefined();
		});
	});

	describe("POST /api/keywords", () => {
		it("should create a new keyword", async () => {
			const { data, error, status } = await client.api.keywords.post({
				name: "TypeScript",
				aliases: ["TS"],
				tags: ["language"],
			});

			expect(error).toBeNull();
			expect(status).toBe(201);
			expect(data).toMatchObject({
				name: "TypeScript",
				aliases: ["TS"],
				tags: ["language"],
				status: "active",
			});
			expect(data?.id).toBeDefined();
			expect(data?.createdAt).toBeDefined();
		});

		it("should create keyword with minimal fields", async () => {
			const { data, error, status } = await client.api.keywords.post({
				name: "Go",
			});

			expect(error).toBeNull();
			expect(status).toBe(201);
			expect(data).toMatchObject({
				name: "Go",
				aliases: [],
				tags: [],
				status: "active",
			});
		});

		it("should reject empty name", async () => {
			const { error, status } = await client.api.keywords.post({
				name: "",
			});

			expect(status).toBe(400);
			expect(error).toBeDefined();
		});
	});

	describe("PUT /api/keywords/:id", () => {
		it("should update keyword", async () => {
			await db.insert(keywords).values({
				id: "kw1",
				name: "React",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			const { data, error } = await client.api.keywords({ id: "kw1" }).put({
				name: "React.js",
				aliases: ["ReactJS"],
				tags: ["frontend", "library"],
			});

			expect(error).toBeNull();
			expect(data).toMatchObject({
				id: "kw1",
				name: "React.js",
				aliases: ["ReactJS"],
				tags: ["frontend", "library"],
				status: "active",
			});
		});

		it("should update keyword status", async () => {
			await db.insert(keywords).values({
				id: "kw1",
				name: "React",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			const { data, error } = await client.api.keywords({ id: "kw1" }).put({
				status: "archived",
			});

			expect(error).toBeNull();
			expect(data?.status).toBe("archived");
		});

		it("should return 404 for non-existent keyword", async () => {
			const { status } = await client.api.keywords({ id: "nonexistent" }).put({
				name: "Updated",
			});

			expect(status).toBe(404);
		});
	});

	describe("DELETE /api/keywords/:id", () => {
		it("should archive keyword (soft delete)", async () => {
			await db.insert(keywords).values({
				id: "kw1",
				name: "React",
				aliases: [],
				tags: [],
				status: "active",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});

			const { status } = await client.api.keywords({ id: "kw1" }).delete();

			expect(status).toBe(204);

			// Verify keyword is archived, not deleted
			const [keyword] = await db.select().from(keywords).where(sql`id = 'kw1'`).limit(1);
			expect(keyword?.status).toBe("archived");
		});

		it("should return 404 for non-existent keyword", async () => {
			const { status } = await client.api.keywords({ id: "nonexistent" }).delete();

			expect(status).toBe(404);
		});
	});
});
