# HTTP Trigger for Feed Ingestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add HTTP endpoints to manually trigger feed ingestion for all sources or a specific source by ID.

**Architecture:** Extend ingestion-feeds worker to support both scheduled (cron) and HTTP-triggered execution. Reuse existing ingestion logic from scheduled handler. Add Elysia router with two endpoints: POST /trigger/all and POST /trigger/:id.

**Tech Stack:** ElysiaJS, Cloudflare Workers, Drizzle ORM, Bun Test

---

## Task 1: Add Elysia Dependency and Extract Core Logic

**Files:**
- Modify: `apps/ingestion-feeds/package.json`
- Modify: `apps/ingestion-feeds/src/index.ts`
- Create: `apps/ingestion-feeds/src/handlers/scheduled-handler.ts`
- Create: `apps/ingestion-feeds/src/services/feed-processor.ts`

**Step 1: Add Elysia dependencies**

Update `apps/ingestion-feeds/package.json`:
```json
"dependencies": {
  "@trend-monitor/config": "workspace:*",
  "@trend-monitor/db": "workspace:*",
  "@trend-monitor/types": "workspace:*",
  "@trend-monitor/utils": "workspace:*",
  "rss-parser": "^3.13.0",
  "elysia": "^1.1.31"
}
```

**Step 2: Install dependencies**

Run: `bun install`
Expected: Elysia installed successfully

**Step 3: Create feed processor service**

Create `apps/ingestion-feeds/src/services/feed-processor.ts`:
```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "../lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "./checkpoint-service";
import { IngestionService } from "./ingestion-service";
import type { DrizzleD1Database } from "drizzle-orm/d1";

interface ProcessResult {
	sourceId: string;
	sourceName: string;
	eventsCount: number;
	checkpoint: string | null;
	error?: string;
}

export class FeedProcessor {
	constructor(
		private db: DrizzleD1Database,
		private feedClient: FeedClient,
		private checkpointService: CheckpointService,
		private ingestionService: IngestionService,
		private configRepo: SourceConfigRepository,
	) {}

	async processAllSources(): Promise<{
		events: IngestionEvent[];
		results: ProcessResult[];
	}> {
		const configs = await this.configRepo.listEnabled();

		if (configs.length === 0) {
			return { events: [], results: [] };
		}

		const allEvents: IngestionEvent[] = [];
		const results: ProcessResult[] = [];

		for (const configRow of configs) {
			const result = await this.processSource(configRow.id);
			results.push(result);

			if (!result.error && result.eventsCount > 0) {
				// Re-process to get events (optimization: cache in processSource)
				const feedResult = await this.ingestionService.processFeed(
					configRow.id,
					configRow.config.url,
					this.feedClient,
					this.checkpointService,
					configRow.config.customUserAgent,
				);
				allEvents.push(...feedResult.events);
			}
		}

		return { events: allEvents, results };
	}

	async processSource(sourceId: string): Promise<ProcessResult> {
		const configRow = await this.configRepo.findById(sourceId);

		if (!configRow) {
			return {
				sourceId,
				sourceName: "Unknown",
				eventsCount: 0,
				checkpoint: null,
				error: "Source not found",
			};
		}

		if (!configRow.enabled) {
			return {
				sourceId,
				sourceName: configRow.config.name,
				eventsCount: 0,
				checkpoint: null,
				error: "Source is disabled",
			};
		}

		try {
			const result = await this.ingestionService.processFeed(
				configRow.id,
				configRow.config.url,
				this.feedClient,
				this.checkpointService,
				configRow.config.customUserAgent,
			);

			// Record success
			const now = new Date().toISOString();
			await this.configRepo.recordSuccess(configRow.id, {
				lastFetchAt: now,
				lastSuccessAt: now,
				consecutiveFailures: 0,
				lastErrorAt: null,
				lastErrorMessage: null,
			});

			return {
				sourceId: configRow.id,
				sourceName: configRow.config.name,
				eventsCount: result.events.length,
				checkpoint: result.newCheckpoint?.lastPublishedAt || null,
			};
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";

			// Record failure
			const failures = configRow.consecutiveFailures + 1;
			const now = new Date().toISOString();

			await this.configRepo.recordFailure(configRow.id, {
				lastFetchAt: now,
				lastErrorAt: now,
				lastErrorMessage: errorMessage,
				consecutiveFailures: failures,
			});

			// Auto-disable after 10 consecutive failures
			if (failures >= 10) {
				await this.configRepo.disable(configRow.id);
			}

			return {
				sourceId: configRow.id,
				sourceName: configRow.config.name,
				eventsCount: 0,
				checkpoint: null,
				error: errorMessage,
			};
		}
	}
}
```

