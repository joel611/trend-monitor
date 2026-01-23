# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

This is a serverless web dashboard for monitoring technical keywords and trends across Reddit, X (Twitter), and selected websites. The architecture uses:

- **Frontend**: Pure SPA (React + Vite) deployed to Cloudflare Pages
- **Backend**: ElysiaJS API on Cloudflare Workers with Drizzle ORM
- **Infrastructure**: Cloudflare D1 (SQLite), Queues, KV, and R2
- **Monorepo**: Turborepo with apps/ and packages/ structure
- **Package Manager**: Bun with workspaces
- **Code Quality**: Biome for linting and formatting

## Project Status

**Phase 1 (API Layer) and Phase 2 (Processor Worker) are complete.** Implemented components:
- Shared Database Package with Drizzle ORM
- API Worker (ElysiaJS on Cloudflare Workers)
- Processor Worker (Queue consumer with keyword matching)
- Feed Ingestion Worker (RSS/Atom feeds with checkpoints)
- Aggregator Worker (Scheduled mention aggregation)
- Web Frontend (React SPA with TanStack Router/Query/Table/Form)
- Source Config Management (CRUD UI with health tracking)

Before implementing features:
1. Review `docs/prd.md` and `docs/architecture.md` for requirements

## Architecture Overview

### Monorepo Structure
```
apps/
├── web/                 # React SPA [✓]
├── api-worker/          # ElysiaJS API [✓]
├── ingestion-feeds/     # RSS/Atom ingestion [✓]
├── processor-worker/    # Queue consumer [✓]
└── aggregator-worker/   # Daily aggregation [✓]

packages/
├── db/                  # Drizzle schema, client [✓]
├── types/               # Shared TypeScript types [✓]
├── config/              # Configuration [✓]
└── utils/               # Utilities [✓]
.wrangler-shared/        # shared miniflare data across all worker
```

### Core Data Flow
1. **Ingestion Workers** (Cron) → fetch data → publish to Queue
2. **Processor Worker** (Queue) → match keywords → write to D1
3. **Aggregator Worker** (Periodic) → aggregate mentions → update stats
4. **API Worker** → serve data to SPA
5. **SPA** → display trends, charts, mentions

## Key Design Principles

1. **Event-driven ingestion**: Use Cloudflare Queues to decouple fetch from processing
2. **Idempotent processing**: Prevent duplicate mentions using (source, source_id)
3. **Pre-aggregation**: Compute daily stats in background for fast API responses
4. **Keyword matching**: Case-insensitive substring matching with alias support
5. **Simple first**: Avoid over-engineering; start with <100 lines per feature

## Quick Start

```bash
# Install dependencies
bun install

# Initialize local database
cd apps/api-worker && bun run wrangler:migrate:local

# Start all dev servers
bun run dev

# Run tests
bun run test

# Format code
bun run format:fix
```

## Local Development Notes
- `ingestion-feeds` will start with `processor-worker` worker in the same process in turborepo to enable local queue processing.
- `processor-worker` logs will goes into same process in `ingestion-feeds`.
- In deployment, processor-worker runs as a separate worker.

## References

For detailed information on specific topics, see:

- **Architecture & Patterns** → `docs/references/architecture.md`
  - Worker structures (API, Processor, Feed Ingestion)
  - Shared database package
  - Source config management
  - Key patterns (Repository, Service Layer, etc.)

- **Development Commands** → `docs/references/commands.md`
  - All workspace commands
  - Database migrations
  - Deployment commands

- **Database Schema** → `docs/references/database.md`
  - Complete schema definitions
  - Drizzle ORM patterns
  - Migration management

- **Frontend Patterns** → `docs/references/frontend.md`
  - TanStack Router/Query/Table/Form patterns
  - shadcn/ui component usage
  - Eden Treaty client patterns

- **Testing Setup** → `docs/references/testing.md`
  - Mock database setup
  - Testing patterns by worker type
  - Eden Treaty testing

- **Monorepo Guide** → `docs/references/monorepo.md`
  - Turborepo configuration
  - Adding new packages
  - Biome code quality setup

**When working on specific areas, read the relevant reference file first** to get full context.

### Quick Reference: Which File to Read?

- Adding/modifying API endpoints? → `architecture.md` + `database.md`
- Working on frontend features? → `frontend.md`
- Writing or fixing tests? → `testing.md`
- Setting up dev environment? → `commands.md`
- Adding new shared packages? → `monorepo.md`
- Understanding worker structures? → `architecture.md`

### Usage Pattern

1. Identify the area you're working on
2. Read the corresponding reference file(s)
3. Use that detailed context for implementation
4. Return to this file for high-level guidance

## Additional Documentation

- Product Requirements: `docs/prd.md`
- Architecture Design: `docs/architecture.md`
