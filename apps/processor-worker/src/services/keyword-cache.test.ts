import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { DbClient } from "@trend-monitor/db";
import { createMockDB } from "@trend-monitor/db/mock";
import { KeywordCache } from "./keyword-cache";
import { KeywordsRepository } from "./keywords-repository";

// Mock KV namespace
const createMockKV = () => ({
	get: mock(async () => null),
	put: mock(async () => undefined),
});

describe("KeywordCache", () => {
	let db: DbClient;
	// biome-ignore lint/suspicious/noExplicitAny: Test mock KV namespace
	let kv: any;
	let cache: KeywordCache;

	beforeEach(() => {
		db = createMockDB();
		kv = createMockKV();
		cache = new KeywordCache(db, kv);
	});

	test("loads active keywords from DB on cache miss", async () => {
		// Create test keywords
		const keywordsRepo = new KeywordsRepository(db);
		await keywordsRepo.create({
			name: "ElysiaJS",
			aliases: ["elysia"],
			tags: ["framework"],
		});
		await keywordsRepo.create({
			name: "Cloudflare",
			aliases: ["CF"],
			tags: ["platform"],
		});

		const keywords = await cache.getActiveKeywords();

		expect(keywords.length).toBe(2);
		expect(keywords[0].name).toBe("ElysiaJS");
		expect(kv.put).toHaveBeenCalled(); // Should cache to KV
	});

	test("returns keywords from KV cache on cache hit", async () => {
		const cached = [
			{
				id: "1",
				name: "Test",
				aliases: [],
				tags: [],
				status: "active" as const,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		];

		kv.get = mock(async () => JSON.stringify(cached));

		const keywords = await cache.getActiveKeywords();

		expect(keywords).toEqual(cached);
		expect(kv.get).toHaveBeenCalled();
	});
});
