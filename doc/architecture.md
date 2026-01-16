# Architecture – Social Trend & Keyword Monitor

## 1. System overview

This system is a serverless, event-driven application that monitors technical keywords across Reddit, X (Twitter), and selected websites, then exposes a web dashboard for exploration.

Core characteristics:

- **Frontend**: Pure SPA (e.g., React + Vite), deployed from a Turborepo app.
- **Backend**:
  - ElysiaJS API running on Cloudflare Workers.
  - Multiple Worker services for ingestion, processing, and aggregation.
- **Storage & infra** (Cloudflare):
  - D1 as the primary relational store.
  - Queues for ingestion → processing decoupling.
  - KV for configuration and caching.
  - Optional R2 for raw archival.

Monorepo management is handled with Turborepo and a `apps/` + `packages/` layout.

---

## 2. Repository structure (Turborepo)

```txt
.
├─ turbo.json
├─ package.json
├─ apps/
│  ├─ web/                 # SPA frontend
│  ├─ api-worker/          # Elysia API Worker
│  ├─ ingestion-reddit/    # Reddit ingestion Worker
│  ├─ ingestion-x/         # X (Twitter) ingestion Worker
│  ├─ ingestion-feeds/     # RSS/JSON feeds ingestion Worker
│  ├─ processor-worker/    # Queue consumer, writes mentions to D1
│  └─ aggregator-worker/   # Aggregates mentions into daily stats
└─ packages/
   ├─ shared-types/        # Shared TypeScript types/interfaces
   ├─ shared-config/       # Shared configuration & constants
   └─ shared-utils/        # Shared pure utilities (matching, time, etc.)
```

### 2.1 apps

- `apps/web`
  - SPA implementation (React/Vue/etc.).
  - Talks only to `/api/**` endpoints.
  - Uses `@shared-types` for DTOs and `@shared-config` for environment/feature flags.

- `apps/api-worker`
  - ElysiaJS app targeting the Cloudflare Worker runtime.
  - Exposes JSON API:
    - `/api/keywords`
    - `/api/trends/**`
    - `/api/mentions/**`
  - Optionally serves static SPA assets for production (if not using Pages separately).

- `apps/ingestion-*`
  - Each ingestion Worker focuses on one source (Reddit, X, feeds).
  - Runs on a schedule; fetches external data; emits normalized events to a queue.

- `apps/processor-worker`
  - Queue consumer Worker.
  - Performs keyword matching and writes `mentions` into D1.

- `apps/aggregator-worker`
  - Periodic Worker that aggregates `mentions` into `daily_aggregates` and computes trend metrics.

### 2.2 packages

- `packages/shared-types`
  - Types for:
    - Domain entities: `Keyword`, `Mention`, `DailyAggregate`.
    - Ingestion event schema.
    - API request/response DTOs.
  - Ensures type consistency across SPA, API, and Workers.

- `packages/shared-config`
  - Central location for:
    - Default aggregation windows (e.g., 7/30/90 days).
    - Thresholds for “emerging” keywords.
    - Known environment variable names/bindings.
  - Provides a programmatic config layer on top of environment variables.

- `packages/shared-utils`
  - Pure helper functions:
    - Keyword matching (exact, alias-based, basic normalization).
    - Time bucketing and date handling.
    - Validation helpers and error mappers.
    - Shared logging/format routines (consistent log structure).

---

## 3. Component architecture

### 3.1 Frontend SPA (`apps/web`)

**Responsibilities**

- Render the dashboard UI:
  - Overview (top keywords, emerging topics, stats).
  - Keyword detail (time series chart + mentions list).
  - Keyword management (CRUD).
  - Basic settings pages.
- Handle client-side routing and state management.
- Communicate with the API Worker over HTTPS (JSON).

**Key flows**

- On load:
  - Fetch overview trends (`GET /api/trends/overview`).
- On keyword detail:
  - Fetch time-series data for a keyword (`GET /api/trends/:keywordId`).
  - Fetch paginated mentions (`GET /api/mentions?...`).
- On keyword CRUD:
  - POST/PUT/DELETE requests to `/api/keywords`.

---

### 3.2 API Worker (`apps/api-worker`)

An ElysiaJS app that runs in the Cloudflare Workers runtime.

**Main responsibilities**

