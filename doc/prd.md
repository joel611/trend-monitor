# Product Definitions Document – Social Trend & Keyword Monitor Dashboard

## 1. Overview

This product is a web‑based dashboard that tracks technical topics and keywords across Reddit, X (Twitter), and selected websites, then surfaces insights about emerging trends. The front end is a pure SPA, and the backend is implemented with ElysiaJS running on Cloudflare Workers, using Cloudflare data and queue services as the core infrastructure.

## 2. Goals & Non‑Goals

### 2.1 Goals

- Provide a single dashboard to:
  - Monitor specific keywords and topics across multiple sources.
  - Detect trending or emerging technical topics.
  - Let the user drill down into raw posts and links.

- Enable:
  - Configurable keyword/watch lists.
  - Time‑series visualization of mentions per keyword/source.
  - Daily/weekly digests of notable changes.

- Architect for:
  - Event‑driven ingestion (queues) and cheap read‑heavy queries.
  - Easy addition of new sources (e.g., HN, Product Hunt, tech blogs).

### 2.2 Non‑Goals

- Not a full social media management tool (no post scheduling, reply UI, etc.).
- Not initially focused on advanced ML (e.g., embeddings, clustering) beyond basic heuristics; those can be added later.
- Not a data warehouse; long‑term archival is minimal at first.

## 3. Personas & Use Cases

### 3.1 Personas

- **Technical Founder / PM**
  - Wants early signal on new technologies, frameworks, and libraries.
  - Needs a quick sense of “what’s taking off” without reading every thread.

- **Senior Engineer / Architect**
  - Tracks ecosystem changes (e.g., new database, framework, tool).
  - Monitors keyword sets related to their stack and competitors.

### 3.2 Core Use Cases

1. **Track keyword mentions**
   - As a user, define a list of keywords (e.g., “ElysiaJS”, “Cloudflare D1”, “Bun”) and see daily mention counts by source over the last N days.

2. **Discover emerging topics**
   - As a user, view a “trends” section that highlights:
     - Keywords with significant week‑over‑week growth.
     - Newly detected high‑volume keywords that were low/zero before.

3. **Inspect raw posts**
   - As a user, click into a keyword or trend and see the underlying Reddit/X/posts that contributed to that spike, filterable by source and time range.

4. **Configure sources and filters**
   - As a user, specify:
     - Subreddits to include.
     - X search queries/hashtags.
     - Website feeds (RSS/JSON) or preconfigured “source packs”.

5. **Receive periodic digests**
   - As a user, receive a daily or weekly summary (e.g., by email/Telegram/Slack in later phases) with:
     - Top rising keywords.
     - Top posts/threads per keyword.

## 4. Scope & Features

### 4.1 MVP Scope

- Keyword management (CRUD).
- Sources v1:
  - Reddit (selected subreddits + global search).
  - X (search/hashtag queries; depends on API access).
  - Website feeds via RSS/JSON (basic support).
- Ingestion pipeline:
  - Scheduled fetch from each source.
  - Keyword matching and normalization.
  - Storage of normalized “mentions”.
- Dashboard SPA:
  - Keyword list view.
  - Trend charts (mentions over time).
  - Mentions table with filters.
- Simple trend detection:
  - Week‑over‑week growth calculation.
  - Basic “new keyword” detection based on thresholds.

### 4.2 Post‑MVP (future)

- Advanced trending:
  - Moving averages, volatility, or z‑score spikes.
  - Basic clustering or semantic grouping (via LLM or embeddings).
- Additional sources:
  - Hacker News, Product Hunt, GitHub trending, etc.
- Notifications:
  - Slack/Discord/Telegram/email alerts.
- User accounts & multi‑tenant configuration.

## 5. Functional Requirements

### 5.1 Keyword Management

- User can:
  - Create a keyword with:
    - `name` (string, unique per user).
    - Optional `aliases` (e.g., “Cloudflare D1”, “D1”).
    - Optional `tags` (e.g., “db”, “framework”).
  - Edit existing keywords.
  - Archive/disable keywords without deleting history.

- System must:
  - Use keyword definitions when matching mentions from all sources.
  - Support up to N keywords (configurable; start with ~100 per user).

### 5.2 Source Configuration

