# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Overview

This is a serverless web dashboard for monitoring technical keywords and trends across Reddit, X (Twitter), and selected websites. The architecture uses:

- **Frontend**: Pure SPA (React + Vite) deployed to Cloudflare Pages
- **Backend**: ElysiaJS API on Cloudflare Workers
- **Infrastructure**: Cloudflare D1 (SQLite), Queues, KV, and R2
- **Monorepo**: Turborepo with apps/ and packages/ structure (not yet scaffolded)

## Project Status

**This project is currently in the planning phase.** The codebase contains:
- Complete PRD (`doc/prd.md`) and architecture documentation (`doc/architecture.md`)
- OpenSpec workflow for spec-driven development
- No implementation code yet

Before implementing features, always:
1. Review `doc/prd.md` and `doc/architecture.md` for requirements and design
2. Check `openspec/` for any existing specifications or change proposals
3. Follow the OpenSpec workflow when creating new capabilities

## Planned Architecture

### Monorepo Structure (to be created)
```
apps/
├── web/                 # SPA frontend (React + Vite)
├── api-worker/          # ElysiaJS API Worker
├── ingestion-reddit/    # Reddit ingestion Worker
├── ingestion-x/         # X (Twitter) ingestion Worker
├── ingestion-feeds/     # RSS/JSON feeds ingestion Worker
├── processor-worker/    # Queue consumer, writes mentions to D1
└── aggregator-worker/   # Aggregates mentions into daily stats

packages/
├── shared-types/        # Shared TypeScript types/interfaces
├── shared-config/       # Shared configuration & constants
└── shared-utils/        # Shared utilities (matching, time, etc.)
```

### Core Data Flow
1. **Ingestion Workers** (Cron-triggered) → fetch external data → publish to Queue
2. **Processor Worker** (Queue consumer) → match keywords → write mentions to D1
3. **Aggregator Worker** (periodic) → aggregate mentions → update daily stats
4. **API Worker** → serve aggregated data to SPA
5. **SPA** → display trends, charts, and mention details

### Database Schema (D1)

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

## Key Design Principles

1. **Event-driven ingestion**: Use Cloudflare Queues to decouple fetch from processing
2. **Idempotent processing**: Prevent duplicate mentions using (source, source_id)
3. **Pre-aggregation**: Compute daily stats in background for fast API responses
4. **Keyword matching**: Case-insensitive substring matching with alias support (basic for MVP)
5. **Simple first**: Avoid over-engineering; start with <100 lines per feature

## Development Workflow (when implementation begins)

### Initial Setup (not yet done)
```bash
# Install dependencies
bun install

# Set up Turborepo workspace
# (commands to be defined when scaffolding)

# Local D1 development
# (wrangler commands to be defined)
```

### Common Commands (to be defined)
Development commands will be added here once the monorepo and build tooling are set up.

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

## OpenSpec Workflow

This project uses OpenSpec for spec-driven development. Key points:

- **Before new features**: Create change proposal in `openspec/changes/[change-id]/`
- **Validate proposals**: Run `openspec validate [change-id] --strict --no-interactive`
- **After deployment**: Archive changes to `openspec/changes/archive/`
- **For clarification**: Always check `openspec/AGENTS.md` first

## References

- Product Requirements: `docs/prd.md`
- Architecture Design: `docs/architecture.md`
- OpenSpec Guidelines: `openspec/AGENTS.md`
- Project Conventions: `openspec/project.md`
