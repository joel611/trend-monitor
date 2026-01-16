import { describe, expect, test, beforeEach } from "bun:test";
import { Database } from 'bun:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { TrendsService } from "./trends-service";

// Helper to create mock D1 database
function createMockDb(): D1Database {
  const db = new Database(':memory:');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_aggregates (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      keyword_id TEXT NOT NULL,
      source TEXT NOT NULL,
      mentions_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, keyword_id, source)
    );
  `);

  // Wrap bun:sqlite to match D1Database interface
  return {
    prepare: (query: string) => {
      const stmt = db.prepare(query);
      return {
        bind: (...args: any[]) => ({
          all: () => {
            try {
              const result = stmt.all(...args);
              return Promise.resolve({ results: Array.isArray(result) ? result : [result], success: true });
            } catch (err) {
              return Promise.reject(err);
            }
          },
          first: () => {
            try {
              const result = stmt.get(...args);
              return Promise.resolve(result === undefined ? null : result);
            } catch (err) {
              return Promise.reject(err);
            }
          },
          run: () => {
            try {
              const result = stmt.run(...args);
              return Promise.resolve({ success: true, meta: { changes: result.changes } });
            } catch (err) {
              return Promise.reject(err);
            }
          }
        }),
        all: () => {
          try {
            const result = stmt.all();
            return Promise.resolve({ results: Array.isArray(result) ? result : [result], success: true });
          } catch (err) {
            return Promise.reject(err);
          }
        },
        first: () => {
          try {
            const result = stmt.get();
            return Promise.resolve(result === undefined ? null : result);
          } catch (err) {
            return Promise.reject(err);
          }
        },
        run: () => {
          try {
            const result = stmt.run();
            return Promise.resolve({ success: true, meta: { changes: result.changes } });
          } catch (err) {
            return Promise.reject(err);
          }
        }
      };
    },
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    batch: (statements: any[]) => Promise.resolve([]),
    exec: (query: string) => {
      db.exec(query);
      return Promise.resolve({ count: 0, duration: 0 });
    }
  } as any;
}

describe("TrendsService", () => {
  let db: D1Database;
  let service: TrendsService;

  beforeEach(() => {
    db = createMockDb();
    service = new TrendsService(db);

    // Clean up tables
    (db as any).prepare('DELETE FROM keywords').run();
    (db as any).prepare('DELETE FROM daily_aggregates').run();
  });

  describe("getOverview", () => {
    test("returns trends data with top keywords", async () => {
      // Insert test data
      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-2', 'Vue', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      // Add daily aggregates for current period (2026-01-10 to 2026-01-16)
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-1', '2026-01-15', 'kw-1', 'reddit', 50)
        .run();

      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-2', '2026-01-15', 'kw-2', 'x', 30)
        .run();

      const result = await service.getOverview({
        from: "2026-01-10",
        to: "2026-01-16",
      });

      expect(result.topKeywords).toBeDefined();
      expect(result.emergingKeywords).toBeDefined();
      expect(result.totalMentions).toBeGreaterThan(0);
      expect(result.sourceBreakdown).toBeDefined();
      expect(Array.isArray(result.topKeywords)).toBe(true);
    });

    test("calculates growth rates correctly", async () => {
      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      // Previous period: 2026-01-01 to 2026-01-07 (10 mentions)
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-1', '2026-01-05', 'kw-1', 'reddit', 10)
        .run();

      // Current period: 2026-01-08 to 2026-01-14 (20 mentions)
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-2', '2026-01-12', 'kw-1', 'reddit', 20)
        .run();

      const result = await service.getOverview({
        from: "2026-01-08",
        to: "2026-01-14",
      });

      expect(result.topKeywords.length).toBeGreaterThan(0);
      const keyword = result.topKeywords[0];
      expect(keyword.currentPeriod).toBe(20);
      expect(keyword.previousPeriod).toBe(10);
      expect(keyword.growthRate).toBe(100); // 100% growth
    });

    test("identifies emerging keywords", async () => {
      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-1', 'NewTech', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      // Previous period: 2 mentions (below threshold)
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-1', '2026-01-05', 'kw-1', 'reddit', 2)
        .run();

      // Current period: 15 mentions (above threshold)
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-2', '2026-01-12', 'kw-1', 'reddit', 15)
        .run();

      const result = await service.getOverview({
        from: "2026-01-08",
        to: "2026-01-14",
      });

      expect(result.emergingKeywords.length).toBeGreaterThan(0);
      const emerging = result.emergingKeywords[0];
      expect(emerging.isEmerging).toBe(true);
      expect(emerging.name).toBe('NewTech');
    });
  });

  describe("getKeywordTrend", () => {
    test("returns time series for keyword", async () => {
      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-1', '2026-01-10', 'kw-1', 'reddit', 10)
        .run();

      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-2', '2026-01-11', 'kw-1', 'x', 5)
        .run();

      const result = await service.getKeywordTrend("kw-1", {
        from: "2026-01-10",
        to: "2026-01-11",
      });

      expect(result.timeSeries).toBeDefined();
      expect(Array.isArray(result.timeSeries)).toBe(true);
      expect(result.timeSeries.length).toBe(2);
      expect(result.totalMentions).toBe(15);
      expect(result.name).toBe('React');
    });

    test("filters by source", async () => {
      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-1', '2026-01-10', 'kw-1', 'reddit', 10)
        .run();

      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-2', '2026-01-10', 'kw-1', 'x', 5)
        .run();

      const result = await service.getKeywordTrend("kw-1", {
        from: "2026-01-10",
        to: "2026-01-10",
        source: "reddit",
      });

      expect(result.timeSeries.length).toBe(1);
      expect(result.timeSeries[0].source).toBe('reddit');
      expect(result.totalMentions).toBe(10);
    });

    test("calculates average per day", async () => {
      await db.prepare('INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('kw-1', 'React', '[]', '[]', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        .run();

      // Day 1: 10 mentions
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-1', '2026-01-10', 'kw-1', 'reddit', 10)
        .run();

      // Day 2: 20 mentions
      await db.prepare('INSERT INTO daily_aggregates (id, date, keyword_id, source, mentions_count) VALUES (?, ?, ?, ?, ?)')
        .bind('agg-2', '2026-01-11', 'kw-1', 'reddit', 20)
        .run();

      const result = await service.getKeywordTrend("kw-1", {
        from: "2026-01-10",
        to: "2026-01-11",
      });

      expect(result.totalMentions).toBe(30);
      expect(result.averagePerDay).toBe(15); // 30 / 2 days
    });
  });
});
