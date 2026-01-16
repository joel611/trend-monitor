import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import type { D1Database } from '@cloudflare/workers-types';
import { Database } from 'bun:sqlite';
import { keywordsRoutes } from './routes/keywords';

// Mock DB for testing
const createMockDB = (): D1Database => {
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
    
    CREATE TABLE IF NOT EXISTS mentions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL UNIQUE,
      title TEXT,
      content TEXT,
      url TEXT,
      author TEXT,
      created_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      matched_keywords TEXT NOT NULL DEFAULT '[]'
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
};

const db = createMockDB();

const app = new Elysia({ adapter: CloudflareAdapter })
  .decorate('db', db)
  .get("/api/health", () => ({ status: "ok" }))
  .use(keywordsRoutes(db))
  .get("/api/trends/overview", () => ({ trends: [] }))
  .get("/api/mentions", () => ({ mentions: [] }))
  .compile();

export default app;
