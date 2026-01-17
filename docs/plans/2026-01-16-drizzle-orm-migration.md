# Drizzle ORM Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw SQL repository implementation with Drizzle ORM for type-safe database access with Cloudflare D1.

**Architecture:** Drizzle ORM provides a TypeScript-first ORM with full D1 support. We'll replace the raw SQL `prepare().bind()` calls with Drizzle's query builder while maintaining the existing repository pattern. Drizzle generates types from schema, eliminating manual row mapping.

**Tech Stack:**
- `drizzle-orm` - ORM library with D1 adapter
- `drizzle-kit` - Schema management and migration tool
- `@cloudflare/workers-types` - Cloudflare D1 types
- `better-sqlite3` - In-memory SQLite for testing

---

## Task 1: Install Drizzle Dependencies

**Files:**
- Modify: `apps/api-worker/package.json`

**Step 1: Install Drizzle packages**

Run: `bun add drizzle-orm`
Expected: Successfully installs drizzle-orm

**Step 2: Install Drizzle Kit as dev dependency**

Run: `bun add -D drizzle-kit`
Expected: Successfully installs drizzle-kit

**Step 3: Verify installation**

Run: `bun pm ls | grep drizzle`
Expected: Shows drizzle-orm and drizzle-kit installed

**Step 4: Commit**

```bash
git add apps/api-worker/package.json apps/api-worker/bun.lockb
git commit -m "feat(api): add drizzle-orm dependencies"
```

---

## Task 2: Create Drizzle Configuration

**Files:**
- Create: `apps/api-worker/drizzle.config.ts`

**Step 1: Write Drizzle config**

Create `apps/api-worker/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
```

**Step 2: Verify config**

Run: `cat apps/api-worker/drizzle.config.ts`
Expected: File exists with config

**Step 3: Commit**

```bash
git add apps/api-worker/drizzle.config.ts
git commit -m "feat(api): add drizzle configuration"
```

---

## Task 3: Define Drizzle Schema

**Files:**
- Create: `apps/api-worker/src/lib/db/schema.ts`

**Step 1: Write Drizzle schema**

Create `apps/api-worker/src/lib/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Keywords table
export const keywords = sqliteTable("keywords", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Mentions table
export const mentions = sqliteTable("mentions", {
  id: text("id").primaryKey(),
  source: text("source", { enum: ["reddit", "x", "feed"] }).notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  url: text("url").notNull(),
  author: text("author"),
  createdAt: text("created_at").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  matchedKeywords: text("matched_keywords", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
}, (table) => ({
  uniqSourceId: unique().on(table.source, table.sourceId),
}));

// Daily aggregates table
export const dailyAggregates = sqliteTable("daily_aggregates", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  keywordId: text("keyword_id").notNull(),
  source: text("source", { enum: ["reddit", "x", "feed"] }).notNull(),
  mentionsCount: integer("mentions_count").notNull().default(0),
}, (table) => ({
  uniqDateKeywordSource: unique().on(table.date, table.keywordId, table.source),
}));

// Export types inferred from schema
export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = typeof keywords.$inferInsert;
export type Mention = typeof mentions.$inferSelect;
export type InsertMention = typeof mentions.$inferInsert;
export type DailyAggregate = typeof dailyAggregates.$inferSelect;
export type InsertDailyAggregate = typeof dailyAggregates.$inferInsert;
```

**Step 2: Verify schema file**

Run: `cat apps/api-worker/src/lib/db/schema.ts | head -20`
Expected: Schema definition visible

**Step 3: Commit**

```bash
git add apps/api-worker/src/lib/db/schema.ts
git commit -m "feat(api): define drizzle database schema"
```

---

## Task 4: Create Drizzle DB Client

**Files:**
- Modify: `apps/api-worker/src/lib/db/index.ts`
- Create: `apps/api-worker/src/lib/db/client.ts`

**Step 1: Write Drizzle client wrapper**

Create `apps/api-worker/src/lib/db/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";

export function createDbClient(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
```

**Step 2: Update index.ts to export client**

Modify `apps/api-worker/src/lib/db/index.ts`:

```typescript
import { env } from "cloudflare:workers";
import { createDbClient } from "./client";

export const db = createDbClient(env.DB);
export { createDbClient } from "./client";
export type { DbClient } from "./client";
export * from "./schema";
```

**Step 3: Verify files**

Run: `cat apps/api-worker/src/lib/db/client.ts`
Expected: Client creation code visible

Run: `cat apps/api-worker/src/lib/db/index.ts`
Expected: Updated exports visible

**Step 4: Commit**

