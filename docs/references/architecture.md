# Architecture Reference

This document describes the implemented architecture, worker structures, and key patterns used throughout the codebase.

## Shared Database Package (`@trend-monitor/db`)

The database layer is shared across all workers for consistency and maintainability:

```
packages/db/src/
├── schema.ts             # Drizzle schema for keywords, mentions, daily_aggregates
├── client.ts             # createDbClient() factory for D1Database
├── mock.ts               # createMockDB() for testing (exported separately)
└── index.ts              # Main exports (schema and client)
```

**Key Features:**
- Single source of truth for database schema
- Drizzle ORM with full TypeScript type inference
- Separate mock export (`@trend-monitor/db/mock`) to avoid bundling test dependencies in production
- Used by both api-worker and processor-worker

**Usage in Workers:**
```typescript
// Import schema and types
import { keywords, mentions, type Keyword } from "@trend-monitor/db";

// Each worker creates its own runtime binding
import { env } from "cloudflare:workers";
import { createDbClient } from "@trend-monitor/db";

const db = createDbClient(env.DB);
```

## API Worker Structure

The API worker (`apps/api-worker`) follows a modular architecture:

```
src/
├── modules/              # Feature-based modules
│   ├── keywords/         # Keywords CRUD
│   │   ├── index.ts      # Routes (Elysia handlers)
│   │   ├── repository.ts # DB access layer
│   │   └── *.test.ts     # Tests
│   ├── mentions/         # Mentions listing
│   └── trends/           # Trends aggregation
├── services/             # Cross-module business logic
│   └── trends-service.ts # Growth calculation, aggregation
├── lib/
│   └── db/
│       └── index.ts      # Runtime DB binding (uses @trend-monitor/db)
└── index.ts              # Main Elysia app entry point
```

## Processor Worker Structure

The processor worker (`apps/processor-worker`) consumes queue messages and stores mentions:

```
src/
├── index.ts              # Queue consumer entry point
├── lib/
│   └── db/
│       └── index.ts      # Runtime DB binding (uses @trend-monitor/db)
├── repositories/
│   └── mentions-repository.ts  # Idempotent mention creation
├── services/
│   ├── keyword-cache.ts        # KV-cached keyword loading (5-min TTL)
│   ├── keywords-repository.ts  # Keywords DB access
│   └── keyword-matcher.ts      # Keyword matching logic
└── test/
    └── mock-db.ts        # Test mock setup with preload
```

**Key Features:**
- Queue consumer pattern with batch processing
- Idempotent mention creation (UNIQUE constraint on source + source_id)
- KV-cached keyword loading for performance
- Case-insensitive keyword matching using `@trend-monitor/utils`
- Comprehensive test coverage (12 tests, all passing)

## Feed Ingestion Worker Structure

The feed ingestion worker (`apps/ingestion-feeds`) fetches RSS/Atom feeds and publishes events to the queue:

```
src/
├── index.ts              # Main entry point (scheduled + HTTP handlers)
├── handlers/
│   └── scheduled-handler.ts    # Cron-triggered handler
├── routes/
│   └── trigger.ts              # HTTP endpoints for manual triggering
├── lib/
│   ├── feed-parser.ts    # RSS/Atom parser using rss-parser
│   ├── feed-client.ts    # Feed fetcher with user agent support
│   ├── html-to-text.ts   # HTML to plain text converter
│   └── db/
│       └── index.ts      # Runtime DB binding
├── services/
│   ├── checkpoint-service.ts        # KV-based checkpoint storage
│   ├── ingestion-service.ts         # Feed processing with checkpointing
│   └── feed-processor.ts            # Core ingestion logic (shared)
└── test/
    ├── mock-db.ts                  # Mock environment for testing
    └── integration.test.ts         # End-to-end integration tests
```

**Key Features:**
- **Dual-mode operation**: Cron-triggered (every 15 minutes) and HTTP-triggered
- **HTTP endpoints**: POST /trigger/all and POST /trigger/:id for manual ingestion
- Universal RSS 2.0 and Atom 1.0 feed support using `rss-parser` package
- No authentication required - works with any public feed
- KV-based checkpoints for incremental fetching (tracks last processed post)
- HTML to plain text conversion for feed content
- Per-feed custom User-Agent configuration
- Supports Reddit, X/Twitter (via xcancel.com), Hacker News, blogs, and any RSS/Atom feed
- Comprehensive test coverage (45 tests, all passing)

## Source Config Management

The source config management system provides a complete UI and API for managing RSS/Atom feed sources with health tracking.

**Backend (API Worker):**
- `apps/api-worker/src/modules/sources/` - Full CRUD API with 8 endpoints
- `apps/api-worker/src/services/feed-validator.ts` - RSS/Atom feed validation service
- `packages/db/src/repositories/source-config-repository.ts` - Repository with health methods

**Health Tracking:**
- **Success** (green): 0 consecutive failures
- **Warning** (yellow): 1-5 consecutive failures
- **Error** (red): 6+ consecutive failures
- **Auto-disable**: After 10 consecutive failures
- Metrics tracked: `lastFetchAt`, `lastSuccessAt`, `lastErrorAt`, `lastErrorMessage`, `consecutiveFailures`

**Implementation Pattern:**
```typescript
// On success: reset failures
await repo.recordSuccess(id, {
  lastFetchAt: now, lastSuccessAt: now,
  consecutiveFailures: 0, lastErrorAt: null, lastErrorMessage: null
});

// On failure: increment and check threshold
const failures = (current?.consecutiveFailures || 0) + 1;
await repo.recordFailure(id, {
  lastFetchAt: now, lastErrorAt: now,
  lastErrorMessage: error.message, consecutiveFailures: failures
});
if (failures >= 10) await repo.disable(id);
```

**Database Schema Updates:**
The `source_configs` table includes health tracking fields (see database.md for full schema):
- `last_fetch_at`, `last_success_at`, `last_error_at`
- `last_error_message`, `consecutive_failures`
- `deleted_at` (soft delete support)

**Key Features:**
- Feed validation before saving (RSS 2.0 and Atom 1.0 support)
- Feed preview with metadata and recent items
- URL change detection in edit form requires re-validation
- Per-feed custom User-Agent configuration
- Soft delete with `deletedAt` timestamp
- Type-safe API using Eden Treaty client

## Key Patterns

1. **Shared Database Package**: Centralized Drizzle schema in `@trend-monitor/db` used by all workers
2. **Drizzle ORM**: Type-safe database queries with schema-driven development and automatic type inference
3. **Repository Pattern**: All database access goes through repository classes using Drizzle for testability
4. **Mock Database**: Uses `bun:sqlite` in-memory DB with Drizzle client for testing (imported from `@trend-monitor/db/mock`)
5. **Type Safety**: Drizzle schema types + shared types from `@trend-monitor/types` ensure full type safety
6. **Service Layer**: Complex business logic lives in `services/` to keep routes thin
7. **Idempotent Processing**: UNIQUE constraints and proper error handling prevent duplicate data