- Validate and route incoming HTTP requests.
- Read/write data from D1 (and optionally KV).
- Perform lightweight aggregation or filtering for API responses.
- Serve the SPA’s static files (if configured).

**Key route groups**

- `/api/keywords`
  - `GET /api/keywords` – list keywords with optional basic stats.
  - `POST /api/keywords` – create keyword.
  - `PUT /api/keywords/:id` – update keyword.
  - `DELETE /api/keywords/:id` – archive keyword.

- `/api/trends`
  - `GET /api/trends/overview` – returns:
    - Top keywords by mentions for a given period.
    - “Emerging” keywords.
    - Source breakdown.
  - `GET /api/trends/:keywordId` – returns:
    - Daily bucketed data for a keyword, optionally filtered by source.

- `/api/mentions`
  - `GET /api/mentions` – paginated list with filters:
    - `keywordId`, `source`, `from`, `to`.
  - `GET /api/mentions/:id` – detailed mention.

- `/api/admin/*` (internal)
  - Reaggregation triggers, maintenance utilities.

**Bindings & configuration**

- D1 binding for database access.
- KV binding for configuration cache.
- Optional R2 binding for raw archives.

---

### 3.3 Ingestion Workers (`apps/ingestion-*`)

Each ingestion Worker is responsible for a single source type.

#### Common behavior

- Triggered by Cron (e.g., every 5–15 minutes).
- Reads configuration (subreddits, search queries, feed URLs) from D1 or KV.
- Uses external APIs (Reddit, X, RSS/JSON) to fetch new content since last checkpoint.
- Converts external data to a shared event schema.
- Publishes messages to a Cloudflare queue.

#### Shared event schema

```ts
type IngestionEvent = {
  source: "reddit" | "x" | "feed";
  sourceId: string;
  title?: string | null;
  content: string;
  url: string;
  author?: string | null;
  createdAt: string; // Original timestamp from the source
  fetchedAt: string; // Timestamp when we ingested it
  metadata?: Record<string, unknown>;
};
```

#### Reddit ingestion

- Reads:
  - List of subreddits.
  - Global search configuration.
- Fetches:
  - New posts and/or comments since last run.
- Emits:
  - `source = 'reddit'`, plus relevant metadata (e.g., subreddit, score, comments count).

#### X ingestion

- Reads:
  - Search queries/hashtags to monitor.
- Fetches:
  - Tweets for each query, handling pagination and basic rate-limit awareness.
- Emits:
  - `source = 'x'`, with metadata like likes, retweets, etc. when available.

#### Feeds ingestion

- Reads:
  - Feed URLs and labels.
- Fetches:
  - RSS/JSON entries.
- Emits:
  - `source = 'feed'`, metadata may include site name or category.

---

### 3.4 Processor Worker (`apps/processor-worker`)

Consumes messages from the queue and turns them into normalized `mentions`.

**Workflow**

1. Receives an `IngestionEvent`.
2. Loads active keywords:
   - Uses an in-memory cache refreshed periodically.
   - Falls back to D1 or KV when needed.
3. Performs keyword/alias matching on `content` and optionally `title`.
4. If at least one keyword matches:
   - Constructs a `Mention` record.
   - Performs an idempotent insert into D1 (based on `(source, sourceId)`).
5. Optionally archives the original event to R2.

**Keyword matching**

- Implemented as pure functions in `@shared-utils`, e.g.:
  - Normalization (lowercasing, trimming).
  - Basic tokenization.
  - Matching keywords and aliases against the text.
- Designed to be simple and deterministic for MVP.

---

### 3.5 Aggregator Worker (`apps/aggregator-worker`)

Aggregates raw mentions into daily statistics and computes basic trend metrics.

**Workflow**

1. Triggered periodically (e.g., hourly).
2. Determines the time window to aggregate (e.g., last N hours/days that are not yet fully aggregated).
3. Reads `mentions` grouped by:
   - Day (`YYYY-MM-DD`).
   - `keyword_id`.
   - `source`.
4. Upserts records into `daily_aggregates`.
5. Optionally precomputes:
   - Current vs previous period counts and growth.
   - “Emerging” flags based on configured thresholds.
   - Caches the results in KV for fast retrieval by the API.

---

## 4. Data model (D1)

### 4.1 keywords

