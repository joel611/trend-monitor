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

**Phase 1 (API Layer) and Phase 2 (Processor Worker) are complete.** The codebase now contains:
- Complete PRD (`docs/prd.md`) and architecture documentation (`docs/architecture.md`)
- OpenSpec workflow for spec-driven development
- **Implemented**:
  - **Shared Database Package** (`@trend-monitor/db`) with Drizzle ORM schema, client factory, and mock DB
  - **API Worker** - Full API layer with ElysiaJS on Cloudflare Workers
    - Keywords CRUD endpoints
    - Mentions repository and endpoints
    - Trends service with growth calculation
    - D1 database integration with Drizzle ORM and repository pattern
    - Comprehensive test suite (unit + integration)
  - **Processor Worker** - Queue consumer with keyword matching
    - Processes ingestion events from queue
    - Matches keywords against content using shared utilities
    - Stores mentions idempotently in D1
    - KV-cached keyword loading for performance
    - Comprehensive test suite (12 tests, all passing)
  - **Feed Ingestion Worker** - Universal RSS/Atom feed ingestion
    - No authentication required (public feeds)
    - Supports Reddit, Hacker News, blogs, any RSS/Atom feed
    - RSS 2.0 and Atom 1.0 format support using rss-parser
    - Incremental fetching with KV checkpoints
    - HTML to text conversion
    - Per-feed custom user agent support
    - Full test coverage (30 tests, all passing)
- **Not yet implemented**: aggregator worker, web frontend

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
├── ingestion-feeds/     # RSS/Atom feeds ingestion Worker (Reddit, X, HN, blogs) [✓ implemented]
├── processor-worker/    # Queue consumer, writes mentions to D1 [✓ implemented]
└── aggregator-worker/   # Aggregates mentions into daily stats [scaffolded]

packages/
├── db/                  # Shared Drizzle schema, client factory, mock DB [✓ implemented]
├── types/               # Shared TypeScript types/interfaces [✓ implemented]
├── config/              # Shared configuration & constants [✓ implemented]
└── utils/               # Shared utilities (matching, time, etc.) [✓ implemented]
```

### Core Data Flow
1. **Ingestion Workers** (Cron-triggered) → fetch external data → publish to Queue
2. **Processor Worker** (Queue consumer) → match keywords → write mentions to D1
3. **Aggregator Worker** (periodic) → aggregate mentions → update daily stats
4. **API Worker** → serve aggregated data to SPA
5. **SPA** → display trends, charts, and mention details

### Database Schema (D1)

Schema is managed by Drizzle ORM in the shared `@trend-monitor/db` package. See `packages/db/src/schema.ts` for the schema definition.

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

**Processor Worker (apps/processor-worker):**
```bash
cd apps/processor-worker
bun run dev              # Start local dev server (port 8788)
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers
```

**Feed Ingestion Worker (apps/ingestion-feeds):**
```bash
cd apps/ingestion-feeds
bun run dev              # Start local dev server (port 8789)
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers
```

**Web App (apps/web):**
```bash
cd apps/web
bun run dev              # Start Vite dev server
bun run build            # Build for production
bun run preview          # Preview production build
```

## Implemented Architecture

### Shared Database Package (`@trend-monitor/db`)

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
│       └── index.ts      # Runtime DB binding (uses @trend-monitor/db)
└── index.ts              # Main Elysia app entry point
```

### Processor Worker Structure

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

### Feed Ingestion Worker Structure

The feed ingestion worker (`apps/ingestion-feeds`) fetches RSS/Atom feeds and publishes events to the queue:

```
src/
├── index.ts              # Scheduled handler entry point
├── lib/
│   ├── feed-parser.ts    # RSS/Atom parser using rss-parser
│   ├── feed-client.ts    # Feed fetcher with user agent support
│   └── html-to-text.ts   # HTML to plain text converter
├── repositories/
│   └── source-config-repository.ts  # Load feed configs from D1
├── services/
│   ├── checkpoint-service.ts        # KV-based checkpoint storage
│   └── ingestion-service.ts         # Feed processing with checkpointing
└── test/
    └── integration.test.ts  # End-to-end integration tests
```

**Key Features:**
- Cron-triggered (every 15 minutes) scheduled worker
- Universal RSS 2.0 and Atom 1.0 feed support using `rss-parser` package
- No authentication required - works with any public feed
- KV-based checkpoints for incremental fetching (tracks last processed post)
- HTML to plain text conversion for feed content
- Per-feed custom User-Agent configuration
- Supports Reddit, X/Twitter (via xcancel.com), Hacker News, blogs, and any RSS/Atom feed
- Comprehensive test coverage (30 tests, all passing)

### Key Patterns

1. **Shared Database Package**: Centralized Drizzle schema in `@trend-monitor/db` used by all workers
2. **Drizzle ORM**: Type-safe database queries with schema-driven development and automatic type inference
3. **Repository Pattern**: All database access goes through repository classes using Drizzle for testability
4. **Mock Database**: Uses `bun:sqlite` in-memory DB with Drizzle client for testing (imported from `@trend-monitor/db/mock`)
5. **Type Safety**: Drizzle schema types + shared types from `@trend-monitor/types` ensure full type safety
6. **Service Layer**: Complex business logic lives in `services/` to keep routes thin
7. **Idempotent Processing**: UNIQUE constraints and proper error handling prevent duplicate data

### Testing

Tests use:
- `bun:sqlite` for in-memory database (from `@trend-monitor/db/mock`)
- Drizzle ORM client for type-safe database operations
- Eden Treaty client for type-safe API testing (api-worker)
- Mock module setup with `--preload ./test/mock-db.ts` for proper isolation
- Shared mock DB from `@trend-monitor/db/mock` ensures consistent test setup

**Running Tests:**
- From specific worker: `cd apps/[worker-name] && bun run test`
- From root: `bun run test` (runs all workspace tests via Turborepo)

### Database Schema (Implemented)

The schema is defined using Drizzle ORM in `packages/db/src/schema.ts`:

- **keywords**: id, name, aliases (JSON), tags (JSON), status, created_at, updated_at
- **mentions**: id, source, source_id, title, content, url, author, created_at, fetched_at, matched_keywords (JSON)
  - UNIQUE constraint on (source, source_id) for idempotent inserts
- **daily_aggregates**: id, date, keyword_id, source, mentions_count
  - UNIQUE constraint on (date, keyword_id, source)
- **source_configs**: id, type, config (JSON), enabled, created_at, updated_at
  - Stores feed source configurations for ingestion worker
  - type CHECK constraint ('feed', 'x')
  - enabled CHECK constraint (0, 1)

Drizzle provides automatic type inference with `$inferSelect` and `$inferInsert` types. Column names use camelCase in TypeScript but are mapped to snake_case in the SQLite database.

See `packages/db/src/schema.ts` for Drizzle schema and `apps/api-worker/migrations/` for SQL migrations.

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
