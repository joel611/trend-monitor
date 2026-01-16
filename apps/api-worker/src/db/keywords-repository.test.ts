// apps/api-worker/src/db/keywords-repository.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { KeywordsRepository } from "./keywords-repository";
import type { D1Database } from "@cloudflare/workers-types";
import type { KeywordRow } from "@trend-monitor/types";

// Mock D1 database
function createMockDb(): D1Database {
  const data = new Map<string, KeywordRow>();

  return {
    prepare: (query: string) => {
      const bindMethod = (...params: any[]) => ({
        first: async () => {
          if (query.includes("SELECT * FROM keywords WHERE id = ?")) {
            return data.get(params[0]) || null;
          }
          return null;
        },
        all: async () => {
          return { results: Array.from(data.values()) };
        },
        run: async () => {
          if (query.includes("INSERT")) {
            const [id, name, aliases, tags, status, created_at, updated_at] = params;
            data.set(id, {
              id,
              name,
              aliases,
              tags,
              status,
              created_at,
              updated_at,
            });
          } else if (query.includes("UPDATE keywords SET status = 'archived'")) {
            const [updated_at, id] = params;
            const existing = data.get(id);
            if (existing) {
              data.set(id, { ...existing, status: "archived", updated_at });
            }
          }
          return { success: true };
        },
      });

      return {
        bind: bindMethod,
        all: async () => ({
          results: Array.from(data.values()),
        }),
      } as any;
    },
  } as any;
}

describe("KeywordsRepository", () => {
  let db: D1Database;
  let repo: KeywordsRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new KeywordsRepository(db);
  });

  test("create inserts keyword", async () => {
    const keyword = await repo.create({
      name: "ElysiaJS",
      aliases: ["elysia"],
      tags: ["framework"],
    });

    expect(keyword.name).toBe("ElysiaJS");
    expect(keyword.status).toBe("active");
  });

  test("findById returns keyword", async () => {
    const created = await repo.create({ name: "Test", aliases: [], tags: [] });
    const found = await repo.findById(created.id);
    expect(found?.name).toBe("Test");
  });

  test("list returns all keywords", async () => {
    await repo.create({ name: "Test1", aliases: [], tags: [] });
    await repo.create({ name: "Test2", aliases: [], tags: [] });
    const list = await repo.list();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});
