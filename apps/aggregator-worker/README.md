# Aggregator Worker

Scheduled Cloudflare Worker that aggregates raw mentions into daily statistics.

## Overview

This worker runs on a cron schedule (hourly) and:
1. Identifies dates with mentions that haven't been aggregated yet
2. Groups mentions by date, keyword, and source
3. Upserts aggregated counts into the `daily_aggregates` table

## Architecture

- **Scheduled Handler**: `src/index.ts` - Entry point triggered by cron
- **Repository**: `src/repositories/aggregation-repository.ts` - Data access layer
- **Service**: `src/services/aggregation-service.ts` - Business logic
- **Database**: Uses shared `@trend-monitor/db` package with Drizzle ORM

## Key Features

- **Idempotent**: Safe to run multiple times - only processes pending dates
- **Efficient**: Only aggregates dates that need it (no duplicate work)
- **Type-safe**: Full TypeScript with Drizzle ORM
- **Well-tested**: Comprehensive unit and integration tests

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Local dev (runs on port 8789)
bun run dev

# Trigger manually in dev
curl "http://localhost:8789/__scheduled?cron=0+*+*+*+*"
```

## Deployment

```bash
# Build and verify
bun run build

# Deploy to Cloudflare
bun run deploy
```

## Configuration

Cron schedule configured in `wrangler.toml`:
- Default: `0 * * * *` (every hour)
- Lookback window: 7 days (configurable in code)

## Database Schema

Uses tables from `@trend-monitor/db`:
- **mentions** (read): Raw social media posts with matched keywords
- **daily_aggregates** (write): Daily counts per keyword/source
