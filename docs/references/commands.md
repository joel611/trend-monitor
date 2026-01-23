# Commands Reference

This document lists all development commands organized by workspace.

## Initial Setup

```bash
# Install dependencies
bun install

# Generate Cloudflare Worker types (for api-worker)
cd apps/api-worker && bun run wrangler:types

# Initialize local D1 database
cd apps/api-worker
bun wrangler:migrate:local
```

## Root Level (Turborepo)

Commands at the monorepo root:

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

## API Worker (apps/api-worker)

```bash
cd apps/api-worker
bun run dev              # Start local dev server (port 8787)
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers

# Database commands
bun run wrangler:migrate:local  # Run migrations (IMPORTANT: use 'bun run', not raw wrangler)
bunx wrangler d1 execute DB --local --persit-to ../../.wrangler/state --command "SELECT * FROM keywords"
```

## Processor Worker (apps/processor-worker)

```bash
cd apps/processor-worker
bun run dev              # Start local dev server (port 8788)
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers
```

## Feed Ingestion Worker (apps/ingestion-feeds)

```bash
cd apps/ingestion-feeds
bun run dev              # Start local dev server (port 8789)
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers
```

## Aggregator Worker (apps/aggregator-worker)

```bash
cd apps/aggregator-worker
bun run dev              # Start local dev server
bun test                 # Run tests
bun run deploy           # Deploy to Cloudflare Workers
```

## Web App (apps/web)

```bash
cd apps/web
bun run dev              # Start Vite dev server
bun run build            # Build for production
bun run preview          # Preview production build
```

## Installing shadcn Components

Use `bunx --bun` prefix to avoid installation hangs:

```bash
cd apps/web
bunx --bun shadcn@latest add <component> --yes
```
