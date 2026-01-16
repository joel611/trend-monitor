# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **API Worker** for the Trend Monitor application - an ElysiaJS-based REST API running on Cloudflare Workers. It provides endpoints for managing keywords, viewing trends, and accessing mentions data with Cloudflare D1 (SQLite) for persistence.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: ElysiaJS with OpenAPI support
- **Database**: Cloudflare D1 (SQLite)
- **Language**: TypeScript
- **Testing**: Bun Test with in-memory SQLite mocks
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
# Run migrations locally
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

### Key Patterns

1. **Repository Pattern**: All database access goes through repository classes (e.g., `KeywordsRepository`, `MentionsRepository`) for testability and maintainability.

2. **Dependency Injection via `.derive()`**: Routes use Elysia's `.derive()` to inject repositories, making them easy to test:
   ```typescript
   .derive(() => ({
     keywordsRepo: new KeywordsRepository(db),
   }))
   ```

3. **Mock Database for Testing**: Uses `bun:sqlite` in-memory database that implements the D1Database interface. Set up in `test/mock-db.ts` using `mock.module()`.

4. **Type Safety**: Full TypeScript with shared types from `@trend-monitor/types` package. Response/request DTOs are type-safe.

5. **Service Layer**: Complex business logic (like trends calculation with growth rates) lives in `services/` to keep routes thin.

### Database Schema

**keywords**: Monitored keywords with aliases (JSON array), tags (JSON array), status (`active`/`archived`)

**mentions**: Normalized posts/tweets/articles with `matched_keywords` (JSON array of keyword IDs), unique on `(source, source_id)`

**daily_aggregates**: Pre-aggregated daily counts per keyword/source, unique on `(date, keyword_id, source)`

### Testing Strategy

- **Repository tests**: Unit tests for DB operations using mock DB
- **Route tests**: Integration tests for HTTP endpoints using Eden Treaty client
- **Service tests**: Unit tests for business logic (trends calculation)

Mock DB is initialized in `test/mock-db.ts` which mocks the `cloudflare:workers` module before any imports.

## Cloudflare Workers Context

### Environment Bindings

Configure in `wrangler.toml`:
- `DB`: D1 database binding (accessed via `cloudflare:workers` env)
- `CACHE`: KV namespace binding (not yet used)
- Optional `R2` binding for archives

In code, access via:
```typescript
import { env } from "cloudflare:workers";
export const db = env.DB;
```

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
D1 doesn't have native JSON type. Store as TEXT with `JSON.stringify/parse`. Repositories handle serialization. Safe parsing with error handling in `rowToEntity()`.

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
