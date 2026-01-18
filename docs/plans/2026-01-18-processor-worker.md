# Processor Worker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the queue consumer worker that processes ingestion events, matches keywords, and writes mentions to D1.

**Architecture:** Queue consumer pattern using Cloudflare Workers Queue binding. Loads active keywords (with KV caching), performs case-insensitive keyword matching using shared utilities, and writes mentions to D1 using Drizzle ORM with repository pattern. Idempotent inserts using unique constraint on (source, source_id).

**Tech Stack:** Cloudflare Workers, Drizzle ORM, D1 Database, KV (cache), Bun Test with in-memory SQLite mocks

---

## Task 1: Set up database access layer

**Files:**
- Create: `apps/processor-worker/src/lib/db/client.ts`
- Create: `apps/processor-worker/src/lib/db/index.ts`
- Create: `apps/processor-worker/src/lib/db/mock.ts`

**Step 1: Create Drizzle client factory**

Create `apps/processor-worker/src/lib/db/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { keywords, mentions } from "./schema";

const schema = { keywords, mentions };

export function createDbClient(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
```

**Step 2: Create runtime DB binding with auto-detection**

Create `apps/processor-worker/src/lib/db/index.ts`:

```typescript
import { env } from "cloudflare:workers";
import { createDbClient } from "./client";

// In tests, env.DB is already a Drizzle client from mock
// In production, env.DB is a D1Database that needs wrapping
const isAlreadyDrizzleClient = env.DB && typeof (env.DB as any).select === "function";

export const db = isAlreadyDrizzleClient ? (env.DB as any) : createDbClient(env.DB);
export { createDbClient } from "./client";
export type { DbClient } from "./client";
export * from "./schema";
```

**Step 3: Create schema re-export**

Create `apps/processor-worker/src/lib/db/schema.ts`:

```typescript
// Re-export schema from api-worker for consistency
export { keywords, mentions, type Keyword, type Mention, type InsertMention } from "../../../api-worker/src/lib/db/schema";
```

**Step 4: Create mock DB for testing**

Create `apps/processor-worker/src/lib/db/mock.ts`:

```typescript
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { keywords, mentions } from "./schema";
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
  `);

  return drizzle({ client: sqlite, schema: { keywords, mentions } }) as unknown as DbClient;
};
```

**Step 5: Commit database setup**

```bash
git add apps/processor-worker/src/lib/db/
git commit -m "feat(processor): add database access layer with Drizzle ORM

- Create client factory for D1Database
- Add runtime binding with test auto-detection
- Re-export schema from api-worker
- Add mock DB for testing with in-memory SQLite

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create mentions repository

**Files:**
- Create: `apps/processor-worker/src/repositories/mentions-repository.ts`

**Step 1: Write failing test for idempotent insert**

Create `apps/processor-worker/src/repositories/mentions-repository.test.ts`:

```typescript
import { describe, expect, test, beforeEach } from "bun:test";
import { MentionsRepository } from "./mentions-repository";
import { createMockDB } from "../lib/db/mock";
import type { DbClient } from "../lib/db/client";
import { randomUUID } from "node:crypto";

describe("MentionsRepository", () => {
  let db: DbClient;
  let repo: MentionsRepository;

  beforeEach(() => {
    db = createMockDB();
    repo = new MentionsRepository(db);
  });

  describe("createOrIgnore", () => {
    test("creates new mention", async () => {
      const mention = await repo.createOrIgnore({
        source: "reddit",
        sourceId: "abc123",
        title: "Test Post",
        content: "This is about ElysiaJS",
        url: "https://reddit.com/r/test/abc123",
        author: "testuser",
        createdAt: new Date().toISOString(),
        matchedKeywords: ["kw-1"],
      });

      expect(mention).toBeDefined();
      expect(mention?.source).toBe("reddit");
      expect(mention?.sourceId).toBe("abc123");
      expect(mention?.matchedKeywords).toEqual(["kw-1"]);
    });

    test("ignores duplicate (same source + sourceId)", async () => {
      const data = {
        source: "reddit" as const,
        sourceId: "abc123",
        title: "Test Post",
        content: "This is about ElysiaJS",
        url: "https://reddit.com/r/test/abc123",
        author: "testuser",
        createdAt: new Date().toISOString(),
        matchedKeywords: ["kw-1"],
      };

      const first = await repo.createOrIgnore(data);
      const second = await repo.createOrIgnore(data);

      expect(first).toBeDefined();
      expect(second).toBeNull(); // Should return null on duplicate
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/processor-worker && bun test src/repositories/mentions-repository.test.ts`

