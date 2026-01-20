# @trend-monitor/db

Shared database layer for Trend Monitor workers using Drizzle ORM with Cloudflare D1.

## What's Included

- **Schema**: Drizzle ORM schema definitions for `keywords`, `mentions`, and `daily_aggregates` tables
- **Types**: TypeScript types inferred from schema (`Keyword`, `Mention`, `DailyAggregate`, etc.)
- **Client Factory**: `createDbClient()` to wrap D1Database with Drizzle
- **Mock DB**: `createMockDB()` for testing with in-memory SQLite

## Usage in Workers

### 1. Import schema and types

```typescript
import { keywords, mentions, type Keyword, type InsertMention } from "@trend-monitor/db";
```

### 2. Create runtime DB binding

Each worker should create its own runtime binding:

```typescript
// src/lib/db/index.ts
import { env } from "cloudflare:workers";
import { createDbClient } from "@trend-monitor/db";

// Auto-detect if env.DB is already a Drizzle client (tests) or D1Database (production)
const isAlreadyDrizzleClient = env.DB && typeof (env.DB as any).select === "function";

export const db = isAlreadyDrizzleClient ? (env.DB as any) : createDbClient(env.DB);
```

### 3. Use in repositories

```typescript
import { db, keywords, type Keyword } from "./lib/db";
import { eq } from "drizzle-orm";

export class KeywordsRepository {
  async findActive(): Promise<Keyword[]> {
    return await db.select().from(keywords).where(eq(keywords.status, "active"));
  }
}
```

## Testing

Use the mock DB for testing:

```typescript
import { describe, test, beforeEach } from "bun:test";
import { createMockDB, type DbClient } from "@trend-monitor/db";

describe("MyRepository", () => {
  let db: DbClient;

  beforeEach(() => {
    db = createMockDB();
  });

  test("works with mock DB", async () => {
    // Test using db...
  });
});
```

## Schema

### keywords
- Monitored keywords with aliases (JSON array) and tags (JSON array)
- Status: `active` | `archived`

### mentions
- Normalized posts/tweets/articles
- Unique constraint on `(source, source_id)` for idempotency
- `matched_keywords` (JSON array of keyword IDs)

### daily_aggregates
- Pre-aggregated daily mention counts per keyword/source
- Unique constraint on `(date, keyword_id, source)`

## Note

Column names use **camelCase** in TypeScript (via Drizzle) but are mapped to **snake_case** in the SQLite database.
