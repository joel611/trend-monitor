# API Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build complete ElysiaJS API with CRUD endpoints for keywords, trends, and mentions

**Architecture:** RESTful JSON API running on Cloudflare Workers with ElysiaJS, connecting to D1 database for data persistence and KV for caching. Follows TDD approach with isolated route handlers and database access layers.

**Tech Stack:** ElysiaJS, Cloudflare D1, Cloudflare KV, TypeScript, Bun test, Zod validation

---

## Task 1: Database Schema Setup

**Files:**
- Create: `apps/api-worker/migrations/0001_init_schema.sql`
- Create: `apps/api-worker/scripts/migrate.ts`

**Step 1: Write the migration SQL**

Create migration file with complete schema:

```sql
-- migrations/0001_init_schema.sql

-- Keywords table
CREATE TABLE IF NOT EXISTS keywords (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK(source IN ('reddit', 'x', 'feed')),
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

-- Daily aggregates table
CREATE TABLE IF NOT EXISTS daily_aggregates (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    keyword_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('reddit', 'x', 'feed')),
    mentions_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, keyword_id, source)
);

CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON daily_aggregates(date);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_keyword_id ON daily_aggregates(keyword_id);
```

**Step 2: Create migration script**

```typescript
// scripts/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface D1Database {
  exec(query: string): Promise<{ success: boolean }>;
}

export async function runMigrations(db: D1Database) {
  const migrationsDir = join(__dirname, "../migrations");
  const files = await readdir(migrationsDir);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    const sql = await readFile(join(migrationsDir, file), "utf-8");
    const result = await db.exec(sql);
    if (!result.success) {
      throw new Error(`Migration ${file} failed`);
    }
    console.log(`Applied migration: ${file}`);
  }
}
```

**Step 3: Add migration to wrangler.toml**

Update `apps/api-worker/wrangler.toml` to reference migrations:

```toml
[[d1_databases]]
binding = "DB"
database_name = "trend-monitor-local"
database_id = "local"
migrations_dir = "migrations"
```

**Step 4: Run migration locally**

Run: `cd apps/api-worker && wrangler d1 execute trend-monitor-local --local --file migrations/0001_init_schema.sql`
Expected: "Executed 0001_init_schema.sql successfully"

**Step 5: Commit**

```bash
git add apps/api-worker/migrations apps/api-worker/scripts apps/api-worker/wrangler.toml
git commit -m "feat(api): add D1 database schema migrations

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Database Access Layer - Types

**Files:**
- Create: `packages/types/src/db.ts`
- Modify: `packages/types/src/index.ts`

**Step 1: Write failing test for DB types**

```typescript
// packages/types/src/db.test.ts
import { describe, expect, test } from "bun:test";
import type { KeywordRow, MentionRow, DailyAggregateRow } from "./db";