**Step 4: Extract scheduled handler**

Create `apps/ingestion-feeds/src/handlers/scheduled-handler.ts`:
```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "../lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "../services/checkpoint-service";
import { IngestionService } from "../services/ingestion-service";
import { FeedProcessor } from "../services/feed-processor";
import { db } from "../lib/db";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export async function handleScheduled(
	_event: ScheduledEvent,
	env: Env,
	_ctx: ExecutionContext,
): Promise<void> {
	console.log("Feed ingestion running at:", new Date().toISOString());

	try {
		// Initialize services
		const feedClient = new FeedClient({
			defaultUserAgent: env.FEED_USER_AGENT,
		});

		const configRepo = new SourceConfigRepository(db);
		const checkpointService = new CheckpointService(env.CHECKPOINT);
		const ingestionService = new IngestionService();
		const processor = new FeedProcessor(
			db,
			feedClient,
			checkpointService,
			ingestionService,
			configRepo,
		);

		// Process all feeds
		const { events, results } = await processor.processAllSources();

		// Log results
		for (const result of results) {
			if (result.error) {
				console.error(`Failed to process ${result.sourceName}:`, result.error);
			} else {
				console.log(
					`Processed ${result.sourceName}: ${result.eventsCount} new posts, checkpoint: ${result.checkpoint || "none"}`,
				);
			}
		}

		// Send events to queue in batch
		if (events.length > 0) {
			await env.INGESTION_QUEUE.sendBatch(events.map((event) => ({ body: event })));
			console.log(`Published ${events.length} events to ingestion queue`);
		} else {
			console.log("No new posts found");
		}
	} catch (err) {
		console.error("Feed ingestion failed:", err);
		throw err;
	}
}
```

**Step 5: Update main index.ts to use extracted handler**

Update `apps/ingestion-feeds/src/index.ts`:
```typescript
import { handleScheduled } from "./handlers/scheduled-handler";

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		return handleScheduled(event, env, ctx);
	},
};
```

**Step 6: Run existing tests to verify refactor**

Run: `bun test`
Expected: All existing tests pass (30 tests)

**Step 7: Commit**

```bash
git add apps/ingestion-feeds/package.json apps/ingestion-feeds/src/
git commit -m "refactor(ingestion-feeds): extract feed processor service and scheduled handler

- Add Elysia dependency for HTTP endpoints
- Create FeedProcessor service to encapsulate ingestion logic
- Extract scheduled handler to separate file
- Prepare for HTTP trigger endpoints"
```

---

## Task 2: Add HTTP Endpoints for Manual Triggering

**Files:**
- Modify: `apps/ingestion-feeds/src/index.ts`
- Create: `apps/ingestion-feeds/src/routes/trigger.ts`
- Modify: `apps/ingestion-feeds/wrangler.toml`

**Step 1: Create trigger routes**

