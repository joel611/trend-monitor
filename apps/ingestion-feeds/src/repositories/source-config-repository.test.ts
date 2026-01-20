import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { SourceConfigRepository } from "./source-config-repository";

describe("SourceConfigRepository", () => {
	let sqlite: Database;
	let db: D1Database;
	let repo: SourceConfigRepository;

	beforeEach(() => {
		// Create in-memory SQLite database
		sqlite = new Database(":memory:");

		// Create source_configs table
		sqlite.exec(`
			CREATE TABLE IF NOT EXISTS source_configs (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL,
				config TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1
			)
		`);

		// Create D1Database-compatible wrapper
		db = {
			prepare: (sql: string) => {
				const stmt = sqlite.prepare(sql);
				return {
					bind: (...values: any[]) => {
						return {
							all: async () => {
								const results = stmt.all(...values) as any[];
								return { results };
							},
						};
					},
				};
			},
		} as any;

		repo = new SourceConfigRepository(db);
	});

	test("should load active feed source configurations", async () => {
		sqlite.exec(`
			INSERT INTO source_configs (id, type, config, enabled)
			VALUES
				('feed-1', 'feed', '${JSON.stringify({
					url: "https://www.reddit.com/r/programming/.rss",
					name: "Reddit r/programming",
				})}', 1),
				('feed-2', 'feed', '${JSON.stringify({
					url: "https://news.ycombinator.com/rss",
					name: "Hacker News",
				})}', 1),
				('feed-3', 'feed', '${JSON.stringify({
					url: "https://disabled.com/feed",
					name: "Disabled Feed",
				})}', 0)
		`);

		const configs = await repo.getActiveConfigs();

		expect(configs).toHaveLength(2);
		expect(configs[0].config.url).toBe("https://www.reddit.com/r/programming/.rss");
		expect(configs[1].config.url).toBe("https://news.ycombinator.com/rss");
	});

	test("should return empty array when no configs exist", async () => {
		const configs = await repo.getActiveConfigs();
		expect(configs).toEqual([]);
	});
});
