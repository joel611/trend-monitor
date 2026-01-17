# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a serverless web dashboard for monitoring technical keywords and trends across Reddit, X (Twitter), and selected websites. The architecture uses:

- **Frontend**: Pure SPA (React + Vite) deployed to Cloudflare Pages
- **Backend**: ElysiaJS API on Cloudflare Workers with Drizzle ORM
- **Infrastructure**: Cloudflare D1 (SQLite), Queues, KV, and R2
- **Monorepo**: Turborepo with apps/ and packages/ structure
- **Package Manager**: Bun with workspaces
- **Code Quality**: Biome for linting and formatting

## Project Status

**Phase 1 (API Layer) is complete.** The codebase now contains:
- Complete PRD (`docs/prd.md`) and architecture documentation (`docs/architecture.md`)
- OpenSpec workflow for spec-driven development
- **Implemented**: Full API layer with ElysiaJS on Cloudflare Workers
  - Keywords CRUD endpoints
  - Mentions repository and endpoints
  - Trends service with growth calculation
  - D1 database integration with Drizzle ORM and repository pattern
  - Comprehensive test suite (unit + integration)
- **Not yet implemented**: Ingestion workers, processor worker, aggregator worker, web frontend

Before implementing features, always:
1. Review `docs/prd.md` and `docs/architecture.md` for requirements and design
2. Check `openspec/` for any existing specifications or change proposals
3. Follow the OpenSpec workflow when creating new capabilities

## Planned Architecture

### Monorepo Structure
```
apps/
├── web/                 # SPA frontend (React + Vite + TanStack Router) [scaffolded]
├── api-worker/          # ElysiaJS API Worker [✓ implemented]
├── ingestion-reddit/    # Reddit ingestion Worker [scaffolded]
├── ingestion-x/         # X (Twitter) ingestion Worker [scaffolded]
├── ingestion-feeds/     # RSS/JSON feeds ingestion Worker [scaffolded]
├── processor-worker/    # Queue consumer, writes mentions to D1 [scaffolded]
└── aggregator-worker/   # Aggregates mentions into daily stats [scaffolded]

packages/
├── types/               # Shared TypeScript types/interfaces [✓ implemented]
├── config/              # Shared configuration & constants [scaffolded]
└── utils/               # Shared utilities (matching, time, etc.) [scaffolded]
```

### Core Data Flow
1. **Ingestion Workers** (Cron-triggered) → fetch external data → publish to Queue
2. **Processor Worker** (Queue consumer) → match keywords → write mentions to D1
3. **Aggregator Worker** (periodic) → aggregate mentions → update daily stats
4. **API Worker** → serve aggregated data to SPA
5. **SPA** → display trends, charts, and mention details

### Database Schema (D1)

Schema is managed by Drizzle ORM. See `apps/api-worker/src/lib/db/schema.ts` for the schema definition.

**keywords**
- Stores monitored keywords with aliases and tags
- Fields: id, name, aliases (JSON), tags (JSON), status, created_at, updated_at

**mentions**
- Normalized posts/tweets/articles matching keywords
- Fields: id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords (JSON)
- Indexes: created_at, source

**daily_aggregates**
- Pre-aggregated daily mention counts per keyword/source
- Fields: id, date, keyword_id, source, mentions_count
- Unique: (date, keyword_id, source)

**Note**: Drizzle uses camelCase in TypeScript (e.g., `createdAt`), which is mapped to snake_case in the SQLite database (e.g., `created_at`).

## Key Design Principles

1. **Event-driven ingestion**: Use Cloudflare Queues to decouple fetch from processing
2. **Idempotent processing**: Prevent duplicate mentions using (source, source_id)
3. **Pre-aggregation**: Compute daily stats in background for fast API responses
4. **Keyword matching**: Case-insensitive substring matching with alias support (basic for MVP)
5. **Simple first**: Avoid over-engineering; start with <100 lines per feature

## Development Workflow

### Initial Setup
```bash
# Install dependencies
bun install

# Generate Cloudflare Worker types (for api-worker)
cd apps/api-worker && bun run wrangler:types

# Initialize local D1 database
cd apps/api-worker
wrangler d1 execute trend-monitor-local --local --file migrations/0001_init_schema.sql
```

### Common Commands