- Reddit:
  - Define:
    - List of subreddits to scan.
    - Global search query template (e.g., top/new posts with a keyword).
  - Ingestion Worker periodically:
    - Fetches posts & comments.
    - Normalizes fields.

- X:
  - Define:
    - One or more search queries/hashtags.
  - Ingestion Worker:
    - Fetches tweets based on search.
    - Handles pagination and rate‑limit backoff.

- Websites (RSS/JSON):
  - Define:
    - Feed URL.
    - Source label.
  - Ingestion Worker:
    - Polls feed.
    - Extracts title/summary/content and link.

### 5.3 Mention Normalization

- For each fetched item (post/tweet/article), system creates a `mention` record with:
  - `id` (UUID).
  - `source` (enum: `reddit`, `x`, `feed`).
  - `source_id` (original ID or URL).
  - `title` (optional).
  - `text` / `content`.
  - `url`.
  - `author` (where available).
  - `created_at` (original timestamp).
  - `fetched_at`.
  - `matched_keywords` (array of keyword IDs).
- Keyword matching:
  - Case‑insensitive substring and/or basic token match.
  - Support alias list per keyword.
  - Deduplicate repeated matches for the same mention.

### 5.4 Trend Aggregation

- For each keyword and source, system maintains aggregated counts:
  - Daily bucket (date, keyword_id, source, mentions_count).
- Aggregation job:
  - Runs periodically (e.g., hourly).
  - Rolls up mentions from raw table into aggregates.
- Trend metrics:
  - For each keyword:
    - Current period count (e.g., last 7 days).
    - Previous period count (e.g., 7 days before that).
    - Growth rate (percentage).
- Emerging keyword logic:
  - Mark keyword as “emerging” if:
    - Previous period count < X (e.g., < 3).
    - Current period count ≥ Y (e.g., ≥ 10).

### 5.5 Dashboard SPA Features

#### 5.5.1 Home / Overview

- Displays:
  - Top N keywords by current period mentions.
  - Top N “emerging” keywords (sorted by growth).
  - Summary cards:
    - Total mentions in last 24h / 7d.
    - Breakdown by source.

#### 5.5.2 Keyword Detail Page

- Shows:
  - Line or bar chart: daily mentions over selected time range.
  - Toggle filter by source (stacked or multi‑series).
  - Table of mentions:
    - Columns: source, title/snippet, time, engagement metrics (if available), link.
    - Filters: source, min date, max date.
- User can:
  - Change time range (e.g., 7/30/90 days).
  - Sort table by time or engagement.

#### 5.5.3 Keyword Management UI

- List of all keywords with:
  - Name, tags, status (active/archived).
  - Basic stats (last 7 days mentions).
- Create/edit keyword dialog:
  - Fields for name, aliases, tags.
- Toggle active/archived.

#### 5.5.4 Source Settings UI (Phase 1 – internal use)

- Minimal UI (or config‑file driven) used by you initially:
  - Configure global sources (subreddit list, X queries, feed URLs).
- Later, can be UI‑driven per user.

## 6. API Design (ElysiaJS on Cloudflare Workers)

### 6.1 Auth (MVP)

- MVP: single user / no auth, secured via private deployment / basic protection.
- Later: JWT/session auth, multi‑tenant.

### 6.2 REST Endpoints (MVP)

**Keywords**

- `GET /api/keywords`
  - Returns list with basic stats (optional).
- `POST /api/keywords`
  - Create keyword.
- `PUT /api/keywords/:id`
  - Update keyword.
- `DELETE /api/keywords/:id`
  - Soft‑delete or archive.

**Trends**

- `GET /api/trends/overview`
  - Query params: `from`, `to`.
  - Returns:
    - Top keywords by mentions.
    - Emerging keywords with growth rates.
- `GET /api/trends/:keywordId`
  - Query params: `from`, `to`, `source?`.
  - Returns:
    - Time series data (daily buckets).
    - Summary stats.

**Mentions**

- `GET /api/mentions`
  - Query params:
    - `keywordId?`
    - `source?`
    - `from?`
    - `to?`
    - `limit`, `offset` or cursor.
  - Returns:
    - Paginated list of mentions.
