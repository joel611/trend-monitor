# Processor Worker

Queue consumer worker that processes ingestion events, matches keywords, and writes mentions to D1.

## Architecture

- **Pattern**: Queue consumer (Cloudflare Workers Queue)
- **Database**: D1 with Drizzle ORM via `@trend-monitor/db`
- **Cache**: KV for active keywords (5-min TTL)
- **Matching**: Case-insensitive keyword/alias matching via `@trend-monitor/utils`

## Key Features

- Idempotent mention creation (unique on source + source_id)
- KV-cached keyword loading for performance
- Automatic deduplication of matches
- Batch processing with error retry

## Development

```bash
# Start local dev server
bun run dev

# Run tests
bun test
bun run test:watch

# Type check
bun run typecheck

# Generate Wrangler types
bun run wrangler:types

# Deploy
bun run deploy
```

## Queue Configuration

From `wrangler.toml`:
- Queue: `ingestion-queue`
- Max batch size: 10 messages
- Max retries: 3

## Environment Bindings

- `DB`: D1 database binding
- `KEYWORD_CACHE`: KV namespace for keyword caching

## Data Flow

1. Receive `IngestionEvent` from queue
2. Load active keywords (from KV cache or DB)
3. Match keywords against content + title
4. If matches found, create mention in D1 (idempotent)
5. Log results

## Testing

Uses in-memory SQLite with Drizzle client for fast, isolated tests:
- Repository tests (unit)
- Service tests (unit)
- Integration tests (full queue handler)

Mock setup in `test/mock-db.ts` is preloaded for all tests.

## Project Structure

```
src/
├── index.ts                    # Queue handler entry point
├── lib/
│   └── db/
│       └── index.ts            # Runtime DB binding
├── repositories/
│   └── mentions-repository.ts  # Mentions DB access
├── services/
│   ├── keyword-cache.ts        # KV-cached keyword loader
│   ├── keywords-repository.ts  # Keywords DB access
│   └── keyword-matcher.ts      # Keyword matching logic
└── test/
    └── mock-db.ts              # Test mock setup
```

## Shared Packages

This worker uses:
- `@trend-monitor/db` - Drizzle schema, client factory, mock DB
- `@trend-monitor/types` - Shared TypeScript types
- `@trend-monitor/utils` - Keyword matching utilities