**Root level (Turborepo):**
```bash
bun run dev              # Start all dev servers concurrently
bun run build            # Build all packages and apps
bun run typecheck        # Type check all workspaces
bun run lint             # Lint all workspaces (Biome)
bun run format:fix       # Auto-fix formatting (Biome)
bun run test             # Run all tests
bun run test:unit        # Run unit tests only
bun run test:integration # Run integration tests only
bun run test:watch       # Run tests in watch mode
bun run test:coverage    # Run tests with coverage
```

**API Worker (apps/api-worker):**
```bash
cd apps/api-worker
bun run dev              # Start local dev server (port 8787)
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers

# Database commands
wrangler d1 execute trend-monitor-local --local --command "SELECT * FROM keywords"
wrangler d1 execute trend-monitor-local --local --file migrations/0001_init_schema.sql
```

**Web App (apps/web):**
```bash
cd apps/web
bun run dev              # Start Vite dev server
bun run build            # Build for production
bun run preview          # Preview production build
```

## Implemented Architecture (API Layer)

### API Worker Structure

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
│       ├── schema.ts     # Drizzle schema definition
│       ├── client.ts     # Drizzle client factory
│       ├── index.ts      # Runtime DB binding with auto-detection
│       └── mock.ts       # In-memory SQLite for tests
└── index.ts              # Main Elysia app entry point
```

### Key Patterns

1. **Drizzle ORM**: Type-safe database queries with schema-driven development and automatic type inference
2. **Repository Pattern**: All database access goes through repository classes using Drizzle for testability
3. **Dependency Injection via `.derive()`**: Routes inject repositories using Elysia's context
4. **Mock Database**: Uses `bun:sqlite` (better-sqlite3) in-memory DB with Drizzle client for testing
5. **Type Safety**: Drizzle schema types + shared types from `@trend-monitor/types` ensure full type safety
6. **Service Layer**: Complex business logic lives in `services/` to keep routes thin

### Testing

Tests use:
- `bun:sqlite` (better-sqlite3) for in-memory database
- Drizzle ORM client for type-safe database operations
- Eden Treaty client for type-safe API testing
- Mock module setup in `test/mock-db.ts` that provides Drizzle client

Run tests with `bun test` from the API worker directory or `bun run test` from root.

### Database Schema (Implemented)

The schema is defined using Drizzle ORM in `apps/api-worker/src/lib/db/schema.ts`:

- **keywords**: id, name, aliases (JSON), tags (JSON), status, created_at, updated_at
- **mentions**: id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords (JSON)
- **daily_aggregates**: id, date, keyword_id, source, mentions_count (unique on date + keyword + source)

Drizzle provides automatic type inference with `$inferSelect` and `$inferInsert` types. Column names use camelCase in TypeScript but are mapped to snake_case in the SQLite database.

See `apps/api-worker/src/lib/db/schema.ts` for Drizzle schema and `apps/api-worker/migrations/` for SQL migrations.

## Working with the Monorepo

### Turborepo Configuration

The project uses Turborepo for task orchestration. Key features:

- **Task pipelines**: Build tasks run dependencies first (`dependsOn: ["^build"]`)
- **Caching**: Test and lint tasks are cached for performance
- **Parallel execution**: Independent tasks run concurrently
- **Persistent tasks**: Dev servers (`dev`, `test:watch`) run continuously

### Adding New Packages

When creating new shared packages:

1. Create under `packages/[name]/`
2. Add to workspace in root `package.json`
3. Export types and ensure `package.json` has proper exports
4. Reference in dependent apps as `@trend-monitor/[name]`

### Code Quality

**Biome** (replacement for ESLint + Prettier) is configured at the root:

- Tab indentation, 100 char line width
- Runs on all TypeScript/JavaScript files
- TailwindCSS class sorting enabled (warn level)
- Git-aware (respects `.gitignore`)

Use `bun run format:fix` to auto-fix, or `bun check` for the root-level Biome check.

## Important Considerations

### Security
- External API tokens (Reddit, X) stored as Cloudflare secrets
- Public API surface is read-only in MVP
- Admin endpoints protected by environment separation

### Scalability Targets
- Dozens of keywords
- Thousands of mentions per day
- Independent scaling via Queue-based ingestion

### Data Sources
- **Reddit**: Selected subreddits + global search
- **X**: Search queries/hashtags (API access dependent)
- **Website feeds**: RSS/JSON feeds

## References

- Product Requirements: `docs/prd.md`
- Architecture Design: `docs/architecture.md`
