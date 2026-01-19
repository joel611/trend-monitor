# Trend Monitor

Serverless web dashboard for monitoring technical keywords and trends across Reddit, X (Twitter), and selected websites.

## Architecture

- **Frontend**: Pure SPA (React + Vite) deployed to Cloudflare Pages
- **Backend**: ElysiaJS API on Cloudflare Workers with Drizzle ORM
- **Infrastructure**: Cloudflare D1 (SQLite), Queues, KV, and R2
- **Monorepo**: Turborepo with apps/ and packages/ structure

## Quick Start

```bash
# Install dependencies
bun install

# Start all dev servers
bun run dev
```

## Apps

### API Worker (apps/api-worker)

ElysiaJS API for keywords, mentions, and trends.

**Development:**
```bash
cd apps/api-worker
bun run dev              # Start local dev server (port 8787)
```

**Testing:**
```bash
bun test                 # Run all tests
bun run test:integration # Run integration tests
```

**Deployment:**
```bash
bun run deploy           # Deploy to Cloudflare Workers
```

### Web Dashboard (apps/web)

React SPA for visualizing trends and managing keywords.

**Development:**
```bash
cd apps/web
bun run dev              # Start dev server (port 5173)
```

**Testing:**
```bash
bun test                 # Run tests
bun run test:watch       # Watch mode
```

**Building:**
```bash
bun run build            # Build for production
bun run preview          # Preview production build
```

**Deployment:**
```bash
bun run deploy:preview   # Deploy to Cloudflare Pages (preview)
bun run deploy:production # Deploy to production
```

**Tech Stack:**
- React 19 with TypeScript
- TanStack Router (file-based routing)
- TanStack Query (data fetching)
- Tailwind CSS v4 (styling)
- Recharts (charts)
- Vite (build tool)

## Development Commands

```bash
bun run dev              # Start all dev servers
bun run build            # Build all packages and apps
bun run typecheck        # Type check all workspaces
bun run lint             # Lint all workspaces
bun run format:fix       # Auto-fix formatting
bun run test             # Run all tests
```

## Documentation

- [Product Requirements](docs/prd.md)
- [Architecture Design](docs/architecture.md)
- [Project Guidelines](CLAUDE.md)

## Tech Stack

- **Runtime**: Bun
- **Monorepo**: Turborepo
- **Code Quality**: Biome (linting + formatting)
- **Database**: Drizzle ORM + Cloudflare D1
- **API**: ElysiaJS on Cloudflare Workers
- **Frontend**: React 19 + TanStack Router + TanStack Query
- **Styling**: Tailwind CSS v4