Expected: FAIL with "Cannot find module './mentions-repository'"

**Step 3: Write minimal implementation**

Create `apps/processor-worker/src/repositories/mentions-repository.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { DbClient } from "../lib/db/client";
import { mentions, type Mention, type InsertMention } from "../lib/db/schema";

export class MentionsRepository {
  constructor(private db: DbClient) {}

  async createOrIgnore(input: {
    source: "reddit" | "x" | "feed";
    sourceId: string;
    title?: string;
    content: string;
    url: string;
    author?: string;
    createdAt: string;
    matchedKeywords: string[];
  }): Promise<Mention | null> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const newMention: InsertMention = {
      id,
      source: input.source,
      sourceId: input.sourceId,
      title: input.title,
      content: input.content,
      url: input.url,
      author: input.author,
      createdAt: input.createdAt,
      fetchedAt: now,
      matchedKeywords: input.matchedKeywords,
    };

    try {
      await this.db.insert(mentions).values(newMention);
      return {
        ...newMention,
        title: input.title || null,
        author: input.author || null,
      };
    } catch (err) {
      // If unique constraint violation, return null (duplicate)
      if (err instanceof Error && err.message.includes("UNIQUE")) {
        return null;
      }
      throw new Error(
        `Failed to create mention: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/processor-worker && bun test src/repositories/mentions-repository.test.ts -t "creates new mention"`

Expected: PASS

**Step 5: Run duplicate test**

Run: `cd apps/processor-worker && bun test src/repositories/mentions-repository.test.ts -t "ignores duplicate"`

Expected: PASS

**Step 6: Commit mentions repository**

```bash
git add apps/processor-worker/src/repositories/
git commit -m "feat(processor): add mentions repository with idempotent insert

- Implement createOrIgnore method using Drizzle ORM
- Handle UNIQUE constraint violations gracefully
- Add comprehensive tests for creation and deduplication

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create keyword cache service

**Files:**
- Create: `apps/processor-worker/src/services/keyword-cache.ts`
- Create: `apps/processor-worker/src/services/keyword-cache.test.ts`

**Step 1: Write failing test for keyword cache**

Create `apps/processor-worker/src/services/keyword-cache.test.ts`:

```typescript
import { describe, expect, test, beforeEach, mock } from "bun:test";
import { KeywordCache } from "./keyword-cache";
import { createMockDB } from "../lib/db/mock";
import type { DbClient } from "../lib/db/client";
import { KeywordsRepository } from "./keywords-repository";

// Mock KV namespace
const createMockKV = () => ({
  get: mock(async () => null),
  put: mock(async () => undefined),
});

describe("KeywordCache", () => {
  let db: DbClient;
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
```

**Step 2: Create keywords repository for processor**

Create `apps/processor-worker/src/services/keywords-repository.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { DbClient } from "../lib/db/client";
import { keywords, type Keyword } from "../lib/db/schema";

export class KeywordsRepository {
  constructor(private db: DbClient) {}

  async create(input: {
    name: string;
    aliases: string[];
    tags: string[];
  }): Promise<Keyword> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(keywords).values({
      id,
      name: input.name,
      aliases: input.aliases,
      tags: input.tags,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

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

  async findActive(): Promise<Keyword[]> {
    return await this.db
      .select()
      .from(keywords)
      .where(eq(keywords.status, "active"));
  }
}
```

**Step 3: Run test to verify it fails**

Run: `cd apps/processor-worker && bun test src/services/keyword-cache.test.ts`

Expected: FAIL with "Cannot find module './keyword-cache'"

**Step 4: Write minimal implementation**

Create `apps/processor-worker/src/services/keyword-cache.ts`:

```typescript
import type { DbClient } from "../lib/db/client";
import type { Keyword } from "../lib/db/schema";
import { KeywordsRepository } from "./keywords-repository";

const CACHE_KEY = "active_keywords";
const CACHE_TTL = 300; // 5 minutes

export class KeywordCache {
  private keywordsRepo: KeywordsRepository;

  constructor(
    private db: DbClient,
    private kv: KVNamespace,
  ) {
    this.keywordsRepo = new KeywordsRepository(db);
  }

  async getActiveKeywords(): Promise<Keyword[]> {
    // Try KV cache first
    const cached = await this.kv.get(CACHE_KEY, "text");
    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss - load from DB
    const keywords = await this.keywordsRepo.findActive();

    // Update cache
    await this.kv.put(CACHE_KEY, JSON.stringify(keywords), {
      expirationTtl: CACHE_TTL,
    });

    return keywords;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd apps/processor-worker && bun test src/services/keyword-cache.test.ts`

Expected: PASS

