import { beforeEach, describe, expect, test } from "bun:test";
import { createMockDB } from "../mock";
import { sourceConfigs, type DbClient } from "../index";
import { SourceConfigRepository } from "./source-config-repository";

describe("SourceConfigRepository", () => {
	let db: DbClient;
	let repo: SourceConfigRepository;

	beforeEach(() => {
		db = createMockDB();
		repo = new SourceConfigRepository(db);
	});

	test("should load enabled feed source configurations", async () => {
		await db.insert(sourceConfigs).values([
			{
				id: "feed-1",
				type: "feed",
				config: {
					url: "https://www.reddit.com/r/programming/.rss",
					name: "Reddit r/programming",
				},
				enabled: true,
			},
			{
				id: "feed-2",
				type: "feed",
				config: {
					url: "https://news.ycombinator.com/rss",
					name: "Hacker News",
				},
				enabled: true,
			},
			{
				id: "feed-3",
				type: "feed",
				config: {
					url: "https://disabled.com/feed",
					name: "Disabled Feed",
				},
				enabled: false,
			},
		]);

		const configs = await repo.listEnabled();

		expect(configs).toHaveLength(2);
		expect(configs[0].config.url).toBe("https://www.reddit.com/r/programming/.rss");
		expect(configs[1].config.url).toBe("https://news.ycombinator.com/rss");
	});

	test("should return empty array when no configs exist", async () => {
		const configs = await repo.listEnabled();
		expect(configs).toEqual([]);
	});

	test("should only return feed type configs", async () => {
		await db.insert(sourceConfigs).values([
			{
				id: "feed-1",
				type: "feed",
				config: { url: "https://example.com/feed", name: "Example Feed" },
				enabled: true,
			},
			{
				id: "x-1",
				type: "x",
				config: { query: "#test", name: "X Query" },
				enabled: true,
			},
		]);

		const configs = await repo.listEnabled();

		expect(configs).toHaveLength(1);
		expect(configs[0].type).toBe("feed");
	});
});