Create `apps/ingestion-feeds/src/routes/trigger.ts`:
```typescript
import { Elysia, t } from "elysia";
import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "../lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "../services/checkpoint-service";
import { IngestionService } from "../services/ingestion-service";
import { FeedProcessor } from "../services/feed-processor";
import { db } from "../lib/db";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export const triggerRoutes = (env: Env) =>
	new Elysia({ prefix: "/trigger" })
		.derive(() => {
			const feedClient = new FeedClient({
				defaultUserAgent: env.FEED_USER_AGENT,
			});
			const configRepo = new SourceConfigRepository(db);
			const checkpointService = new CheckpointService(env.CHECKPOINT);
			const ingestionService = new IngestionService();

			return {
				processor: new FeedProcessor(
					db,
					feedClient,
					checkpointService,
					ingestionService,
					configRepo,
				),
				queue: env.INGESTION_QUEUE,
			};
		})
		.post("/all", async ({ processor, queue }) => {
			const startTime = Date.now();
			const { events, results } = await processor.processAllSources();

			// Send events to queue
			if (events.length > 0) {
				await queue.sendBatch(events.map((event) => ({ body: event })));
			}

			return {
				success: true,
				summary: {
					totalSources: results.length,
					successfulSources: results.filter((r) => !r.error).length,
					failedSources: results.filter((r) => r.error).length,
					totalEvents: events.length,
					durationMs: Date.now() - startTime,
				},
				results: results.map((r) => ({
					sourceId: r.sourceId,
					sourceName: r.sourceName,
					status: r.error ? "failed" : "success",
					eventsCount: r.eventsCount,
					checkpoint: r.checkpoint,
					error: r.error,
				})),
			};
		})
		.post(
			"/:id",
			async ({ processor, queue, params }) => {
				const startTime = Date.now();
				const result = await processor.processSource(params.id);

				// Get events if successful
				let eventsCount = 0;
				if (!result.error && result.eventsCount > 0) {
					const configRepo = new SourceConfigRepository(db);
					const configRow = await configRepo.findById(params.id);

					if (configRow) {
						const feedClient = new FeedClient({
							defaultUserAgent: env.FEED_USER_AGENT,
						});
						const checkpointService = new CheckpointService(env.CHECKPOINT);
						const ingestionService = new IngestionService();

						const feedResult = await ingestionService.processFeed(
							configRow.id,
							configRow.config.url,
							feedClient,
							checkpointService,
							configRow.config.customUserAgent,
						);

						if (feedResult.events.length > 0) {
							await queue.sendBatch(
								feedResult.events.map((event) => ({ body: event })),
							);
							eventsCount = feedResult.events.length;
						}
					}
				}

				if (result.error) {
					return {
						success: false,
						sourceId: result.sourceId,
						sourceName: result.sourceName,
						error: result.error,
						durationMs: Date.now() - startTime,
					};
				}

				return {
					success: true,
					sourceId: result.sourceId,
					sourceName: result.sourceName,
					eventsCount,
					checkpoint: result.checkpoint,
					durationMs: Date.now() - startTime,
				};
			},
			{
				params: t.Object({
					id: t.String(),
				}),
			},
		);
```

**Step 2: Update index.ts to add HTTP handler**

Update `apps/ingestion-feeds/src/index.ts`:
```typescript
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import type { IngestionEvent } from "@trend-monitor/types";
import { handleScheduled } from "./handlers/scheduled-handler";
import { triggerRoutes } from "./routes/trigger";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

const app = new Elysia({ adapter: CloudflareAdapter })
	.get("/health", () => ({ status: "ok" }))
	.compile();

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		return handleScheduled(event, env, ctx);
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const appWithRoutes = new Elysia({ adapter: CloudflareAdapter })
			.get("/health", () => ({ status: "ok" }))
			.use(triggerRoutes(env))
			.compile();

		return appWithRoutes.fetch(request, env, ctx);
	},
};

export type App = typeof app;
```

**Step 3: Update wrangler.toml to remove port (already configured)**

Verify `apps/ingestion-feeds/wrangler.toml` has dev port configured:
```toml
[dev]
port = 8792
inspector_port = 9235
```

**Step 4: Manual test - start dev server**

Run: `bun run dev`
Expected: Server starts on port 8792

**Step 5: Manual test - trigger all sources (in separate terminal)**

Run: `curl -X POST http://localhost:8792/trigger/all`
Expected: JSON response with summary and results array

**Step 6: Manual test - trigger single source (in separate terminal)**

Run: `curl -X POST http://localhost:8792/trigger/test-source-id`
Expected: JSON response for single source or 404-like error in success:false

**Step 7: Stop dev server**

Press Ctrl+C in dev server terminal
Expected: Server stops cleanly

**Step 8: Commit**

```bash
git add apps/ingestion-feeds/src/
git commit -m "feat(ingestion-feeds): add HTTP trigger endpoints

- POST /trigger/all - trigger ingestion for all enabled sources
- POST /trigger/:id - trigger ingestion for specific source by ID
- Returns detailed results including events count and errors
- Reuses existing ingestion logic from scheduled handler"
```

---

## Task 3: Add Integration Tests for HTTP Endpoints

**Files:**
- Create: `apps/ingestion-feeds/src/routes/trigger.test.ts`

**Step 1: Write failing test for trigger all endpoint**