- `GET /api/mentions/:id`
  - Get a single mention with full text.

**Admin / Internal**

- `POST /api/admin/reaggregate` (optional)
  - Trigger reaggregation for a given date range.

## 7. Data Model (Cloudflare D1)

### 7.1 Tables (MVP)

`keywords`

- `id` TEXT PRIMARY KEY
- `name` TEXT UNIQUE
- `aliases` TEXT (JSON)
- `tags` TEXT (JSON)
- `status` TEXT (`active`/`archived`)
- `created_at` TEXT (ISO)
- `updated_at` TEXT (ISO)

`mentions`

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
- Indexes:
  - `created_at`
  - `source`
  - (later) full‑text or prefix index via external engine if needed

`daily_aggregates`

- `id` TEXT PRIMARY KEY
- `date` TEXT (YYYY‑MM‑DD)
- `keyword_id` TEXT
- `source` TEXT
- `mentions_count` INTEGER
- Unique index on (`date`, `keyword_id`, `source`)

`source_config` (if needed for UI‑driven config later)

- `id` TEXT PRIMARY KEY
- `type` TEXT (`reddit`, `x`, `feed`)
- `config` TEXT (JSON)
- `enabled` INTEGER

## 8. Ingestion & Processing (Cloudflare Workers + Queues)

### 8.1 Ingestion Workers

Each source has a dedicated Worker script (or shared code with different entrypoints):

- Runs on Cron (e.g., every 5–15 minutes).
- For each run:
  - Fetches new data since last run (using stored checkpoints).
  - Normalizes into a lightweight event:
    - `source`, `source_id`, `title`, `content`, `url`, `author`, `created_at`.
  - Publishes event to a Cloudflare Queue.

### 8.2 Processing Worker

- Subscribed to the Queue.
- For each message:
  - Loads active keywords (could be cached or from KV).
  - Matches keywords/aliases against text.
  - If there is at least one match:
    - Writes a `mentions` row to D1.
- Separate aggregation job:
  - Periodic Worker that:
    - Reads `mentions` in a time range.
    - Updates/inserts into `daily_aggregates`.

## 9. Frontend (SPA) Requirements

### 9.1 Tech Stack

- SPA framework: React (or your preferred).
- Routing: client‑side (e.g., React Router).
- UI Library: optional (e.g., MUI, Tailwind + headless components).
- Build: Vite or similar.

### 9.2 UX / UI

- Responsive layout (desktop‑first, mobile acceptable but not primary).
- Primary views:
  - Overview dashboard.
  - Keyword details.
  - Keyword management.
  - Settings (basic, can be minimal for MVP).

### 9.3 Performance

- API access:
  - Use pagination and limit queries on `/api/mentions`.
  - Cache keyword list client‑side.
- Charts:
  - Pre‑aggregated data (no heavy aggregation on the fly).

## 10. Non‑Functional Requirements

- **Scalability**
  - Able to handle:
    - Dozens of keywords.
    - Thousands of mentions per day.
  - Designed so ingestion can be scaled independently via Queues.

- **Reliability**
  - Idempotent ingestion (avoid duplicate mentions).
  - Graceful handling of rate limits for Reddit/X.
  - Backoff and retry via Queue mechanics.

- **Security**
  - Secrets (API tokens) stored via Cloudflare secrets bindings.
  - No public write endpoints in MVP (only you/admin use them).

- **Observability**
  - Basic logging for ingestion and processing Workers.
  - Simple metrics: number of mentions per run, failures, etc.

## 11. Phased Delivery Plan

### Phase 1 – Skeleton & Core Data Path

- Set up D1 schema.
- Implement ingestion Workers with mocked sources.
- Implement processing Worker and write mentions to D1.
- Implement minimal SPA that:
  - Calls `/api/mentions` and `/api/trends` stubbed responses.

### Phase 2 – Real Sources & Dashboard

- Integrate Reddit and X ingestion Workers for real data.
- Implement aggregation into `daily_aggregates`.
- Build full dashboard views (overview, keyword detail, management).
- Add basic emerging keyword logic.

### Phase 3 – Polish & Extensions

- Add more sources (feeds/HN/PH).
- Add notifications/digests.
- Add multi‑user capabilities and auth if needed.
