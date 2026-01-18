import { beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@trend-monitor/db";
import { createMockDB } from "@trend-monitor/db/mock";
import { MentionsRepository } from "./mentions-repository";

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
});