Create `apps/ingestion-feeds/src/routes/trigger.test.ts`:
```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../index";
import { mockIngestionEnv, cleanupMockEnv } from "../test/mock-env";

describe("Trigger Routes", () => {
	let env: ReturnType<typeof mockIngestionEnv>;
	let client: ReturnType<typeof treaty<App>>;

	beforeEach(async () => {
		env = mockIngestionEnv();

		// Mock eden treaty client (simplified for test)
		client = {
			trigger: {
				all: {
					post: async () => ({
						data: undefined,
						error: { status: 404, value: "Not implemented" },
					}),
				},
			},
		} as any;
	});

	test("POST /trigger/all - triggers all enabled sources", async () => {
		// This will fail until we implement proper test setup
		const response = await client.trigger.all.post();

		expect(response.data).toBeDefined();
		expect(response.data?.success).toBe(true);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/routes/trigger.test.ts`
Expected: Test fails with "Not implemented" or similar

**Step 3: Create mock environment helper**

Create `apps/ingestion-feeds/src/test/mock-env.ts`:
```typescript
import type { IngestionEvent } from "@trend-monitor/types";

export function mockIngestionEnv() {
	const queueMessages: IngestionEvent[] = [];

	const mockQueue: Queue<IngestionEvent> = {
		send: async (message: IngestionEvent) => {
			queueMessages.push(message);
		},
		sendBatch: async (messages: { body: IngestionEvent }[]) => {
			queueMessages.push(...messages.map((m) => m.body));
		},
	} as Queue<IngestionEvent>;

	const kvStore = new Map<string, string>();

	const mockKV: KVNamespace = {
		get: async (key: string) => kvStore.get(key) || null,
		put: async (key: string, value: string) => {
			kvStore.set(key, value);
		},
	} as KVNamespace;

	return {
		INGESTION_QUEUE: mockQueue,
		CHECKPOINT: mockKV,
		FEED_USER_AGENT: "test-agent",
		queueMessages, // For assertions
		kvStore, // For assertions
	};
}

export function cleanupMockEnv() {
	// No cleanup needed for in-memory mocks
}
```

**Step 4: Update test with proper setup**

Update `apps/ingestion-feeds/src/routes/trigger.test.ts`:
```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { triggerRoutes } from "./trigger";
import { mockIngestionEnv } from "../test/mock-env";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";

// Mock the database module
mock.module("../lib/db", () => ({
	db: {} as any, // Mocked in test
}));

describe("Trigger Routes", () => {
	let env: ReturnType<typeof mockIngestionEnv>;

	beforeEach(() => {
		env = mockIngestionEnv();
	});

	test("POST /trigger/all - returns success with no sources", async () => {
		// Mock empty source list
		const mockDb = {
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([]),
				}),
			}),
		};

		// Create app with routes
		const app = new Elysia({ adapter: CloudflareAdapter })
			.use(triggerRoutes(env as any))
			.compile();

		// Make request
		const response = await app.handle(
			new Request("http://localhost/trigger/all", { method: "POST" }),
		);

		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.summary.totalSources).toBe(0);
		expect(data.summary.totalEvents).toBe(0);
	});

	test("POST /trigger/:id - returns error for non-existent source", async () => {
		const app = new Elysia({ adapter: CloudflareAdapter })
			.use(triggerRoutes(env as any))
			.compile();

		const response = await app.handle(
			new Request("http://localhost/trigger/non-existent-id", { method: "POST" }),
		);

		const data = await response.json();

		expect(response.status).toBe(200); // Success HTTP but application error
		expect(data.success).toBe(false);
		expect(data.error).toContain("not found");
	});
});
```

**Step 5: Run test to verify it passes**

Run: `bun test src/routes/trigger.test.ts`
Expected: Tests pass

**Step 6: Commit**

```bash
git add apps/ingestion-feeds/src/test/ apps/ingestion-feeds/src/routes/trigger.test.ts
git commit -m "test(ingestion-feeds): add integration tests for trigger endpoints

- Test POST /trigger/all with no sources
- Test POST /trigger/:id with non-existent source
- Create mock environment helper for testing"
```

---

## Task 4: Add Documentation

**Files:**
- Modify: `apps/ingestion-feeds/README.md` (or create if missing)
- Modify: `docs/references/architecture.md`