```bash
git add apps/api-worker/src/lib/db/client.ts apps/api-worker/src/lib/db/index.ts
git commit -m "feat(api): create drizzle db client"
```

---

## Task 5: Update Mock DB for Testing

**Files:**
- Modify: `apps/api-worker/src/lib/db/mock.ts`

**Step 1: Rewrite mock to use Drizzle**

Replace contents of `apps/api-worker/src/lib/db/mock.ts`:

```typescript
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import type { DbClient } from "./client";
import { sql } from "drizzle-orm";

export const createMockDB = (): DbClient => {
  const sqlite = new Database(":memory:");

  // Initialize schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
  `);

  return drizzle(sqlite, { schema });
};
```

**Step 2: Verify mock file**

Run: `cat apps/api-worker/src/lib/db/mock.ts | head -30`
Expected: Updated mock with Drizzle

**Step 3: Commit**

```bash
git add apps/api-worker/src/lib/db/mock.ts
git commit -m "feat(api): update mock db to use drizzle"
```

---

## Task 6: Rewrite Keywords Repository with Drizzle

**Files:**
- Modify: `apps/api-worker/src/modules/keywords/repository.ts`

**Step 1: Write test for new repository**

This step verifies the existing test still works. We'll run tests after implementing.

**Step 2: Rewrite repository with Drizzle**

Replace contents of `apps/api-worker/src/modules/keywords/repository.ts`:

```typescript
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DbClient } from "../../lib/db/client";
import { keywords, type Keyword, type InsertKeyword } from "../../lib/db/schema";

export class KeywordsRepository {
  constructor(private db: DbClient) {}

