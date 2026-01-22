# Database Reference

This document describes the database schema, Drizzle ORM patterns, and database access patterns used throughout the codebase.

## Database Schema Overview

Schema is managed by Drizzle ORM in the shared `@trend-monitor/db` package. See `packages/db/src/schema.ts` for the schema definition.

**Note**: Drizzle uses camelCase in TypeScript (e.g., `createdAt`), which is mapped to snake_case in the SQLite database (e.g., `created_at`).

## Tables

### keywords
Stores monitored keywords with aliases and tags

**Fields:**
- id (INTEGER PRIMARY KEY)
- name (TEXT NOT NULL)
- aliases (JSON) - Array of alternative keyword forms
- tags (JSON) - Array of category tags
- status (TEXT) - 'active' or 'inactive'
- created_at (INTEGER) - Unix timestamp
- updated_at (INTEGER) - Unix timestamp

### mentions
Normalized posts/tweets/articles matching keywords

**Fields:**
- id (INTEGER PRIMARY KEY)
- source (TEXT NOT NULL) - 'reddit', 'x', 'feed', etc.
- source_id (TEXT NOT NULL) - External ID from source platform
- title (TEXT)
- content (TEXT)
- url (TEXT)
- author (TEXT)
- created_at (INTEGER) - Unix timestamp when content was created
- fetched_at (INTEGER) - Unix timestamp when we fetched it
- matched_keywords (JSON) - Array of keyword IDs that matched

**Constraints:**
- UNIQUE constraint on (source, source_id) for idempotent inserts
- Indexes: created_at, source

### daily_aggregates
Pre-aggregated daily mention counts per keyword/source

**Fields:**
- id (INTEGER PRIMARY KEY)
- date (TEXT NOT NULL) - YYYY-MM-DD format
- keyword_id (INTEGER NOT NULL) - Foreign key to keywords
- source (TEXT NOT NULL) - 'reddit', 'x', 'feed', etc.
- mentions_count (INTEGER NOT NULL)

**Constraints:**
- UNIQUE constraint on (date, keyword_id, source)

### source_configs
Stores feed source configurations for ingestion worker

**Fields:**
- id (INTEGER PRIMARY KEY)
- type (TEXT NOT NULL) - 'feed' or 'x'
- config (JSON NOT NULL) - Source-specific configuration
- enabled (INTEGER NOT NULL) - 0 or 1
- created_at (INTEGER) - Unix timestamp
- updated_at (INTEGER) - Unix timestamp
- last_fetch_at (INTEGER) - Unix timestamp of last fetch attempt
- last_success_at (INTEGER) - Unix timestamp of last successful fetch
- last_error_at (INTEGER) - Unix timestamp of last error
- last_error_message (TEXT) - Error message from last failure
- consecutive_failures (INTEGER) - Count of consecutive failures
- deleted_at (INTEGER) - Unix timestamp for soft delete

**Constraints:**
- CHECK constraint on type ('feed', 'x')
- CHECK constraint on enabled (0, 1)

## Drizzle ORM Patterns

### Type Inference

Drizzle provides automatic type inference for select and insert operations:

```typescript
import { keywords, type Keyword } from "@trend-monitor/db";

// Inferred types
type Keyword = typeof keywords.$inferSelect;
type NewKeyword = typeof keywords.$inferInsert;
```

### Database Client Usage

```typescript
import { createDbClient } from "@trend-monitor/db";
import { env } from "cloudflare:workers";

const db = createDbClient(env.DB);

// Type-safe queries
const allKeywords = await db.select().from(keywords);
const newKeyword = await db.insert(keywords).values({ name: "test" });
```

### Repository Pattern

All database access goes through repository classes:

```typescript
export class KeywordsRepository {
  constructor(private db: DrizzleD1Database) {}

  async findAll(): Promise<Keyword[]> {
    return await this.db.select().from(keywords);
  }

  async create(data: NewKeyword): Promise<Keyword> {
    const [result] = await this.db.insert(keywords).values(data).returning();
    return result;
  }
}
```

## Migrations

SQL migrations are stored in `apps/api-worker/migrations/` and run using Wrangler:

```bash
cd apps/api-worker
bun run wrangler:migrate:local  # For local D1
bun run wrangler:migrate        # For production D1
```

**IMPORTANT**: Always use `bun run wrangler:migrate:local`, not raw `wrangler` commands, to ensure proper configuration.

## Testing with Mock Database

For testing, use the mock database from `@trend-monitor/db/mock`:

```typescript
import { createMockDB } from "@trend-monitor/db/mock";
import { keywords } from "@trend-monitor/db";

const db = createMockDB();

// Use like regular Drizzle client
await db.insert(keywords).values({ name: "test" });
const results = await db.select().from(keywords);
```

The mock database uses `bun:sqlite` in-memory database with the same Drizzle schema for full type safety.