**Step 6: Commit keyword cache**

```bash
git add apps/processor-worker/src/services/
git commit -m "feat(processor): add keyword cache with KV backing

- Implement 5-minute TTL cache for active keywords
- Load from DB on cache miss
- Add keywords repository for processor worker
- Add comprehensive tests with mocked KV

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create keyword matching service

**Files:**
- Create: `apps/processor-worker/src/services/keyword-matcher.ts`
- Create: `apps/processor-worker/src/services/keyword-matcher.test.ts`

**Step 1: Write failing test for keyword matcher**

Create `apps/processor-worker/src/services/keyword-matcher.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { KeywordMatcher } from "./keyword-matcher";
import type { Keyword } from "../lib/db/schema";

describe("KeywordMatcher", () => {
  const matcher = new KeywordMatcher();

  const keywords: Keyword[] = [
    {
      id: "kw-1",
      name: "ElysiaJS",
      aliases: ["elysia"],
      tags: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "kw-2",
      name: "Cloudflare D1",
      aliases: ["D1", "CF D1"],
      tags: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  test("matches keyword in content (case insensitive)", () => {
    const matches = matcher.matchKeywords(
      "I'm building an API with elysiajs and it's great!",
      keywords,
    );

    expect(matches).toEqual(["kw-1"]);
  });

  test("matches alias in content", () => {
    const matches = matcher.matchKeywords(
      "Using D1 for my database needs",
      keywords,
    );

    expect(matches).toEqual(["kw-2"]);
  });

  test("matches multiple keywords", () => {
    const matches = matcher.matchKeywords(
      "ElysiaJS with Cloudflare D1 is amazing",
      keywords,
    );

    expect(matches.sort()).toEqual(["kw-1", "kw-2"]);
  });

  test("returns empty array when no matches", () => {
    const matches = matcher.matchKeywords(
      "Just talking about React and PostgreSQL",
      keywords,
    );

    expect(matches).toEqual([]);
  });

  test("deduplicates when keyword appears multiple times", () => {
    const matches = matcher.matchKeywords(
      "ElysiaJS is great. I love ElysiaJS. ElysiaJS rocks!",
      keywords,
    );

    expect(matches).toEqual(["kw-1"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/processor-worker && bun test src/services/keyword-matcher.test.ts`

Expected: FAIL with "Cannot find module './keyword-matcher'"

**Step 3: Write minimal implementation**

Create `apps/processor-worker/src/services/keyword-matcher.ts`:

```typescript
import type { Keyword } from "../lib/db/schema";
import { matchKeyword } from "@trend-monitor/utils";

export class KeywordMatcher {
  matchKeywords(text: string, keywords: Keyword[]): string[] {
    const matches = new Set<string>();

    for (const keyword of keywords) {
      if (matchKeyword(text, keyword.name, keyword.aliases)) {
        matches.add(keyword.id);
      }
    }

    return Array.from(matches);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/processor-worker && bun test src/services/keyword-matcher.test.ts`

Expected: PASS

**Step 5: Commit keyword matcher**

```bash
git add apps/processor-worker/src/services/keyword-matcher.ts apps/processor-worker/src/services/keyword-matcher.test.ts
git commit -m "feat(processor): add keyword matching service

- Use shared utils for case-insensitive matching
- Support keyword names and aliases
- Deduplicate matches
- Add comprehensive tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement queue handler

**Files:**
- Modify: `apps/processor-worker/src/index.ts`

**Step 1: Write failing integration test**

Create `apps/processor-worker/src/index.test.ts`:

```typescript
import { describe, expect, test, beforeEach, mock } from "bun:test";
import worker from "./index";
import type { IngestionEvent } from "@trend-monitor/types";
import { createMockDB } from "./lib/db/mock";
import { KeywordsRepository } from "./services/keywords-repository";

const createMockEnv = (db: any) => ({
  DB: db,
  KEYWORD_CACHE: {
    get: mock(async () => null),
    put: mock(async () => undefined),
  },
});

describe("Processor Worker", () => {
  let db: any;
  let env: any;

  beforeEach(() => {
    db = createMockDB();
    env = createMockEnv(db);
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
    const { mentions } = await import("./lib/db/schema");
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
    const { mentions } = await import("./lib/db/schema");
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
    const { mentions } = await import("./lib/db/schema");
    const result = await db.select().from(mentions);

    expect(result.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/processor-worker && bun test src/index.test.ts`

Expected: FAIL with implementation not complete

**Step 3: Write implementation**

Modify `apps/processor-worker/src/index.ts`:

```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { db } from "./lib/db";
import { KeywordCache } from "./services/keyword-cache";
import { KeywordMatcher } from "./services/keyword-matcher";
import { MentionsRepository } from "./repositories/mentions-repository";

interface Env {
  DB: D1Database;
  KEYWORD_CACHE: KVNamespace;
}

export default {
  async queue(batch: MessageBatch<IngestionEvent>, env: Env): Promise<void> {
    // Initialize services
    const keywordCache = new KeywordCache(db, env.KEYWORD_CACHE);
    const keywordMatcher = new KeywordMatcher();
    const mentionsRepo = new MentionsRepository(db);

    // Load active keywords (cached)
    const keywords = await keywordCache.getActiveKeywords();

    if (keywords.length === 0) {
      console.log("No active keywords configured, skipping batch");
      return;
    }

    // Process each message
    for (const message of batch.messages) {
      const event = message.body;

      try {
        // Match keywords in content and title
        const textToMatch = [event.title, event.content].filter(Boolean).join(" ");
        const matchedKeywordIds = keywordMatcher.matchKeywords(textToMatch, keywords);

        // Skip if no matches
        if (matchedKeywordIds.length === 0) {
          console.log(`No keywords matched for ${event.source}:${event.sourceId}`);
          continue;
        }

        // Create mention (idempotent)
        const mention = await mentionsRepo.createOrIgnore({
          source: event.source,
          sourceId: event.sourceId,
          title: event.title,
          content: event.content,
          url: event.url,
          author: event.author,
          createdAt: event.createdAt,
          matchedKeywords: matchedKeywordIds,
        });

        if (mention) {
          console.log(
            `Created mention ${mention.id} for ${event.source}:${event.sourceId} with ${matchedKeywordIds.length} keywords`,
          );
        } else {
          console.log(`Duplicate mention ${event.source}:${event.sourceId}, skipping`);
        }
      } catch (err) {
        console.error(`Failed to process message ${message.id}:`, err);
        // Message will be retried based on queue config
        throw err;
      }
    }
  },
};
```

**Step 4: Run test to verify it passes**

Run: `cd apps/processor-worker && bun test src/index.test.ts`

Expected: PASS

**Step 5: Commit queue handler**

```bash
git add apps/processor-worker/src/index.ts apps/processor-worker/src/index.test.ts
git commit -m "feat(processor): implement queue consumer with keyword matching

- Load active keywords from cache
- Match keywords against event content and title
- Create mentions idempotently using repository
- Skip events with no keyword matches
- Add comprehensive integration tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Set up test infrastructure

**Files:**
- Create: `apps/processor-worker/test/mock-db.ts`

**Step 1: Create test mock setup**

Create `apps/processor-worker/test/mock-db.ts`:

```typescript
import { mock } from "bun:test";
import { createMockDB } from "../src/lib/db/mock";

// Create a singleton mock DB instance
const mockDb = createMockDB();

// Mock cloudflare:workers module to provide the mock DB
mock.module("cloudflare:workers", () => ({
  env: {
    DB: mockDb,
  },
}));
```

**Step 2: Update package.json test script**

Modify `apps/processor-worker/package.json` scripts section:

```json
{
  "scripts": {
    "test": "bun test --preload ./test/mock-db.ts",
    "test:unit": "bun test --preload ./test/mock-db.ts",
    "test:integration": "bun test --preload ./test/mock-db.ts",
    "test:watch": "bun test --preload ./test/mock-db.ts --watch",
    "test:coverage": "bun test --preload ./test/mock-db.ts --coverage"
  }
}
```

**Step 3: Run all tests to verify setup**

Run: `cd apps/processor-worker && bun test`

Expected: PASS all tests

**Step 4: Commit test infrastructure**

```bash
git add apps/processor-worker/test/mock-db.ts apps/processor-worker/package.json
git commit -m "test(processor): add test infrastructure with mock DB preload

- Create mock DB singleton for tests
- Mock cloudflare:workers module
- Update test scripts to preload mock

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add TypeScript configuration

**Files:**
- Create: `apps/processor-worker/tsconfig.json`

**Step 1: Create TypeScript config**

Create `apps/processor-worker/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types", "@types/bun"],
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "paths": {
      "@trend-monitor/types": ["../../packages/types/src/index.ts"],
      "@trend-monitor/config": ["../../packages/config/src/index.ts"],
      "@trend-monitor/utils": ["../../packages/utils/src/index.ts"]
    }
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Run type check**

Run: `cd apps/processor-worker && bun run typecheck`

Expected: No type errors

**Step 3: Commit TypeScript config**

```bash
git add apps/processor-worker/tsconfig.json
git commit -m "chore(processor): add TypeScript configuration

- Extend base config
- Configure paths for workspace packages
- Set Cloudflare Workers types

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update wrangler types generation

**Files:**
- Modify: `apps/processor-worker/package.json`

**Step 1: Add wrangler types script**

Modify `apps/processor-worker/package.json`:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "build": "tsc && wrangler deploy --dry-run",
    "deploy": "wrangler deploy",
    "wrangler:types": "wrangler types",
    "test": "bun test --preload ./test/mock-db.ts",
    "test:unit": "bun test --preload ./test/mock-db.ts",
    "test:integration": "bun test --preload ./test/mock-db.ts",
    "test:watch": "bun test --preload ./test/mock-db.ts --watch",
    "test:coverage": "bun test --preload ./test/mock-db.ts --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src",
    "format": "biome check src",
    "format:fix": "biome check --write src"
  }
}
```

**Step 2: Generate types**

Run: `cd apps/processor-worker && bun run wrangler:types`

Expected: Creates `worker-configuration.d.ts`

**Step 3: Add to gitignore**

Add to `apps/processor-worker/.gitignore` (create if doesn't exist):

```
worker-configuration.d.ts
```

**Step 4: Commit package.json update**

```bash
git add apps/processor-worker/package.json apps/processor-worker/.gitignore
git commit -m "chore(processor): add wrangler types generation script

- Add wrangler:types script
- Ignore generated worker-configuration.d.ts

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add development documentation

**Files:**
- Create: `apps/processor-worker/README.md`

**Step 1: Create README**

Create `apps/processor-worker/README.md`:

```markdown
# Processor Worker

Queue consumer worker that processes ingestion events, matches keywords, and writes mentions to D1.

## Architecture

- **Pattern**: Queue consumer (Cloudflare Workers Queue)
- **Database**: D1 with Drizzle ORM
- **Cache**: KV for active keywords (5-min TTL)
- **Matching**: Case-insensitive keyword/alias matching via shared utils

## Key Features

- Idempotent mention creation (unique on source + source_id)
- KV-cached keyword loading for performance
- Automatic deduplication of matches
- Batch processing with error retry

## Development

```bash
# Start local dev server
bun run dev

# Run tests
bun test
bun run test:watch

# Type check
bun run typecheck

# Deploy
bun run deploy
```

## Queue Configuration

From `wrangler.toml`:
- Queue: `ingestion-queue`
- Max batch size: 10 messages
- Max retries: 3

## Environment Bindings

- `DB`: D1 database binding
- `KEYWORD_CACHE`: KV namespace for keyword caching

## Data Flow

1. Receive `IngestionEvent` from queue
2. Load active keywords (from KV cache or DB)
3. Match keywords against content + title
4. If matches found, create mention in D1 (idempotent)
5. Log results

## Testing

Uses in-memory SQLite with Drizzle client for fast, isolated tests:
- Repository tests (unit)
- Service tests (unit)
- Integration tests (full queue handler)

Mock setup in `test/mock-db.ts` is preloaded for all tests.
```

**Step 2: Commit README**

```bash
git add apps/processor-worker/README.md
git commit -m "docs(processor): add development documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Run final verification

**Step 1: Run all tests**

Run: `cd apps/processor-worker && bun test`

Expected: All tests pass

**Step 2: Run type check**

Run: `cd apps/processor-worker && bun run typecheck`

Expected: No type errors

**Step 3: Run lint**

Run: `cd apps/processor-worker && bun run lint`

Expected: No lint errors

**Step 4: Build check**

Run: `cd apps/processor-worker && bun run build`

Expected: Build succeeds

**Step 5: Run from monorepo root**

Run from root:
```bash
cd /Users/joel.chan/Projects/dev-tools/trend-monitor-process
bun run test
```

Expected: All workspace tests pass

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(processor): complete processor worker implementation

Full implementation of queue consumer worker:
- Database access layer with Drizzle ORM
- Mentions repository with idempotent inserts
- Keyword cache service with KV backing
- Keyword matching service using shared utils
- Queue handler with batch processing
- Comprehensive test coverage
- Development documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion

The processor worker is now fully implemented with:

✅ Database layer (Drizzle ORM + D1)
✅ Repository pattern for mentions
✅ KV-cached keyword loading
✅ Keyword matching with aliases
✅ Idempotent mention creation
✅ Queue consumer with batch processing
✅ Comprehensive test coverage (unit + integration)
✅ Development documentation

**Next steps:**
1. Test with real ingestion events from ingestion workers
2. Monitor KV cache performance
3. Tune queue batch size and retry configuration
4. Add observability metrics