  async create(input: {
    name: string;
    aliases: string[];
    tags: string[];
  }): Promise<Keyword> {
    // Validate input
    if (!input.name?.trim()) {
      throw new Error("Keyword name cannot be empty");
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const newKeyword: InsertKeyword = {
      id,
      name: input.name.trim(),
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.insert(keywords).values(newKeyword);
    } catch (err) {
      throw new Error(
        `Failed to create keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    return {
      id,
      name: input.name.trim(),
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Keyword | null> {
    try {
      const result = await this.db
        .select()
        .from(keywords)
        .where(eq(keywords.id, id))
        .limit(1);

      return result[0] || null;
    } catch (err) {
      throw new Error(
        `Failed to find keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  async list(options?: { limit?: number; offset?: number }): Promise<Keyword[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Validate pagination parameters
    if (limit < 1 || limit > 1000) {
      throw new Error("Limit must be between 1 and 1000");
    }
    if (offset < 0) {
      throw new Error("Offset must be non-negative");
    }

    try {
      const result = await this.db
        .select()
        .from(keywords)
        .orderBy(keywords.createdAt)
        .limit(limit)
        .offset(offset);

      return result;
    } catch (err) {
      throw new Error(
        `Failed to list keywords: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
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

    // Validate name if provided
    if (input.name !== undefined && !input.name?.trim()) {
      throw new Error("Keyword name cannot be empty");
    }

    const updates: Partial<Keyword> = {};

    if (input.name !== undefined) {
      updates.name = input.name.trim();
    }
    if (input.aliases !== undefined) {
      updates.aliases = input.aliases;
    }
    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }
    if (input.status !== undefined) {
      updates.status = input.status;
    }

    if (Object.keys(updates).length === 0) return existing;

    updates.updatedAt = new Date().toISOString();

    try {
      await this.db
        .update(keywords)
        .set(updates)
        .where(eq(keywords.id, id));
    } catch (err) {
      throw new Error(
        `Failed to update keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db
        .update(keywords)
        .set({
          status: "archived",
          updatedAt: new Date().toISOString()
        })
        .where(eq(keywords.id, id));

      return true;
    } catch (err) {
      throw new Error(
        `Failed to delete keyword: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
}
```

**Step 3: Run tests to verify it works**

Run: `cd apps/api-worker && bun test src/modules/keywords/repository.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add apps/api-worker/src/modules/keywords/repository.ts
git commit -m "feat(api): migrate keywords repository to drizzle"
```

---

## Task 7: Rewrite Mentions Repository with Drizzle

**Files:**
- Modify: `apps/api-worker/src/modules/mentions/repository.ts`

**Step 1: Rewrite repository with Drizzle**

Replace contents of `apps/api-worker/src/modules/mentions/repository.ts`:

```typescript
import { eq, and, gte, lte, like, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DbClient } from "../../lib/db/client";
import { mentions, type Mention, type InsertMention } from "../../lib/db/schema";
import type { Source } from "@trend-monitor/types";

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
  constructor(private db: DbClient) {}

  async create(input: {
    source: Source;
    sourceId: string;
    title?: string;
    content: string;
    url: string;
    author?: string;
    createdAt: string;
    matchedKeywords: string[];
  }): Promise<Mention> {
    const id = randomUUID();
    const fetchedAt = new Date().toISOString();

    const newMention: InsertMention = {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title,
      content: input.content,
      url: input.url,
      author: input.author,
      createdAt: input.createdAt,
      fetchedAt,
      matchedKeywords: input.matchedKeywords,
    };

    try {
      await this.db.insert(mentions).values(newMention);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to create mention: ${message}`);
    }

    return {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title,
      content: input.content,
      url: input.url,
      author: input.author,
      createdAt: input.createdAt,
      fetchedAt,
      matchedKeywords: input.matchedKeywords,
    };
  }

  async findById(id: string): Promise<Mention | null> {
    try {
      const result = await this.db
        .select()
        .from(mentions)
        .where(eq(mentions.id, id))
        .limit(1);

      return result[0] || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to find mention: ${message}`);
    }
  }

  async list(filters: MentionFilters): Promise<MentionListResult> {
    const conditions = [];

    if (filters.keywordId) {
      // SQLite JSON search - Drizzle doesn't have native JSON operators for SQLite
      conditions.push(like(mentions.matchedKeywords, `%"${filters.keywordId}"%`));
    }

    if (filters.source) {
      conditions.push(eq(mentions.source, filters.source));
    }

    if (filters.from) {
      conditions.push(gte(mentions.createdAt, filters.from));
    }

    if (filters.to) {
      conditions.push(lte(mentions.createdAt, filters.to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    try {
      // Get total count
      const countResult = await this.db
        .select()
        .from(mentions)
        .where(whereClause);

      const total = countResult.length;

      // Get paginated results
      const result = await this.db
        .select()
        .from(mentions)
        .where(whereClause)
        .orderBy(desc(mentions.createdAt))
        .limit(filters.limit)
        .offset(filters.offset);

      return {
        mentions: result,
        total,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to list mentions: ${message}`);
    }
  }

  async findByTimeRange(
    startTime: string,
    endTime: string,
    options?: {
      source?: Source;
      keyword?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Mention[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const conditions = [
      gte(mentions.createdAt, startTime),
      lte(mentions.createdAt, endTime),
    ];

    if (options?.source) {
      conditions.push(eq(mentions.source, options.source));
    }

    if (options?.keyword) {
      conditions.push(like(mentions.matchedKeywords, `%"${options.keyword}"%`));
    }

    try {
      const result = await this.db
        .select()
        .from(mentions)
        .where(and(...conditions))
        .orderBy(desc(mentions.createdAt))
        .limit(limit)
        .offset(offset);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new Error(`Failed to find mentions: ${message}`);
    }
  }
}
```

**Step 2: Run tests to verify it works**

Run: `cd apps/api-worker && bun test src/modules/mentions/repository.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add apps/api-worker/src/modules/mentions/repository.ts
git commit -m "feat(api): migrate mentions repository to drizzle"
```

---

## Task 8: Update Route Handlers to Use Drizzle Client

**Files:**
- Modify: `apps/api-worker/src/modules/keywords/index.ts`
- Modify: `apps/api-worker/src/modules/mentions/index.ts`

**Step 1: Update keywords routes**

Find the `.derive()` call in `apps/api-worker/src/modules/keywords/index.ts` and update the import and repository initialization:

Change from:
```typescript
import { db } from "../../lib/db";
```

To:
```typescript
import { db } from "../../lib/db";
```

The db export now returns a DbClient instead of D1Database, so the repository will work automatically.

**Step 2: Update mentions routes**

Same change in `apps/api-worker/src/modules/mentions/index.ts`.

**Step 3: Run route integration tests**

Run: `cd apps/api-worker && bun test src/modules/keywords/index.test.ts`
Expected: All route tests pass

Run: `cd apps/api-worker && bun test src/modules/mentions/index.test.ts`
Expected: All route tests pass

**Step 4: Commit**

```bash
git add apps/api-worker/src/modules/keywords/index.ts apps/api-worker/src/modules/mentions/index.ts
git commit -m "feat(api): update route handlers for drizzle client"
```

---

## Task 9: Update Trends Service (if needed)

**Files:**
- Check: `apps/api-worker/src/services/trends-service.ts`

**Step 1: Check if trends service uses DB directly**

Run: `cat apps/api-worker/src/services/trends-service.ts`
Expected: See if it imports db or uses repositories

**Step 2: Update if needed**

If the service uses raw DB access, update to use Drizzle queries. Otherwise, skip.

**Step 3: Commit if changes made**

```bash
git add apps/api-worker/src/services/trends-service.ts
git commit -m "feat(api): update trends service for drizzle"
```

---

## Task 10: Remove Old Type Definitions

**Files:**
- Check: `packages/types/src/index.ts`
- Modify if needed: Remove duplicate types now provided by Drizzle

**Step 1: Check for duplicate types**

Run: `cat packages/types/src/index.ts | grep -E "(KeywordRow|MentionRow)"`
Expected: See if there are row types that conflict with Drizzle

**Step 2: Update shared types**

The Drizzle schema now exports `Keyword`, `Mention`, etc. Update `@trend-monitor/types` to re-export from Drizzle schema or keep minimal shared types.

**Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "refactor(types): align with drizzle schema types"
```

---

## Task 11: Update Package Scripts

**Files:**
- Modify: `apps/api-worker/package.json`

**Step 1: Add Drizzle scripts**

Add to `scripts` section in `apps/api-worker/package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**Step 2: Verify scripts**

Run: `bun run --cwd apps/api-worker db:generate --help`
Expected: Drizzle kit help output

**Step 3: Commit**

```bash
git add apps/api-worker/package.json
git commit -m "feat(api): add drizzle-kit scripts"
```

---

## Task 12: Run Full Test Suite

**Files:**
- None (verification step)

**Step 1: Run all API worker tests**

Run: `cd apps/api-worker && bun test`
Expected: All tests pass

**Step 2: Run type checking**

Run: `cd apps/api-worker && bun run typecheck`
Expected: No TypeScript errors

**Step 3: Run linting**

Run: `cd apps/api-worker && bun run lint`
Expected: No linting errors

---

## Task 13: Test Local Development Server

**Files:**
- None (verification step)

**Step 1: Start dev server**

Run: `cd apps/api-worker && bun run dev`
Expected: Server starts on port 8787

**Step 2: Test keywords endpoint**

Run in another terminal:
```bash
curl http://localhost:8787/api/keywords
```
Expected: Returns keywords list (empty array if none exist)

**Step 3: Test creating a keyword**

Run:
```bash
curl -X POST http://localhost:8787/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Keyword", "aliases": ["test"], "tags": ["testing"]}'
```
Expected: Returns created keyword with ID

**Step 4: Stop dev server**

Press Ctrl+C in dev server terminal
Expected: Server stops

---

## Task 14: Update Documentation

**Files:**
- Modify: `apps/api-worker/CLAUDE.md`

**Step 1: Add Drizzle section to CLAUDE.md**

Add to the "Tech Stack" section:
- **ORM**: Drizzle ORM with D1 adapter for type-safe queries

Add to "Key Patterns":

```markdown
6. **Drizzle ORM**: All database operations use Drizzle's query builder instead of raw SQL:
   ```typescript
   // Type-safe queries with auto-completion
   await db.select().from(keywords).where(eq(keywords.id, id))

   // Type-safe inserts
   await db.insert(keywords).values({ id, name, aliases, tags })
   ```
```

**Step 2: Verify documentation**

Run: `cat apps/api-worker/CLAUDE.md | grep -i drizzle`
Expected: Drizzle references visible

**Step 3: Commit**

```bash
git add apps/api-worker/CLAUDE.md
git commit -m "docs(api): document drizzle orm usage"
```

---

## Task 15: Final Verification and Cleanup

**Files:**
- None (verification step)

**Step 1: Verify all tests pass**

Run: `cd apps/api-worker && bun test`
Expected: All tests passing

**Step 2: Check git status**

Run: `git status`
Expected: Clean working directory (all changes committed)

**Step 3: Review commit history**

Run: `git log --oneline -15`
Expected: See all migration commits

**Step 4: Final commit if needed**

If any remaining changes:
```bash
git add .
git commit -m "chore(api): finalize drizzle orm migration"
```

---

## Summary

This plan migrates the API worker from raw SQL with D1Database to Drizzle ORM while:

- Maintaining the existing repository pattern
- Keeping all tests passing
- Preserving type safety (enhanced with Drizzle's inferred types)
- Supporting both D1 (production) and better-sqlite3 (testing)
- Following TDD principles with test-driven verification

**Key Benefits:**
- Type-safe queries with auto-completion
- Reduced boilerplate (no manual row mapping)
- Better developer experience
- Easier schema migrations with drizzle-kit
- Maintained test coverage

**Migration Approach:**
- Additive first (install Drizzle alongside existing code)
- Repository-by-repository replacement
- Continuous testing throughout
- No breaking changes to API surface
