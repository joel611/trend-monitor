# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **API Worker** for the Trend Monitor application - an ElysiaJS-based REST API running on Cloudflare Workers. It provides endpoints for managing keywords, viewing trends, and accessing mentions data with Cloudflare D1 (SQLite) for persistence.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: ElysiaJS with OpenAPI support
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM with D1 adapter
- **Language**: TypeScript
- **Testing**: Bun Test with in-memory SQLite mocks (better-sqlite3)
- **Linting**: Biome
- **Package Manager**: Bun (workspaces)

## Common Commands

### Development
```bash
bun run dev              # Start local dev server (port 8787)
bun run wrangler:types   # Generate Cloudflare Worker types
```

### Testing
```bash
bun test                        # Run all tests
bun test src/modules/keywords/  # Run specific module tests
bun run test:watch              # Watch mode
bun run test:coverage           # With coverage
```

### Type Checking & Linting
```bash
bun run typecheck        # TypeScript type checking
bun run lint             # Biome linting
bun run format:fix       # Auto-fix formatting
```

### Database
```bash
# Generate Drizzle migrations from schema changes
bun run db:generate

# Push schema changes to local D1
bun run db:push

# Open Drizzle Studio to browse data
bun run db:studio

# Run migrations locally (manual approach)
wrangler d1 execute trend-monitor-local --local --file migrations/0001_init_schema.sql

# Execute SQL locally
wrangler d1 execute trend-monitor-local --local --command "SELECT * FROM keywords"
```

### Build & Deploy
```bash
bun run build            # Build and dry-run deployment
bun run deploy           # Deploy to Cloudflare Workers
```

## Architecture

### Modular Structure

The codebase follows a **feature module pattern** where each domain (keywords, mentions, trends) is self-contained:

```
src/
├── modules/
│   ├── keywords/           # Keywords CRUD
│   │   ├── index.ts        # Routes (Elysia handlers)
│   │   ├── repository.ts   # DB access layer
│   │   ├── index.test.ts   # Route integration tests
│   │   └── repository.test.ts
│   ├── mentions/           # Mentions listing
│   └── trends/             # Trends aggregation
├── services/               # Cross-module business logic
│   └── trends-service.ts   # Growth calculation, aggregation
├── lib/
│   └── db/
│       ├── index.ts        # Runtime DB binding (cloudflare:workers env)
│       └── mock.ts         # In-memory SQLite for tests
└── index.ts                # Main Elysia app entry point
```

### Key Endpoints
```
http://localhost:8787/openapi      # Scalar
http://localhost:8787/openapi/json # OpenAPI Spec
```

### Key Patterns

1. **Repository Pattern**: All database access goes through repository classes (e.g., `KeywordsRepository`, `MentionsRepository`) using Drizzle ORM for type-safe queries and testability.

2. **Drizzle ORM**: Type-safe query builder with schema-driven development. Schema defined in `src/lib/db/schema.ts`, with automatic TypeScript type inference.

3. **Dependency Injection via `.derive()`**: Routes use Elysia's `.derive()` to inject repositories, making them easy to test:
   ```typescript
   .derive(() => ({
     keywordsRepo: new KeywordsRepository(db),
   }))
   ```

4. **Mock Database for Testing**: Uses `bun:sqlite` (better-sqlite3) in-memory database with Drizzle client. Set up in `test/mock-db.ts` using `mock.module()` to provide Drizzle client directly.

5. **Type Safety**: Full TypeScript with Drizzle schema types (`$inferSelect`, `$inferInsert`) and shared types from `@trend-monitor/types` package. Response/request DTOs are type-safe.

6. **Service Layer**: Complex business logic (like trends calculation with growth rates) lives in `services/` to keep routes thin.

### Database Schema

Schema is defined using Drizzle ORM in `src/lib/db/schema.ts`:

**keywords**: Monitored keywords with aliases (JSON array), tags (JSON array), status (`active`/`archived`)
- Drizzle types: `Keyword` (select), `InsertKeyword` (insert)

**mentions**: Normalized posts/tweets/articles with `matched_keywords` (JSON array of keyword IDs), unique on `(source, source_id)`
- Drizzle types: `Mention` (select), `InsertMention` (insert)

**daily_aggregates**: Pre-aggregated daily counts per keyword/source, unique on `(date, keyword_id, source)`
- Drizzle types: `DailyAggregate` (select), `InsertDailyAggregate` (insert)

**Note**: Column names use camelCase in Drizzle schema and TypeScript code, mapped to snake_case in the actual SQLite database.

### Testing Strategy

- **Repository tests**: Unit tests for Drizzle ORM operations using mock DB
- **Route tests**: Integration tests for HTTP endpoints using Eden Treaty client
- **Service tests**: Unit tests for business logic (trends calculation with Drizzle)

Mock DB is initialized in `test/mock-db.ts` which creates a Drizzle client with better-sqlite3 in-memory database, then mocks the `cloudflare:workers` module to provide this client. The runtime `db` client in `src/lib/db/index.ts` detects this and uses it directly.

## Cloudflare Workers Context

### Environment Bindings

Configure in `wrangler.toml`:
- `DB`: D1 database binding (accessed via `cloudflare:workers` env)
- `CACHE`: KV namespace binding (not yet used)
- Optional `R2` binding for archives

In code, access the Drizzle client via:
```typescript
import { db } from "./lib/db";
// db is a Drizzle client wrapping D1Database (or mock DB in tests)

// Example query
const results = await db.select().from(keywords).where(eq(keywords.status, "active"));
```

The `db` export automatically detects whether it's running in production (with D1Database) or tests (with mock Drizzle client) and provides the appropriate client.

### Local Development

The `wrangler dev` command:
- Runs local dev server on port 8787
- Uses local D1 database (SQLite file)
- Supports inspector on port 9230 for debugging

## Workspace Integration

This is part of a Turborepo monorepo. Shared packages:
- `@trend-monitor/types`: Shared TypeScript types
- `@trend-monitor/config`: Shared configuration
- `@trend-monitor/utils`: Shared utilities

TypeScript path aliases configured in `tsconfig.json` for these packages.

## Important Notes

### Soft Deletes
Keywords use soft delete (status = 'archived') via DELETE endpoint. Never hard delete keywords as mentions reference them.

### JSON Column Handling
D1 doesn't have native JSON type. Drizzle schema uses `.text({ mode: "json" })` to automatically handle JSON serialization/deserialization. Arrays like `aliases`, `tags`, and `matchedKeywords` are defined with proper TypeScript types and automatically converted to/from JSON strings.

### Request Validation
Elysia's built-in validation (`t.Object`, `t.String`, etc.) handles request/response validation. Validation errors return 400 automatically.

### OpenAPI Documentation
The API has auto-generated OpenAPI docs via `@elysiajs/openapi`. Access at `/swagger` endpoint when server is running.

### CORS
Enabled for all origins in development. Configure appropriately for production.

## Troubleshooting

### "Module not found: cloudflare:workers"
This happens when running tests. Ensure `test/mock-db.ts` is imported first using `mock.module()` to mock the Cloudflare runtime.

### Type errors with D1Database
Run `bun run wrangler:types` to regenerate `worker-configuration.d.ts`.

### Local DB not initialized
Run the migration SQL file with `wrangler d1 execute` as shown in Database commands.