- `id` TEXT PRIMARY KEY
- `name` TEXT UNIQUE
- `aliases` TEXT (JSON array)
- `tags` TEXT (JSON array)
- `status` TEXT (`active` | `archived`)
- `created_at` TEXT (ISO)
- `updated_at` TEXT (ISO)

### 4.2 mentions

- `id` TEXT PRIMARY KEY
- `source` TEXT
- `source_id` TEXT
- `title` TEXT
- `content` TEXT
- `url` TEXT
- `author` TEXT
- `created_at` TEXT (original)
- `fetched_at` TEXT
- `matched_keywords` TEXT (JSON array of keyword IDs)

Indexes:

- By `created_at` for time-range queries.
- By `source`.
- Optional composite index for `matched_keywords` (via auxiliary tables or denormalized structures later).

### 4.3 daily_aggregates

- `id` TEXT PRIMARY KEY
- `date` TEXT (YYYY-MM-DD)
- `keyword_id` TEXT
- `source` TEXT
- `mentions_count` INTEGER

Unique constraint:

- (`date`, `keyword_id`, `source`)

### 4.4 source_config (optional)

- `id` TEXT PRIMARY KEY
- `type` TEXT (`reddit` | `x` | `feed`)
- `config` TEXT (JSON)
- `enabled` INTEGER

---

## 5. Request & data flows

### 5.1 User viewing overview dashboard

1. User opens SPA from Cloudflare Pages or the API Worker’s static assets.
2. SPA calls `GET /api/trends/overview?from=...&to=...`.
3. API Worker:
   - Reads `daily_aggregates` and/or cached KV summaries.
   - Computes top keywords and emerging topics.
4. SPA renders top lists, charts, and summary cards.

### 5.2 User viewing keyword details

1. SPA route `/keywords/:id` is activated.
2. SPA calls:
   - `GET /api/trends/:keywordId?from=...&to=...`
   - `GET /api/mentions?keywordId=...&from=...&to=...&source=...`
3. API Worker:
   - Returns bucketed daily counts from `daily_aggregates`.
   - Returns paginated `mentions` rows with filters.
4. SPA displays charts and a mention table with filtering and sorting.

### 5.3 End-to-end ingestion

1. Cron triggers `ingestion-*` Workers.
2. Ingestion Workers fetch external data and publish `IngestionEvent`s to queue.
3. Processor Worker consumes events, matches keywords, and writes `mentions` to D1.
4. Aggregator Worker periodically updates `daily_aggregates`.
5. API Worker serves updated trends and mentions to SPA.

---

## 6. Environments & deployment

### 6.1 Environments

- **Development**
  - Local monorepo dev with Turborepo.
  - Local Worker dev environment (via CLI simulator).
  - Test D1 instance and stubbed external APIs.

- **Staging**
  - Uses staging D1, queues, and KV.
  - Restricted ingestion scope and lower frequency.

- **Production**
  - Full ingestion for all configured sources.
  - Production D1, queues, KV, R2, and Workers.

### 6.2 Deployment strategy

- Use Turborepo to:
  - Build `packages/*` first.
  - Build each `apps/*` project.
- Deploy Workers and SPA through CI/CD:
  - API Worker + Workers via CLI/CI.
  - SPA either as Cloudflare Pages or baked into the API Worker’s static assets.

---

## 7. Security & observability

### 7.1 Security

- External API tokens for Reddit/X stored as secrets in environment.
- Public API surface limited to read-only endpoints in MVP.
- Admin/maintenance endpoints protected (e.g., by environment separation or IP restrictions).
- CORS restricted to allowed origins (SPA domains).

### 7.2 Observability

- Logging:
  - Ingestion Workers log fetch counts and errors.
  - Processor Worker logs processed events and failures.
  - Aggregator logs aggregation windows and results count.
- Metrics (initially via logs or lightweight counters):
  - Mentions processed per hour.
  - Queue depth.
  - Aggregation job durations.

---

## 8. Extensibility

- **New sources**: Add a new `apps/ingestion-<source>` Worker using the same event schema and shared utilities, no changes required to the Processor Worker or core schema.
- **New analytics**: Extend `aggregator-worker` and API responses with additional metrics (e.g., rolling averages, volatility) while preserving existing endpoints.
- **Multi-tenant / auth**: Add user/account tables in D1, inject user context into API routes, and restrict keywords and data per user while reusing the ingestion and processing pipeline.
