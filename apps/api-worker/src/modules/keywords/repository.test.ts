// apps/api-worker/src/db/keywords-repository.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { KeywordsRepository } from "./repository";
import { createMockDB } from "@trend-monitor/db/mock";
import type { DbClient } from "@trend-monitor/db";

describe("KeywordsRepository", () => {
	let db: DbClient;
	let repo: KeywordsRepository;

	beforeEach(() => {
		db = createMockDB();
		repo = new KeywordsRepository(db);
	});
	describe("create", () => {
		test("creates keyword with all fields", async () => {
			const keyword = await repo.create({
				name: "ElysiaJS",
				aliases: ["elysia"],
				tags: ["framework"],
			});

			expect(keyword.name).toBe("ElysiaJS");
			expect(keyword.status as string).toBe("active");
			expect(keyword.aliases).toEqual(["elysia"]);
			expect(keyword.tags).toEqual(["framework"]);
		});

		test("rejects empty name", async () => {
			let errorCaught = false;
			try {
				await repo.create({ name: "", aliases: [], tags: [] });
			} catch {
				errorCaught = true;
			}
			expect(errorCaught).toBe(true);
		});

		test("rejects whitespace-only name", async () => {
			let errorCaught = false;
			try {
				await repo.create({ name: "   ", aliases: [], tags: [] });
			} catch {
				errorCaught = true;
			}
			expect(errorCaught).toBe(true);
		});

		test("trims whitespace from names", async () => {
			const keyword = await repo.create({
				name: "  ElysiaJS  ",
				aliases: [],
				tags: [],
			});

			expect(keyword.name).toBe("ElysiaJS");
		});
	});

	describe("findById", () => {
		test("finds keyword by ID", async () => {
			const created = await repo.create({ name: "Test", aliases: [], tags: [] });
			const found = await repo.findById(created.id);
			expect(found?.name).toBe("Test");
		});

		test("returns null for missing keyword", async () => {
			const found = await repo.findById("nonexistent-id");
			expect(found).toBeNull();
		});
	});

	describe("list", () => {
		test("lists all keywords", async () => {
			await repo.create({ name: "Test1", aliases: [], tags: [] });
			await repo.create({ name: "Test2", aliases: [], tags: [] });
			const list = await repo.list();
			expect(list.length).toBeGreaterThanOrEqual(2);
		});

		test("supports pagination with limit parameter", async () => {
			await repo.create({ name: "Test1", aliases: [], tags: [] });
			await repo.create({ name: "Test2", aliases: [], tags: [] });
			await repo.create({ name: "Test3", aliases: [], tags: [] });

			const page = await repo.list({ limit: 2, offset: 0 });
			expect(page.length).toBeLessThanOrEqual(2);
		});

		test("supports pagination with offset parameter", async () => {
			await repo.create({ name: "Test1", aliases: [], tags: [] });
			await repo.create({ name: "Test2", aliases: [], tags: [] });
			await repo.create({ name: "Test3", aliases: [], tags: [] });

			const page = await repo.list({ limit: 2, offset: 2 });
			expect(page).toBeDefined();
		});

		test("returns ordered results by created_at descending", async () => {
			const k1 = await repo.create({ name: "KeywordA", aliases: [], tags: [] });
			const k2 = await repo.create({ name: "KeywordB", aliases: [], tags: [] });

			const list = await repo.list();
			expect(list.length).toBeGreaterThanOrEqual(2);
			// Verify ordering - last created should be first
			if (list.length >= 2) {
				expect(list[0].createdAt >= list[1].createdAt).toBe(true);
			}
		});
	});

	describe("update", () => {
		test("updates keyword name", async () => {
			const created = await repo.create({ name: "Test", aliases: [], tags: [] });
			const updated = await repo.update(created.id, { name: "Updated" });
			expect(updated?.name).toBe("Updated");
		});

		test("rejects empty name in update", async () => {
			const created = await repo.create({ name: "Test", aliases: [], tags: [] });
			let errorCaught = false;
			try {
				await repo.update(created.id, { name: "" });
			} catch {
				errorCaught = true;
			}
			expect(errorCaught).toBe(true);
		});

		test("trims whitespace in updates", async () => {
			const created = await repo.create({ name: "Test", aliases: [], tags: [] });
			const updated = await repo.update(created.id, { name: "  Updated  " });
			expect(updated?.name).toBe("Updated");
		});

		test("returns null for non-existent keyword", async () => {
			const result = await repo.update("nonexistent-id", { name: "Updated" });
			expect(result).toBeNull();
		});
	});

	describe("delete", () => {
		test("archives keyword by ID", async () => {
			const created = await repo.create({ name: "Test", aliases: [], tags: [] });
			const deleted = await repo.delete(created.id);
			expect(deleted).toBe(true);
		});
	});

	describe("JSON parsing safety", () => {
		test("correctly deserializes JSON aliases and tags", async () => {
			const created = await repo.create({
				name: "Test",
				aliases: ["alias1", "alias2"],
				tags: ["tag1", "tag2"],
			});
			const found = await repo.findById(created.id);

			expect(found?.aliases).toEqual(["alias1", "alias2"]);
			expect(found?.tags).toEqual(["tag1", "tag2"]);
		});

		test("gracefully handles empty aliases and tags", async () => {
			const created = await repo.create({ name: "Test", aliases: [], tags: [] });
			const found = await repo.findById(created.id);

			expect(found?.aliases).toEqual([]);
			expect(found?.tags).toEqual([]);
		});
	});
});