**Step 1: Create/update README with API documentation**

Create or update `apps/ingestion-feeds/README.md`:
```markdown
# Feed Ingestion Worker

Scheduled worker that fetches RSS/Atom feeds and publishes events to the ingestion queue. Also supports manual triggering via HTTP endpoints.

## Architecture

- **Scheduled Handler**: Cron-triggered every 15 minutes to process all enabled feeds
- **HTTP Endpoints**: Manual triggering for all feeds or specific feed by ID
- **Queue Publishing**: Events sent to ingestion queue for processing by processor-worker

## HTTP Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok"
}
```

### Trigger All Sources

Manually trigger ingestion for all enabled feed sources.

```bash
POST /trigger/all
```

Response:
```json
{
  "success": true,
  "summary": {
    "totalSources": 5,
    "successfulSources": 4,
    "failedSources": 1,
    "totalEvents": 42,
    "durationMs": 3456
  },
  "results": [
    {
      "sourceId": "abc123",
      "sourceName": "Hacker News",
      "status": "success",
      "eventsCount": 15,
      "checkpoint": "2026-01-23T10:30:00Z"
    },
    {
      "sourceId": "def456",
      "sourceName": "Reddit r/programming",
      "status": "failed",
      "eventsCount": 0,
      "error": "Feed fetch timeout"
    }
  ]
}
```

### Trigger Single Source

Manually trigger ingestion for a specific feed source by ID.

```bash
POST /trigger/:id
```

Success Response:
```json
{
  "success": true,
  "sourceId": "abc123",
  "sourceName": "Hacker News",
  "eventsCount": 15,
  "checkpoint": "2026-01-23T10:30:00Z",
  "durationMs": 1234
}
```

Error Response:
```json
{
  "success": false,
  "sourceId": "unknown",
  "sourceName": "Unknown",
  "error": "Source not found",
  "durationMs": 45
}
```

## Development

```bash
# Start dev server (port 8792)
bun run dev

# Run tests
bun test

# Deploy
bun run deploy
```

## Manual Trigger Examples

```bash
# Trigger all enabled sources
curl -X POST http://localhost:8792/trigger/all

# Trigger specific source
curl -X POST http://localhost:8792/trigger/abc123
```
```

**Step 2: Update architecture documentation**

Update `docs/references/architecture.md` section on Feed Ingestion Worker:
```markdown
## Feed Ingestion Worker Structure

The feed ingestion worker (`apps/ingestion-feeds`) fetches RSS/Atom feeds and publishes events to the queue:

```
src/
├── index.ts              # Main entry point (scheduled + HTTP handlers)
├── handlers/
│   └── scheduled-handler.ts    # Cron-triggered handler
├── routes/
│   └── trigger.ts              # HTTP endpoints for manual triggering
├── lib/
│   ├── feed-parser.ts    # RSS/Atom parser using rss-parser
│   ├── feed-client.ts    # Feed fetcher with user agent support
│   └── html-to-text.ts   # HTML to plain text converter
├── services/
│   ├── checkpoint-service.ts        # KV-based checkpoint storage
│   ├── ingestion-service.ts         # Feed processing with checkpointing
│   └── feed-processor.ts            # Core ingestion logic (shared)
└── test/
    ├── mock-env.ts                  # Mock environment for testing
    └── integration.test.ts          # End-to-end integration tests
```

**Key Features:**
- Dual-mode operation: Cron-triggered (every 15 minutes) and HTTP-triggered
- HTTP endpoints: POST /trigger/all and POST /trigger/:id for manual ingestion
- Universal RSS 2.0 and Atom 1.0 feed support using `rss-parser` package
- No authentication required - works with any public feed
- KV-based checkpoints for incremental fetching (tracks last processed post)
- HTML to plain text conversion for feed content
- Per-feed custom User-Agent configuration
- Supports Reddit, X/Twitter (via xcancel.com), Hacker News, blogs, and any RSS/Atom feed
- Comprehensive test coverage (30+ tests, all passing)
```

**Step 3: Commit documentation**

```bash
git add apps/ingestion-feeds/README.md docs/references/architecture.md
git commit -m "docs(ingestion-feeds): document HTTP trigger endpoints

- Add README with API documentation and examples
- Update architecture.md with dual-mode operation details
- Include request/response examples for manual triggering"
```