describe("Database Types", () => {
  test("KeywordRow has all required fields", () => {
    const row: KeywordRow = {
      id: "kw-1",
      name: "test",
      aliases: "[]",
      tags: "[]",
      status: "active",
      created_at: "2026-01-16T00:00:00Z",
      updated_at: "2026-01-16T00:00:00Z",
    };
    expect(row.id).toBe("kw-1");
  });

  test("MentionRow has all required fields", () => {
    const row: MentionRow = {
      id: "m-1",
      source: "reddit",
      source_id: "abc123",
      title: "Test",
      content: "Content",
      url: "https://example.com",
      author: "user",
      created_at: "2026-01-16T00:00:00Z",
      fetched_at: "2026-01-16T00:00:00Z",
      matched_keywords: "[]",
    };
    expect(row.source).toBe("reddit");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/types && bun test`
Expected: FAIL with "Cannot find module './db'"

**Step 3: Implement DB types**

```typescript
// packages/types/src/db.ts

/**
 * Database row types - matches D1 schema exactly
 */

export interface KeywordRow {
  id: string;
  name: string;
  aliases: string; // JSON string
  tags: string; // JSON string
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface MentionRow {
  id: string;
  source: "reddit" | "x" | "feed";
  source_id: string;
  title: string | null;
  content: string;
  url: string;
  author: string | null;
  created_at: string;
  fetched_at: string;
  matched_keywords: string; // JSON string
}

export interface DailyAggregateRow {
  id: string;
  date: string;
  keyword_id: string;
  source: "reddit" | "x" | "feed";
  mentions_count: number;
}
```

**Step 4: Export from index**

```typescript
// packages/types/src/index.ts (add to existing)
export * from "./db";
```

**Step 5: Run test to verify it passes**

Run: `cd packages/types && bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/types
git commit -m "feat(types): add database row types

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Database Access Layer - Repository Pattern

**Files:**
- Create: `apps/api-worker/src/db/keywords-repository.ts`
- Create: `apps/api-worker/src/db/keywords-repository.test.ts`

**Step 1: Write failing test for keywords repository**

```typescript
// apps/api-worker/src/db/keywords-repository.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { KeywordsRepository } from "./keywords-repository";
import type { D1Database } from "@cloudflare/workers-types";

// Mock D1 database
function createMockDb(): D1Database {
  const data = new Map<string, any>();

  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        first: async () => data.get(params[0]) || null,
        all: async () => ({ results: Array.from(data.values()) }),
        run: async () => {
          if (query.includes("INSERT")) {
            data.set(params[0], { id: params[0], name: params[1] });
          }
          return { success: true };
        },
      }),
    }),
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
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL with "Cannot find module './db/keywords-repository'"

**Step 3: Implement keywords repository**

```typescript
// apps/api-worker/src/db/keywords-repository.ts
import type { D1Database } from "@cloudflare/workers-types";
import type { Keyword, KeywordRow } from "@trend-monitor/types";
import { randomUUID } from "node:crypto";

export class KeywordsRepository {
  constructor(private db: D1Database) {}

  async create(input: {
    name: string;
    aliases: string[];
    tags: string[];
  }): Promise<Keyword> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        "INSERT INTO keywords (id, name, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        input.name,
        JSON.stringify(input.aliases),
        JSON.stringify(input.tags),
        "active",
        now,
        now
      )
      .run();

    return {
      id,
      name: input.name,
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Keyword | null> {
    const row = await this.db
      .prepare("SELECT * FROM keywords WHERE id = ?")
      .bind(id)
      .first<KeywordRow>();

    return row ? this.rowToEntity(row) : null;
  }

  async list(): Promise<Keyword[]> {
    const result = await this.db
      .prepare("SELECT * FROM keywords ORDER BY created_at DESC")
      .all<KeywordRow>();

    return result.results.map(this.rowToEntity);
  }

  async update(
    id: string,
    input: {
      name?: string;
      aliases?: string[];
      tags?: string[];
      status?: "active" | "archived";
    }
  ): Promise<Keyword | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      params.push(input.name);
    }
    if (input.aliases !== undefined) {
      updates.push("aliases = ?");
      params.push(JSON.stringify(input.aliases));
    }
    if (input.tags !== undefined) {
      updates.push("tags = ?");
      params.push(JSON.stringify(input.tags));
    }
    if (input.status !== undefined) {
      updates.push("status = ?");
      params.push(input.status);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await this.db
      .prepare(`UPDATE keywords SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare("UPDATE keywords SET status = 'archived', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();

    return result.success;
  }

  private rowToEntity(row: KeywordRow): Keyword {
    return {
      id: row.id,
      name: row.name,
      aliases: JSON.parse(row.aliases),
      tags: JSON.parse(row.tags),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api-worker/src/db
git commit -m "feat(api): add keywords repository with CRUD operations

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: API Request/Response DTOs

**Files:**
- Create: `packages/types/src/api.ts`
- Modify: `packages/types/src/index.ts`

**Step 1: Write failing test for DTOs**

```typescript
// packages/types/src/api.test.ts
import { describe, expect, test } from "bun:test";
import {
  CreateKeywordRequest,
  UpdateKeywordRequest,
  KeywordResponse,
  ListKeywordsResponse,
} from "./api";

describe("API DTOs", () => {
  test("CreateKeywordRequest has required fields", () => {
    const req: CreateKeywordRequest = {
      name: "test",
      aliases: [],
      tags: [],
    };
    expect(req.name).toBe("test");
  });

  test("UpdateKeywordRequest has optional fields", () => {
    const req: UpdateKeywordRequest = {
      name: "updated",
    };
    expect(req.aliases).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/types && bun test`
Expected: FAIL with "Cannot find module './api'"

**Step 3: Implement API DTOs**

```typescript
// packages/types/src/api.ts

/**
 * API Request/Response DTOs
 */

// Keywords API
export interface CreateKeywordRequest {
  name: string;
  aliases?: string[];
  tags?: string[];
}

export interface UpdateKeywordRequest {
  name?: string;
  aliases?: string[];
  tags?: string[];
  status?: "active" | "archived";
}

export interface KeywordResponse {
  id: string;
  name: string;
  aliases: string[];
  tags: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  stats?: {
    last7Days: number;
    last30Days: number;
  };
}

export interface ListKeywordsResponse {
  keywords: KeywordResponse[];
  total: number;
}

// Trends API
export interface TrendsOverviewRequest {
  from?: string;
  to?: string;
}

export interface TrendKeyword {
  keywordId: string;
  name: string;
  currentPeriod: number;
  previousPeriod: number;
  growthRate: number;
  isEmerging: boolean;
}

export interface TrendsOverviewResponse {
  topKeywords: TrendKeyword[];
  emergingKeywords: TrendKeyword[];
  totalMentions: number;
  sourceBreakdown: {
    source: string;
    count: number;
  }[];
}

export interface KeywordTrendRequest {
  from?: string;
  to?: string;
  source?: "reddit" | "x" | "feed";
}

export interface TimeSeriesDataPoint {
  date: string;
  count: number;
  source?: string;
}

export interface KeywordTrendResponse {
  keywordId: string;
  name: string;
  timeSeries: TimeSeriesDataPoint[];
  totalMentions: number;
  averagePerDay: number;
}

// Mentions API
export interface ListMentionsRequest {
  keywordId?: string;
  source?: "reddit" | "x" | "feed";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface MentionResponse {
  id: string;
  source: "reddit" | "x" | "feed";
  sourceId: string;
  title?: string;
  content: string;
  url: string;
  author?: string;
  createdAt: string;
  fetchedAt: string;
  matchedKeywords: string[];
}

export interface ListMentionsResponse {
  mentions: MentionResponse[];
  total: number;
  limit: number;
  offset: number;
}
```

**Step 4: Export from index**

```typescript
// packages/types/src/index.ts (add to existing)
export * from "./api";
```

**Step 5: Run test to verify it passes**

Run: `cd packages/types && bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/types
git commit -m "feat(types): add API request/response DTOs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Keywords API Endpoints

**Files:**
- Create: `apps/api-worker/src/routes/keywords.ts`
- Create: `apps/api-worker/src/routes/keywords.test.ts`
- Modify: `apps/api-worker/src/index.ts`

**Step 1: Write failing test for keywords routes**

```typescript
// apps/api-worker/src/routes/keywords.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../index";

describe("Keywords API", () => {
  let api: ReturnType<typeof treaty<App>>;

  beforeEach(() => {
    // Mock setup
  });

  test("POST /api/keywords creates keyword", async () => {
    const response = await api.api.keywords.post({
      name: "ElysiaJS",
      aliases: ["elysia"],
      tags: ["framework"],
    });

    expect(response.status).toBe(201);
    expect(response.data?.name).toBe("ElysiaJS");
  });

  test("GET /api/keywords lists keywords", async () => {
    const response = await api.api.keywords.get();
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data?.keywords)).toBe(true);
  });

  test("GET /api/keywords/:id returns keyword", async () => {
    const created = await api.api.keywords.post({
      name: "Test",
      aliases: [],
      tags: [],
    });

    const response = await api.api.keywords({ id: created.data!.id }).get();
    expect(response.status).toBe(200);
    expect(response.data?.name).toBe("Test");
  });

  test("PUT /api/keywords/:id updates keyword", async () => {
    const created = await api.api.keywords.post({
      name: "Test",
      aliases: [],
      tags: [],
    });

    const response = await api.api.keywords({ id: created.data!.id }).put({
      name: "Updated",
    });

    expect(response.status).toBe(200);
    expect(response.data?.name).toBe("Updated");
  });

  test("DELETE /api/keywords/:id archives keyword", async () => {
    const created = await api.api.keywords.post({
      name: "Test",
      aliases: [],
      tags: [],
    });

    const response = await api.api.keywords({ id: created.data!.id }).delete();
    expect(response.status).toBe(204);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL with "Cannot find module './routes/keywords'"

**Step 3: Implement keywords routes**

```typescript
// apps/api-worker/src/routes/keywords.ts
import { Elysia, t } from "elysia";
import { KeywordsRepository } from "../db/keywords-repository";
import type {
  CreateKeywordRequest,
  UpdateKeywordRequest,
  KeywordResponse,
  ListKeywordsResponse,
} from "@trend-monitor/types";

export const keywordsRoutes = new Elysia({ prefix: "/api/keywords" })
  .derive(({ env }) => ({
    keywordsRepo: new KeywordsRepository(env.DB),
  }))
  .get(
    "",
    async ({ keywordsRepo }): Promise<ListKeywordsResponse> => {
      const keywords = await keywordsRepo.list();
      return {
        keywords: keywords.map(toResponse),
        total: keywords.length,
      };
    }
  )
  .post(
    "",
    async ({ keywordsRepo, body }): Promise<KeywordResponse> => {
      const keyword = await keywordsRepo.create({
        name: body.name,
        aliases: body.aliases || [],
        tags: body.tags || [],
      });
      return toResponse(keyword);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        aliases: t.Optional(t.Array(t.String())),
        tags: t.Optional(t.Array(t.String())),
      }),
    }
  )
  .get(
    "/:id",
    async ({ keywordsRepo, params, error }) => {
      const keyword = await keywordsRepo.findById(params.id);
      if (!keyword) {
        return error(404, { message: "Keyword not found" });
      }
      return toResponse(keyword);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .put(
    "/:id",
    async ({ keywordsRepo, params, body, error }) => {
      const keyword = await keywordsRepo.update(params.id, body);
      if (!keyword) {
        return error(404, { message: "Keyword not found" });
      }
      return toResponse(keyword);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        aliases: t.Optional(t.Array(t.String())),
        tags: t.Optional(t.Array(t.String())),
        status: t.Optional(t.Union([t.Literal("active"), t.Literal("archived")])),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ keywordsRepo, params, error }) => {
      const success = await keywordsRepo.delete(params.id);
      if (!success) {
        return error(404, { message: "Keyword not found" });
      }
      return new Response(null, { status: 204 });
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );

function toResponse(keyword: any): KeywordResponse {
  return {
    id: keyword.id,
    name: keyword.name,
    aliases: keyword.aliases,
    tags: keyword.tags,
    status: keyword.status,
    createdAt: keyword.createdAt,
    updatedAt: keyword.updatedAt,
  };
}
```

**Step 4: Integrate routes into main app**

```typescript
// apps/api-worker/src/index.ts
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { keywordsRoutes } from "./routes/keywords";

const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/api/health", () => ({ status: "ok" }))
  .use(keywordsRoutes)
  .compile();

export default app;
export type App = typeof app;
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api-worker/src
git commit -m "feat(api): implement keywords CRUD endpoints

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Mentions Repository

**Files:**
- Create: `apps/api-worker/src/db/mentions-repository.ts`
- Create: `apps/api-worker/src/db/mentions-repository.test.ts`

**Step 1: Write failing test**

```typescript
// apps/api-worker/src/db/mentions-repository.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { MentionsRepository } from "./mentions-repository";
import type { D1Database } from "@cloudflare/workers-types";

describe("MentionsRepository", () => {
  let db: D1Database;
  let repo: MentionsRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new MentionsRepository(db);
  });

  test("list returns paginated mentions", async () => {
    const result = await repo.list({
      limit: 10,
      offset: 0,
    });
    expect(result.mentions).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  test("list filters by keywordId", async () => {
    const result = await repo.list({
      keywordId: "kw-1",
      limit: 10,
      offset: 0,
    });
    expect(result.mentions).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL

**Step 3: Implement mentions repository**

```typescript
// apps/api-worker/src/db/mentions-repository.ts
import type { D1Database } from "@cloudflare/workers-types";
import type { Mention, MentionRow } from "@trend-monitor/types";

export interface MentionFilters {
  keywordId?: string;
  source?: "reddit" | "x" | "feed";
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface MentionListResult {
  mentions: Mention[];
  total: number;
}

export class MentionsRepository {
  constructor(private db: D1Database) {}

  async list(filters: MentionFilters): Promise<MentionListResult> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.keywordId) {
      conditions.push("json_array_length(matched_keywords) > 0");
      conditions.push("matched_keywords LIKE ?");
      params.push(`%"${filters.keywordId}"%`);
    }

    if (filters.source) {
      conditions.push("source = ?");
      params.push(filters.source);
    }

    if (filters.from) {
      conditions.push("created_at >= ?");
      params.push(filters.from);
    }

    if (filters.to) {
      conditions.push("created_at <= ?");
      params.push(filters.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as count FROM mentions ${whereClause}`)
      .bind(...params)
      .first<{ count: number }>();

    const total = countResult?.count || 0;

    // Get paginated results
    const result = await this.db
      .prepare(
        `SELECT * FROM mentions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset)
      .all<MentionRow>();

    return {
      mentions: result.results.map(this.rowToEntity),
      total,
    };
  }

  async findById(id: string): Promise<Mention | null> {
    const row = await this.db
      .prepare("SELECT * FROM mentions WHERE id = ?")
      .bind(id)
      .first<MentionRow>();

    return row ? this.rowToEntity(row) : null;
  }

  private rowToEntity(row: MentionRow): Mention {
    return {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      title: row.title || undefined,
      content: row.content,
      url: row.url,
      author: row.author || undefined,
      createdAt: row.created_at,
      fetchedAt: row.fetched_at,
      matchedKeywords: JSON.parse(row.matched_keywords),
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api-worker/src/db
git commit -m "feat(api): add mentions repository with filtering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Mentions API Endpoints

**Files:**
- Create: `apps/api-worker/src/routes/mentions.ts`
- Modify: `apps/api-worker/src/index.ts`

**Step 1: Write failing test**

```typescript
// apps/api-worker/src/routes/mentions.test.ts
import { describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../index";

describe("Mentions API", () => {
  test("GET /api/mentions lists mentions", async () => {
    const api = treaty<App>("http://localhost");
    const response = await api.api.mentions.get({
      query: { limit: 10, offset: 0 },
    });

    expect(response.status).toBe(200);
    expect(response.data?.mentions).toBeDefined();
  });

  test("GET /api/mentions filters by keywordId", async () => {
    const api = treaty<App>("http://localhost");
    const response = await api.api.mentions.get({
      query: { keywordId: "kw-1", limit: 10, offset: 0 },
    });

    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL

**Step 3: Implement mentions routes**

```typescript
// apps/api-worker/src/routes/mentions.ts
import { Elysia, t } from "elysia";
import { MentionsRepository } from "../db/mentions-repository";
import type { ListMentionsResponse, MentionResponse } from "@trend-monitor/types";

export const mentionsRoutes = new Elysia({ prefix: "/api/mentions" })
  .derive(({ env }) => ({
    mentionsRepo: new MentionsRepository(env.DB),
  }))
  .get(
    "",
    async ({ mentionsRepo, query }): Promise<ListMentionsResponse> => {
      const result = await mentionsRepo.list({
        keywordId: query.keywordId,
        source: query.source,
        from: query.from,
        to: query.to,
        limit: query.limit || 20,
        offset: query.offset || 0,
      });

      return {
        mentions: result.mentions.map(toResponse),
        total: result.total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      };
    },
    {
      query: t.Object({
        keywordId: t.Optional(t.String()),
        source: t.Optional(t.Union([t.Literal("reddit"), t.Literal("x"), t.Literal("feed")])),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )
  .get(
    "/:id",
    async ({ mentionsRepo, params, error }) => {
      const mention = await mentionsRepo.findById(params.id);
      if (!mention) {
        return error(404, { message: "Mention not found" });
      }
      return toResponse(mention);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );

function toResponse(mention: any): MentionResponse {
  return {
    id: mention.id,
    source: mention.source,
    sourceId: mention.sourceId,
    title: mention.title,
    content: mention.content,
    url: mention.url,
    author: mention.author,
    createdAt: mention.createdAt,
    fetchedAt: mention.fetchedAt,
    matchedKeywords: mention.matchedKeywords,
  };
}
```

**Step 4: Integrate into main app**

```typescript
// apps/api-worker/src/index.ts (modify)
import { mentionsRoutes } from "./routes/mentions";

const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/api/health", () => ({ status: "ok" }))
  .use(keywordsRoutes)
  .use(mentionsRoutes)
  .compile();
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api-worker/src
git commit -m "feat(api): implement mentions listing endpoints

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Trends Service Layer

**Files:**
- Create: `apps/api-worker/src/services/trends-service.ts`
- Create: `apps/api-worker/src/services/trends-service.test.ts`

**Step 1: Write failing test**

```typescript
// apps/api-worker/src/services/trends-service.test.ts
import { describe, expect, test } from "bun:test";
import { TrendsService } from "./trends-service";

describe("TrendsService", () => {
  test("getOverview returns trends data", async () => {
    const db = createMockDb();
    const service = new TrendsService(db);

    const result = await service.getOverview({
      from: "2026-01-01",
      to: "2026-01-16",
    });

    expect(result.topKeywords).toBeDefined();
    expect(result.emergingKeywords).toBeDefined();
  });

  test("getKeywordTrend returns time series", async () => {
    const db = createMockDb();
    const service = new TrendsService(db);

    const result = await service.getKeywordTrend("kw-1", {
      from: "2026-01-01",
      to: "2026-01-16",
    });

    expect(result.timeSeries).toBeDefined();
    expect(Array.isArray(result.timeSeries)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL

**Step 3: Implement trends service**

```typescript
// apps/api-worker/src/services/trends-service.ts
import type { D1Database } from "@cloudflare/workers-types";
import type {
  TrendsOverviewResponse,
  KeywordTrendResponse,
  TrendKeyword,
} from "@trend-monitor/types";

export class TrendsService {
  constructor(private db: D1Database) {}

  async getOverview(params: {
    from?: string;
    to?: string;
  }): Promise<TrendsOverviewResponse> {
    const to = params.to || new Date().toISOString().split("T")[0];
    const from = params.from || this.subtractDays(to, 7);

    // Get top keywords by mentions in current period
    const topKeywordsResult = await this.db
      .prepare(
        `SELECT k.id, k.name, SUM(da.mentions_count) as total
         FROM daily_aggregates da
         JOIN keywords k ON da.keyword_id = k.id
         WHERE da.date >= ? AND da.date <= ?
         GROUP BY k.id, k.name
         ORDER BY total DESC
         LIMIT 10`
      )
      .bind(from, to)
      .all<{ id: string; name: string; total: number }>();

    // Calculate growth rates
    const topKeywords: TrendKeyword[] = [];
    for (const row of topKeywordsResult.results) {
      const prevFrom = this.subtractDays(from, 7);
      const prevTo = this.subtractDays(to, 7);

      const prevResult = await this.db
        .prepare(
          `SELECT SUM(mentions_count) as total
           FROM daily_aggregates
           WHERE keyword_id = ? AND date >= ? AND date <= ?`
        )
        .bind(row.id, prevFrom, prevTo)
        .first<{ total: number }>();

      const previousPeriod = prevResult?.total || 0;
      const growthRate =
        previousPeriod > 0 ? ((row.total - previousPeriod) / previousPeriod) * 100 : 100;
      const isEmerging = previousPeriod < 3 && row.total >= 10;

      topKeywords.push({
        keywordId: row.id,
        name: row.name,
        currentPeriod: row.total,
        previousPeriod,
        growthRate,
        isEmerging,
      });
    }

    // Get source breakdown
    const sourceResult = await this.db
      .prepare(
        `SELECT source, SUM(mentions_count) as count
         FROM daily_aggregates
         WHERE date >= ? AND date <= ?
         GROUP BY source`
      )
      .bind(from, to)
      .all<{ source: string; count: number }>();

    return {
      topKeywords,
      emergingKeywords: topKeywords.filter((k) => k.isEmerging),
      totalMentions: topKeywords.reduce((sum, k) => sum + k.currentPeriod, 0),
      sourceBreakdown: sourceResult.results.map((r) => ({
        source: r.source,
        count: r.count,
      })),
    };
  }

  async getKeywordTrend(
    keywordId: string,
    params: { from?: string; to?: string; source?: string }
  ): Promise<KeywordTrendResponse> {
    const to = params.to || new Date().toISOString().split("T")[0];
    const from = params.from || this.subtractDays(to, 30);

    const conditions = ["keyword_id = ?", "date >= ?", "date <= ?"];
    const bindParams: any[] = [keywordId, from, to];

    if (params.source) {
      conditions.push("source = ?");
      bindParams.push(params.source);
    }

    const result = await this.db
      .prepare(
        `SELECT date, source, SUM(mentions_count) as count
         FROM daily_aggregates
         WHERE ${conditions.join(" AND ")}
         GROUP BY date, source
         ORDER BY date ASC`
      )
      .bind(...bindParams)
      .all<{ date: string; source: string; count: number }>();

    // Get keyword name
    const keyword = await this.db
      .prepare("SELECT name FROM keywords WHERE id = ?")
      .bind(keywordId)
      .first<{ name: string }>();

    const totalMentions = result.results.reduce((sum, r) => sum + r.count, 0);
    const dayCount = new Set(result.results.map((r) => r.date)).size;

    return {
      keywordId,
      name: keyword?.name || "",
      timeSeries: result.results.map((r) => ({
        date: r.date,
        count: r.count,
        source: r.source,
      })),
      totalMentions,
      averagePerDay: dayCount > 0 ? totalMentions / dayCount : 0,
    };
  }

  private subtractDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api-worker/src/services
git commit -m "feat(api): add trends service with growth calculation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Trends API Endpoints

**Files:**
- Create: `apps/api-worker/src/routes/trends.ts`
- Modify: `apps/api-worker/src/index.ts`

**Step 1: Write failing test**

```typescript
// apps/api-worker/src/routes/trends.test.ts
import { describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../index";

describe("Trends API", () => {
  test("GET /api/trends/overview returns overview", async () => {
    const api = treaty<App>("http://localhost");
    const response = await api.api.trends.overview.get();

    expect(response.status).toBe(200);
    expect(response.data?.topKeywords).toBeDefined();
  });

  test("GET /api/trends/:keywordId returns trend data", async () => {
    const api = treaty<App>("http://localhost");
    const response = await api.api.trends({ keywordId: "kw-1" }).get();

    expect(response.status).toBe(200);
    expect(response.data?.timeSeries).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL

**Step 3: Implement trends routes**

```typescript
// apps/api-worker/src/routes/trends.ts
import { Elysia, t } from "elysia";
import { TrendsService } from "../services/trends-service";

export const trendsRoutes = new Elysia({ prefix: "/api/trends" })
  .derive(({ env }) => ({
    trendsService: new TrendsService(env.DB),
  }))
  .get(
    "/overview",
    async ({ trendsService, query }) => {
      return await trendsService.getOverview({
        from: query.from,
        to: query.to,
      });
    },
    {
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:keywordId",
    async ({ trendsService, params, query, error }) => {
      try {
        return await trendsService.getKeywordTrend(params.keywordId, {
          from: query.from,
          to: query.to,
          source: query.source,
        });
      } catch (err) {
        return error(404, { message: "Keyword not found" });
      }
    },
    {
      params: t.Object({
        keywordId: t.String(),
      }),
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        source: t.Optional(t.Union([t.Literal("reddit"), t.Literal("x"), t.Literal("feed")])),
      }),
    }
  );
```

**Step 4: Integrate into main app**

```typescript
// apps/api-worker/src/index.ts (modify)
import { trendsRoutes } from "./routes/trends";

const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/api/health", () => ({ status: "ok" }))
  .use(keywordsRoutes)
  .use(mentionsRoutes)
  .use(trendsRoutes)
  .compile();
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api-worker/src
git commit -m "feat(api): implement trends endpoints with aggregation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Error Handling & Validation

**Files:**
- Create: `apps/api-worker/src/middleware/error-handler.ts`
- Modify: `apps/api-worker/src/index.ts`

**Step 1: Write failing test**

```typescript
// apps/api-worker/src/middleware/error-handler.test.ts
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler } from "./error-handler";

describe("Error Handler", () => {
  test("handles validation errors", async () => {
    const app = new Elysia()
      .use(errorHandler)
      .post("/test", () => {}, {
        body: t.Object({ required: t.String() }),
      });

    const response = await app.handle(
      new Request("http://localhost/test", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
  });

  test("handles not found errors", async () => {
    const app = new Elysia().use(errorHandler).get("/exists", () => "ok");

    const response = await app.handle(new Request("http://localhost/notfound"));

    expect(response.status).toBe(404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api-worker && bun test`
Expected: FAIL

**Step 3: Implement error handler**

```typescript
// apps/api-worker/src/middleware/error-handler.ts
import { Elysia } from "elysia";

export const errorHandler = new Elysia()
  .onError(({ code, error, set }) => {
    console.error("API Error:", { code, error });

    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          error: "Validation Error",
          message: error.message,
        };

      case "NOT_FOUND":
        set.status = 404;
        return {
          error: "Not Found",
          message: "The requested resource was not found",
        };

      case "INTERNAL_SERVER_ERROR":
        set.status = 500;
        return {
          error: "Internal Server Error",
          message: "An unexpected error occurred",
        };

      default:
        set.status = 500;
        return {
          error: "Unknown Error",
          message: error.message || "An unknown error occurred",
        };
    }
  })
  .onAfterHandle(({ response, set }) => {
    // Add CORS headers
    set.headers["Access-Control-Allow-Origin"] = "*";
    set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  });
```

**Step 4: Integrate into main app**

```typescript
// apps/api-worker/src/index.ts (modify)
import { errorHandler } from "./middleware/error-handler";

const app = new Elysia({ adapter: CloudflareAdapter })
  .use(errorHandler)
  .get("/api/health", () => ({ status: "ok" }))
  .use(keywordsRoutes)
  .use(mentionsRoutes)
  .use(trendsRoutes)
  .compile();
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api-worker && bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api-worker/src
git commit -m "feat(api): add error handling and CORS middleware

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Integration Tests

**Files:**
- Create: `apps/api-worker/src/integration.test.ts`

**Step 1: Write integration test**

```typescript
// apps/api-worker/src/integration.test.ts
import { describe, expect, test, beforeAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "./index";

describe("API Integration Tests", () => {
  let api: ReturnType<typeof treaty<App>>;
  let createdKeywordId: string;

  beforeAll(() => {
    api = treaty<App>("http://localhost:8787");
  });

  test("Full workflow: create keyword -> create mentions -> view trends", async () => {
    // 1. Create keyword
    const keywordResponse = await api.api.keywords.post({
      name: "ElysiaJS",
      aliases: ["elysia"],
      tags: ["framework", "backend"],
    });

    expect(keywordResponse.status).toBe(201);
    expect(keywordResponse.data?.name).toBe("ElysiaJS");
    createdKeywordId = keywordResponse.data!.id;

    // 2. List keywords
    const listResponse = await api.api.keywords.get();
    expect(listResponse.status).toBe(200);
    expect(listResponse.data?.keywords.length).toBeGreaterThan(0);

    // 3. Get keyword by ID
    const getResponse = await api.api.keywords({ id: createdKeywordId }).get();
    expect(getResponse.status).toBe(200);
    expect(getResponse.data?.name).toBe("ElysiaJS");

    // 4. Update keyword
    const updateResponse = await api.api.keywords({ id: createdKeywordId }).put({
      tags: ["framework", "backend", "typescript"],
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data?.tags).toContain("typescript");

    // 5. Get trends overview
    const trendsResponse = await api.api.trends.overview.get();
    expect(trendsResponse.status).toBe(200);
    expect(trendsResponse.data?.topKeywords).toBeDefined();

    // 6. Get mentions
    const mentionsResponse = await api.api.mentions.get({
      query: { limit: 10, offset: 0 },
    });
    expect(mentionsResponse.status).toBe(200);
    expect(mentionsResponse.data?.mentions).toBeDefined();

    // 7. Archive keyword
    const deleteResponse = await api.api.keywords({ id: createdKeywordId }).delete();
    expect(deleteResponse.status).toBe(204);
  });

  test("Error handling: 404 for non-existent keyword", async () => {
    const response = await api.api.keywords({ id: "non-existent" }).get();
    expect(response.status).toBe(404);
  });

  test("Validation: reject invalid keyword creation", async () => {
    const response = await api.api.keywords.post({
      name: "",
      aliases: [],
      tags: [],
    } as any);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run integration tests**

Run: `cd apps/api-worker && bun run dev` (in separate terminal)
Run: `cd apps/api-worker && bun test integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/api-worker/src/integration.test.ts
git commit -m "test(api): add comprehensive integration tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Documentation & Developer Experience

**Files:**
- Create: `apps/api-worker/README.md`
- Create: `apps/api-worker/docs/api-reference.md`

**Step 1: Write API worker README**

```markdown
# API Worker

ElysiaJS-based API running on Cloudflare Workers.

## Development

```bash
# Install dependencies
bun install

# Run local dev server
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Deploy
bun run deploy
```

## Environment Setup

1. Create D1 database:
```bash
wrangler d1 create trend-monitor-local
```

2. Update wrangler.toml with database ID

3. Run migrations:
```bash
wrangler d1 execute trend-monitor-local --local --file migrations/0001_init_schema.sql
```

## API Endpoints

See [API Reference](./docs/api-reference.md) for details.

- `GET /api/health` - Health check
- `GET /api/keywords` - List keywords
- `POST /api/keywords` - Create keyword
- `GET /api/keywords/:id` - Get keyword
- `PUT /api/keywords/:id` - Update keyword
- `DELETE /api/keywords/:id` - Archive keyword
- `GET /api/trends/overview` - Trends overview
- `GET /api/trends/:keywordId` - Keyword trend
- `GET /api/mentions` - List mentions
- `GET /api/mentions/:id` - Get mention

## Testing

```bash
# Unit tests
bun test

# Integration tests (requires dev server running)
bun run dev & bun test integration.test.ts
```
```

**Step 2: Write API reference**

```markdown
# API Reference

## Keywords API

### List Keywords
```http
GET /api/keywords
```

Response:
```json
{
  "keywords": [...],
  "total": 10
}
```

### Create Keyword
```http
POST /api/keywords
Content-Type: application/json

{
  "name": "ElysiaJS",
  "aliases": ["elysia"],
  "tags": ["framework"]
}
```

[Continue for all endpoints...]
```

**Step 3: Commit**

```bash
git add apps/api-worker/README.md apps/api-worker/docs
git commit -m "docs(api): add comprehensive API documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] Database schema migrations created and tested
- [ ] Database access layer (repositories) implemented with tests
- [ ] API DTOs defined in shared types package
- [ ] Keywords CRUD endpoints implemented with tests
- [ ] Mentions listing endpoints implemented with tests
- [ ] Trends service with aggregation logic implemented
- [ ] Trends endpoints implemented with tests
- [ ] Error handling and CORS middleware added
- [ ] Integration tests covering full workflows
- [ ] API documentation written
- [ ] All tests passing
- [ ] Type checking passing
- [ ] Ready for frontend integration

---

## Notes

- All database operations use prepared statements for security
- JSON fields are properly serialized/deserialized
- Pagination is implemented for list endpoints
- Error responses follow consistent format
- CORS is enabled for frontend development
- Repository pattern allows for easy testing and mocking
- Service layer encapsulates business logic
- TDD approach ensures reliable implementation
