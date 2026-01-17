import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import type { DbClient } from "./client";

export const createMockDB = (): DbClient => {
	const sqlite = new Database(":memory:");

	// Initialize schema
	sqlite.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mentions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      url TEXT NOT NULL,
      author TEXT,
      created_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      matched_keywords TEXT NOT NULL DEFAULT '[]',
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_mentions_created_at ON mentions(created_at);
    CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions(source);

    CREATE TABLE IF NOT EXISTS daily_aggregates (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      keyword_id TEXT NOT NULL,
      source TEXT NOT NULL,
      mentions_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, keyword_id, source)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON daily_aggregates(date);
    CREATE INDEX IF NOT EXISTS idx_daily_aggregates_keyword_id ON daily_aggregates(keyword_id);
  `);

	return drizzle({ client: sqlite, schema }) as unknown as DbClient;
};
