import { describe, expect, test, beforeEach, mock } from "bun:test";
import worker from "./index";
import type { IngestionEvent } from "@trend-monitor/types";
import { mentions, keywords } from "@trend-monitor/db";
import { db } from "./lib/db";
import { KeywordsRepository } from "./services/keywords-repository";

const createMockEnv = () => ({
	KEYWORD_CACHE: {
		get: mock(async () => null),
		put: mock(async () => undefined),
	},
});

describe("Processor Worker", () => {
	let env: any;

	beforeEach(async () => {
		env = createMockEnv();
		// Clear existing data from singleton DB
		await db.delete(mentions);
		await db.delete(keywords);
	});

	test("processes ingestion event and creates mention", async () => {
		// Set up test keyword
		const repo = new KeywordsRepository(db);
		await repo.create({
			name: "ElysiaJS",
			aliases: ["elysia"],
			tags: ["framework"],
		});

		const event: IngestionEvent = {
			source: "reddit",
			sourceId: "test123",
			title: "Check out ElysiaJS",
			content: "I've been using ElysiaJS and it's amazing!",
			url: "https://reddit.com/r/programming/test123",
			author: "testuser",
			createdAt: new Date().toISOString(),
			fetchedAt: new Date().toISOString(),
		};

		const batch = {
			queue: "ingestion-queue",
			messages: [
				{
					id: "msg-1",
					timestamp: new Date(),
					body: event,
				},
			],
		};

		await worker.queue(batch, env);

		// Verify mention was created
		const result = await db.select().from(mentions);

		expect(result.length).toBe(1);
		expect(result[0].source).toBe("reddit");
		expect(result[0].sourceId).toBe("test123");
		expect(result[0].matchedKeywords).toHaveLength(1);
	});

	test("skips event when no keywords match", async () => {
		const event: IngestionEvent = {
			source: "reddit",
			sourceId: "test456",
			title: "Random post",
			content: "Nothing interesting here",
			url: "https://reddit.com/r/programming/test456",
			author: "testuser",
			createdAt: new Date().toISOString(),
			fetchedAt: new Date().toISOString(),
		};

		const batch = {
			queue: "ingestion-queue",
			messages: [
				{
					id: "msg-2",
					timestamp: new Date(),
					body: event,
				},
			],
		};

		await worker.queue(batch, env);

		// Verify no mention was created
		const result = await db.select().from(mentions);

		expect(result.length).toBe(0);
	});

	test("handles duplicate events idempotently", async () => {
		const repo = new KeywordsRepository(db);
		await repo.create({
			name: "Bun",
			aliases: [],
			tags: ["runtime"],
		});

		const event: IngestionEvent = {
			source: "reddit",
			sourceId: "test789",
			title: "Bun is fast",
			content: "Check out Bun runtime",
			url: "https://reddit.com/r/programming/test789",
			author: "testuser",
			createdAt: new Date().toISOString(),
			fetchedAt: new Date().toISOString(),
		};

		const batch = {
			queue: "ingestion-queue",
			messages: [
				{
					id: "msg-3",
					timestamp: new Date(),
					body: event,
				},
			],
		};

		// Process twice
		await worker.queue(batch, env);
		await worker.queue(batch, env);

		// Verify only one mention exists
		const result = await db.select().from(mentions);

		expect(result.length).toBe(1);
	});
});
