# Source Config Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add web UI and API for managing RSS/Atom feed sources with validation, preview, and health monitoring.

**Architecture:** Three-phase implementation: (1) Backend foundation with database schema, repository, and API endpoints, (2) Ingestion worker health tracking, (3) Frontend with TanStack Table/Form.

**Tech Stack:** Drizzle ORM, ElysiaJS, TanStack Query/Router, shadcn/ui components, rss-parser

---

## Phase 1: Database Schema & Types

### Task 1: Update Database Schema

**Files:**
- Modify: `packages/db/src/schema.ts:54-61`
- Create: `packages/db/migrations/0002_add_source_health_tracking.sql`

**Step 1: Add new columns to sourceConfigs table**

In `packages/db/src/schema.ts`, update the `sourceConfigs` table:

```typescript
export const sourceConfigs = sqliteTable("source_configs", {
	id: text("id").primaryKey(),
	type: text("type", { enum: ["feed", "x"] }).notNull(),
	config: text("config", { mode: "json" }).$type<Record<string, any>>().notNull(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

	// New operational tracking fields
	lastFetchAt: text("last_fetch_at"),
	lastSuccessAt: text("last_success_at"),
	lastErrorAt: text("last_error_at"),
	lastErrorMessage: text("last_error_message"),
	consecutiveFailures: integer("consecutive_failures").notNull().default(0),

	// Soft delete support
	deletedAt: text("deleted_at"),

	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});
```

**Step 2: Create migration file**

Create `packages/db/migrations/0002_add_source_health_tracking.sql`:

```sql
-- Add health tracking columns to source_configs
ALTER TABLE source_configs ADD COLUMN last_fetch_at TEXT;
ALTER TABLE source_configs ADD COLUMN last_success_at TEXT;
ALTER TABLE source_configs ADD COLUMN last_error_at TEXT;
ALTER TABLE source_configs ADD COLUMN last_error_message TEXT;
ALTER TABLE source_configs ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_configs ADD COLUMN deleted_at TEXT;
```

**Step 3: Commit schema changes**

```bash
git add packages/db/src/schema.ts packages/db/migrations/0002_add_source_health_tracking.sql
git commit -m "feat(db): add health tracking and soft delete to source_configs schema"
```

---

### Task 2: Update Types Package

**Files:**
- Modify: `packages/types/src/index.ts:56-63`

**Step 1: Update FeedSourceConfig interface**

In `packages/types/src/index.ts`, update the `FeedSourceConfig` interface:

```typescript
// RSS/Atom feed source configuration
export interface FeedSourceConfig {
	url: string; // RSS/Atom feed URL
	name: string; // Display name for the feed
	customUserAgent?: string; // Optional custom User-Agent for specific feeds
	feedTitle?: string; // Feed metadata (from <title>)
	feedDescription?: string; // Feed metadata (from <description>)
}
```

**Step 2: Add new types for health tracking**

Add after `FeedSourceConfig`:

```typescript
// Source config with calculated health status
export interface SourceConfigWithHealth {
	id: string;
	type: "feed" | "x";
	config: FeedSourceConfig;
	enabled: boolean;
	lastFetchAt: string | null;
	lastSuccessAt: string | null;
	lastErrorAt: string | null;
	lastErrorMessage: string | null;
	consecutiveFailures: number;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
	health: "success" | "warning" | "error";
}

// Feed validation result
export interface FeedValidationResult {
	valid: boolean;
	metadata?: {
		title: string;
		description: string;
		format: "rss" | "atom";
		lastUpdated?: string;
	};
	preview?: Array<{
		title: string;
		link: string;
		pubDate?: string;
		content?: string;
	}>;
	error?: string;
}

// Health tracking metrics
export interface SuccessMetrics {
	lastFetchAt: string;
	lastSuccessAt: string;
	consecutiveFailures: 0;
	lastErrorAt: null;
	lastErrorMessage: null;
}

export interface FailureMetrics {
	lastFetchAt: string;
	lastErrorAt: string;
	lastErrorMessage: string;
	consecutiveFailures: number;
}
```

**Step 3: Commit type changes**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add source config health tracking types"
```

---

## Phase 2: Backend - Repository Layer

### Task 3: Extend SourceConfigRepository

**Files:**
- Modify: `packages/db/src/repositories/source-config-repository.ts:1-22`
- Create: `packages/db/src/repositories/source-config-repository.test.ts`

**Step 1: Write tests for new repository methods**

Create `packages/db/src/repositories/source-config-repository.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { createMockDB } from "../mock";
import { SourceConfigRepository } from "./source-config-repository";
import { sourceConfigs } from "../schema";
import { randomUUID } from "node:crypto";

describe("SourceConfigRepository", () => {
	let db: ReturnType<typeof createMockDB>;
	let repo: SourceConfigRepository;

	beforeEach(() => {
		db = createMockDB();
		repo = new SourceConfigRepository(db);
	});

	test("create source with valid config", async () => {
		const input = {
			url: "https://example.com/feed.xml",
			name: "Example Feed",
			type: "feed" as const,
		};

		const result = await repo.create(input);

		expect(result.id).toBeDefined();
		expect(result.config.url).toBe(input.url);
		expect(result.config.name).toBe(input.name);
		expect(result.enabled).toBe(true);
		expect(result.consecutiveFailures).toBe(0);
	});

	test("list sources excludes soft-deleted by default", async () => {
		const source1 = await repo.create({
			url: "https://example.com/1.xml",
			name: "Feed 1",
			type: "feed",
		});

		const source2 = await repo.create({
			url: "https://example.com/2.xml",
			name: "Feed 2",
			type: "feed",
		});

		await repo.softDelete(source2.id);

		const results = await repo.list();
		expect(results.length).toBe(1);
		expect(results[0].id).toBe(source1.id);
	});

	test("list sources includes soft-deleted when requested", async () => {
		const source1 = await repo.create({
			url: "https://example.com/1.xml",
			name: "Feed 1",
			type: "feed",
		});

		await repo.softDelete(source1.id);

		const results = await repo.list(true);
		expect(results.length).toBe(1);
		expect(results[0].deletedAt).toBeDefined();
	});

	test("findById returns source with health status", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		const result = await repo.findById(created.id);

		expect(result).toBeDefined();
		expect(result?.id).toBe(created.id);
	});

	test("update source name without URL change", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Old Name",
			type: "feed",
		});

		const updated = await repo.update(created.id, {
			config: { ...created.config, name: "New Name" },
		});

		expect(updated.config.name).toBe("New Name");
		expect(updated.config.url).toBe(created.config.url);
	});

	test("soft delete sets deletedAt timestamp", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		await repo.softDelete(created.id);

		const result = await repo.findById(created.id);
		expect(result?.deletedAt).toBeDefined();
	});

	test("toggle enabled status", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		expect(created.enabled).toBe(true);

		const toggled = await repo.toggle(created.id);
		expect(toggled.enabled).toBe(false);

		const toggledAgain = await repo.toggle(created.id);
		expect(toggledAgain.enabled).toBe(true);
	});

	test("record success metrics", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		const now = new Date().toISOString();
		await repo.recordSuccess(created.id, {
			lastFetchAt: now,
			lastSuccessAt: now,
			consecutiveFailures: 0,
			lastErrorAt: null,
			lastErrorMessage: null,
		});

		const result = await repo.findById(created.id);
		expect(result?.lastSuccessAt).toBe(now);
		expect(result?.consecutiveFailures).toBe(0);
		expect(result?.lastErrorMessage).toBeNull();
	});

	test("record failure metrics", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		const now = new Date().toISOString();
		await repo.recordFailure(created.id, {
			lastFetchAt: now,
			lastErrorAt: now,
			lastErrorMessage: "Network timeout",
			consecutiveFailures: 1,
		});

		const result = await repo.findById(created.id);
		expect(result?.lastErrorAt).toBe(now);
		expect(result?.lastErrorMessage).toBe("Network timeout");
		expect(result?.consecutiveFailures).toBe(1);
	});

	test("increment consecutive failures on repeated errors", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		for (let i = 1; i <= 3; i++) {
			await repo.recordFailure(created.id, {
				lastFetchAt: new Date().toISOString(),
				lastErrorAt: new Date().toISOString(),
				lastErrorMessage: `Error ${i}`,
				consecutiveFailures: i,
			});
		}

		const result = await repo.findById(created.id);
		expect(result?.consecutiveFailures).toBe(3);
	});

	test("reset failure counter on success after failures", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		// Record failures
		await repo.recordFailure(created.id, {
			lastFetchAt: new Date().toISOString(),
			lastErrorAt: new Date().toISOString(),
			lastErrorMessage: "Error",
			consecutiveFailures: 5,
		});

		// Then success
		const now = new Date().toISOString();
		await repo.recordSuccess(created.id, {
			lastFetchAt: now,
			lastSuccessAt: now,
			consecutiveFailures: 0,
			lastErrorAt: null,
			lastErrorMessage: null,
		});

		const result = await repo.findById(created.id);
		expect(result?.consecutiveFailures).toBe(0);
		expect(result?.lastSuccessAt).toBe(now);
	});

	test("disable source", async () => {
		const created = await repo.create({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		expect(created.enabled).toBe(true);

		await repo.disable(created.id);

		const result = await repo.findById(created.id);
		expect(result?.enabled).toBe(false);
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/db
bun test src/repositories/source-config-repository.test.ts
```

Expected: Multiple test failures due to missing methods

**Step 3: Implement repository methods**

Update `packages/db/src/repositories/source-config-repository.ts`:

```typescript
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { sourceConfigs, type SourceConfig, type InsertSourceConfig, type DbClient } from "../index";
import type { SuccessMetrics, FailureMetrics, SourceConfigWithHealth } from "@trend-monitor/types";

export class SourceConfigRepository {
	constructor(private db: DbClient) {}

	async create(input: {
		url: string;
		name: string;
		type: "feed" | "x";
		customUserAgent?: string;
	}): Promise<SourceConfig> {
		const id = randomUUID();
		const now = new Date().toISOString();

		const newSource: InsertSourceConfig = {
			id,
			type: input.type,
			config: {
				url: input.url,
				name: input.name,
				customUserAgent: input.customUserAgent,
			},
			enabled: true,
			consecutiveFailures: 0,
			createdAt: now,
			updatedAt: now,
		};

		try {
			await this.db.insert(sourceConfigs).values(newSource);
		} catch (err) {
			throw new Error(
				`Failed to create source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}

		return {
			id,
			type: input.type,
			config: newSource.config,
			enabled: true,
			lastFetchAt: null,
			lastSuccessAt: null,
			lastErrorAt: null,
			lastErrorMessage: null,
			consecutiveFailures: 0,
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		};
	}

	async list(includeDeleted = false): Promise<SourceConfig[]> {
		try {
			const conditions = includeDeleted ? [] : [isNull(sourceConfigs.deletedAt)];

			const result = await this.db
				.select()
				.from(sourceConfigs)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			return result;
		} catch (err) {
			throw new Error(
				`Failed to list source configs: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async listEnabled(): Promise<SourceConfig[]> {
		try {
			const result = await this.db
				.select()
				.from(sourceConfigs)
				.where(
					and(
						eq(sourceConfigs.type, "feed"),
						eq(sourceConfigs.enabled, true),
						isNull(sourceConfigs.deletedAt)
					)
				);

			return result;
		} catch (err) {
			throw new Error(
				`Failed to list enabled source configs: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async listWithHealth(): Promise<SourceConfigWithHealth[]> {
		const sources = await this.list();
		return sources.map((source) => ({
			...source,
			health: this.calculateHealth(source),
		}));
	}

	async findById(id: string): Promise<SourceConfig | null> {
		try {
			const result = await this.db
				.select()
				.from(sourceConfigs)
				.where(eq(sourceConfigs.id, id))
				.limit(1);

			return result[0] || null;
		} catch (err) {
			throw new Error(
				`Failed to find source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async update(id: string, data: Partial<InsertSourceConfig>): Promise<SourceConfig> {
		const now = new Date().toISOString();

		try {
			await this.db
				.update(sourceConfigs)
				.set({ ...data, updatedAt: now })
				.where(eq(sourceConfigs.id, id));

			const updated = await this.findById(id);
			if (!updated) {
				throw new Error("Source not found after update");
			}

			return updated;
		} catch (err) {
			throw new Error(
				`Failed to update source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async softDelete(id: string): Promise<void> {
		const now = new Date().toISOString();

		try {
			await this.db
				.update(sourceConfigs)
				.set({ deletedAt: now, updatedAt: now })
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to soft delete source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async toggle(id: string): Promise<SourceConfig> {
		const source = await this.findById(id);
		if (!source) {
			throw new Error("Source not found");
		}

		return this.update(id, { enabled: !source.enabled });
	}

	async recordSuccess(id: string, metrics: SuccessMetrics): Promise<void> {
		try {
			await this.db
				.update(sourceConfigs)
				.set({
					lastFetchAt: metrics.lastFetchAt,
					lastSuccessAt: metrics.lastSuccessAt,
					consecutiveFailures: 0,
					lastErrorAt: null,
					lastErrorMessage: null,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to record success: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async recordFailure(id: string, metrics: FailureMetrics): Promise<void> {
		try {
			await this.db
				.update(sourceConfigs)
				.set({
					lastFetchAt: metrics.lastFetchAt,
					lastErrorAt: metrics.lastErrorAt,
					lastErrorMessage: metrics.lastErrorMessage,
					consecutiveFailures: metrics.consecutiveFailures,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to record failure: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	async disable(id: string): Promise<void> {
		try {
			await this.db
				.update(sourceConfigs)
				.set({ enabled: false, updatedAt: new Date().toISOString() })
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to disable source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	private calculateHealth(source: SourceConfig): "success" | "warning" | "error" {
		if (!source.lastFetchAt) return "warning";
		if (source.consecutiveFailures === 0) return "success";
		if (source.consecutiveFailures < 6) return "warning";
		return "error";
	}
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/db
bun test src/repositories/source-config-repository.test.ts
```

Expected: All tests pass

**Step 5: Export repository from index**

Update `packages/db/src/repositories/index.ts` to export the new repository:

```typescript
export { SourceConfigRepository } from "./source-config-repository";
```

**Step 6: Commit repository implementation**

```bash
git add packages/db/src/repositories/source-config-repository.ts packages/db/src/repositories/source-config-repository.test.ts packages/db/src/repositories/index.ts
git commit -m "feat(db): implement SourceConfigRepository with health tracking"
```

---

## Phase 3: Backend - Feed Validator Service

### Task 4: Create Feed Validator Service

**Files:**
- Create: `apps/api-worker/src/services/feed-validator.ts`
- Create: `apps/api-worker/src/services/feed-validator.test.ts`

**Step 1: Install rss-parser if not present**

```bash
cd apps/api-worker
bun add rss-parser
```

**Step 2: Write tests for feed validator**

Create `apps/api-worker/src/services/feed-validator.test.ts`:

```typescript
import { describe, test, expect, mock } from "bun:test";
import { FeedValidatorService } from "./feed-validator";

describe("FeedValidatorService", () => {
	const validator = new FeedValidatorService();

	test("parse valid RSS 2.0 feed", async () => {
		const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <description>A test RSS feed</description>
    <link>https://example.com</link>
    <item>
      <title>Test Item</title>
      <link>https://example.com/item1</link>
      <description>Item description</description>
      <pubDate>Mon, 20 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

		// Mock fetch
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(rssXml, {
					headers: { "content-type": "application/rss+xml" },
				})
			)
		);

		const result = await validator.validate("https://example.com/feed.xml");

		expect(result.valid).toBe(true);
		expect(result.metadata?.title).toBe("Test Feed");
		expect(result.metadata?.format).toBe("rss");
		expect(result.preview).toBeDefined();
		expect(result.preview?.length).toBe(1);
		expect(result.preview?.[0].title).toBe("Test Item");
	});

	test("parse valid Atom 1.0 feed", async () => {
		const atomXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <subtitle>A test Atom feed</subtitle>
  <link href="https://example.com"/>
  <entry>
    <title>Test Entry</title>
    <link href="https://example.com/entry1"/>
    <summary>Entry summary</summary>
    <updated>2026-01-20T12:00:00Z</updated>
  </entry>
</feed>`;

		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(atomXml, {
					headers: { "content-type": "application/atom+xml" },
				})
			)
		);

		const result = await validator.validate("https://example.com/feed.atom");

		expect(result.valid).toBe(true);
		expect(result.metadata?.title).toBe("Test Atom Feed");
		expect(result.metadata?.format).toBe("atom");
		expect(result.preview).toBeDefined();
	});

	test("reject invalid XML", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(new Response("not xml at all"))
		);

		const result = await validator.validate("https://example.com/invalid");

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	test("reject non-feed content (HTML)", async () => {
		const html = "<!DOCTYPE html><html><body>Not a feed</body></html>";

		globalThis.fetch = mock(() => Promise.resolve(new Response(html)));

		const result = await validator.validate("https://example.com/page.html");

		expect(result.valid).toBe(false);
		expect(result.error).toContain("feed");
	});

	test("handle network timeout", async () => {
		globalThis.fetch = mock(() =>
			Promise.reject(new Error("Network timeout"))
		);

		const result = await validator.validate("https://example.com/feed");

		expect(result.valid).toBe(false);
		expect(result.error).toContain("timeout");
	});

	test("return limited preview items (max 10)", async () => {
		const items = Array.from({ length: 15 }, (_, i) => `
    <item>
      <title>Item ${i + 1}</title>
      <link>https://example.com/item${i + 1}</link>
      <description>Description ${i + 1}</description>
    </item>`).join("");

		const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Many Items Feed</title>
    ${items}
  </channel>
</rss>`;

		globalThis.fetch = mock(() =>
			Promise.resolve(new Response(rssXml))
		);

		const result = await validator.validate("https://example.com/feed");

		expect(result.valid).toBe(true);
		expect(result.preview?.length).toBe(10);
	});

	test("respect custom user agent", async () => {
		let capturedHeaders: Headers | undefined;

		globalThis.fetch = mock((url, options) => {
			capturedHeaders = options?.headers as Headers;
			return Promise.resolve(
				new Response(`<?xml version="1.0"?><rss><channel></channel></rss>`)
			);
		});

		await validator.validate(
			"https://example.com/feed",
			"CustomBot/1.0"
		);

		expect(capturedHeaders?.get("user-agent")).toBe("CustomBot/1.0");
	});
});
```

**Step 3: Run test to verify it fails**

```bash
cd apps/api-worker
bun test src/services/feed-validator.test.ts
```

Expected: Test failures due to missing service

**Step 4: Implement feed validator service**

Create `apps/api-worker/src/services/feed-validator.ts`:

```typescript
import Parser from "rss-parser";
import type { FeedValidationResult } from "@trend-monitor/types";

export class FeedValidatorService {
	private parser: Parser;
	private readonly DEFAULT_USER_AGENT =
		"Mozilla/5.0 (compatible; TrendMonitor/1.0; +https://example.com)";
	private readonly TIMEOUT_MS = 10000;

	constructor() {
		this.parser = new Parser({
			timeout: this.TIMEOUT_MS,
		});
	}

	async validate(
		url: string,
		customUserAgent?: string
	): Promise<FeedValidationResult> {
		try {
			// Fetch feed with timeout
			const xml = await this.fetchFeed(url, customUserAgent);

			// Parse feed
			const feed = await this.parseFeed(xml);

			// Extract metadata
			const metadata = {
				title: feed.title || "Untitled Feed",
				description: feed.description || "",
				format: this.detectFormat(xml),
				lastUpdated: feed.lastBuildDate,
			};

			// Extract preview items (limit to 10)
			const preview = this.extractPreview(feed.items || [], 10);

			return {
				valid: true,
				metadata,
				preview,
			};
		} catch (err) {
			return {
				valid: false,
				error: this.categorizeError(err),
			};
		}
	}

	private async fetchFeed(
		url: string,
		userAgent?: string
	): Promise<string> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				headers: {
					"User-Agent": userAgent || this.DEFAULT_USER_AGENT,
				},
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const text = await response.text();
			return text;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private async parseFeed(xml: string): Promise<Parser.Output<any>> {
		try {
			const feed = await this.parser.parseString(xml);

			// Validate it's actually a feed
			if (!feed.title && !feed.items) {
				throw new Error("Not a valid RSS/Atom feed");
			}

			return feed;
		} catch (err) {
			throw new Error(`Failed to parse feed: ${err instanceof Error ? err.message : "Unknown error"}`);
		}
	}

	private detectFormat(xml: string): "rss" | "atom" {
		// Simple detection based on root element
		if (xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")) {
			return "atom";
		}
		return "rss";
	}

	private extractPreview(
		items: Array<any>,
		limit: number
	): Array<{
		title: string;
		link: string;
		pubDate?: string;
		content?: string;
	}> {
		return items.slice(0, limit).map((item) => ({
			title: item.title || "Untitled",
			link: item.link || "",
			pubDate: item.pubDate || item.isoDate,
			content: item.contentSnippet || item.content?.substring(0, 200),
		}));
	}

	private categorizeError(err: unknown): string {
		if (err instanceof Error) {
			const message = err.message.toLowerCase();

			// Network errors
			if (message.includes("timeout") || message.includes("aborted")) {
				return "Network timeout - feed took too long to respond";
			}
			if (message.includes("dns") || message.includes("enotfound")) {
				return "DNS failure - unable to resolve hostname";
			}
			if (message.includes("refused")) {
				return "Connection refused - server not accepting connections";
			}

			// HTTP errors
			if (message.includes("http 404")) {
				return "Feed not found (HTTP 404)";
			}
			if (message.includes("http 403")) {
				return "Access forbidden (HTTP 403)";
			}
			if (message.includes("http 5")) {
				return "Server error - feed temporarily unavailable";
			}

			// Parse errors
			if (message.includes("parse") || message.includes("xml")) {
				return "Invalid feed format - not valid RSS/Atom XML";
			}
			if (message.includes("not a valid")) {
				return "Not a valid RSS/Atom feed";
			}

			return `Error: ${err.message}`;
		}

		return "Unknown error occurred while validating feed";
	}
}
```

**Step 5: Run tests to verify they pass**

```bash
cd apps/api-worker
bun test src/services/feed-validator.test.ts
```

Expected: All tests pass

**Step 6: Commit feed validator**

```bash
git add apps/api-worker/src/services/feed-validator.ts apps/api-worker/src/services/feed-validator.test.ts apps/api-worker/package.json
git commit -m "feat(api): implement feed validator service with preview"
```

---

## Phase 4: Backend - API Endpoints

### Task 5: Create Sources API Module

**Files:**
- Create: `apps/api-worker/src/modules/sources/index.ts`
- Create: `apps/api-worker/src/modules/sources/index.test.ts`
- Modify: `apps/api-worker/src/index.ts:12-17`

**Step 1: Write API endpoint tests**

Create `apps/api-worker/src/modules/sources/index.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../../index";
import app from "../../index";

const client = treaty<App>("localhost:8787");

describe("Sources API", () => {
	test("GET /api/sources returns list", async () => {
		const response = await client.api.sources.get();

		expect(response.status).toBe(200);
		expect(response.data).toBeDefined();
		expect(response.data?.sources).toBeInstanceOf(Array);
	});

	test("POST /api/sources/validate with valid RSS feed", async () => {
		// Mock a valid RSS feed response
		globalThis.fetch = async () =>
			new Response(
				`<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>`
			);

		const response = await client.api.sources.validate.post({
			url: "https://example.com/feed.xml",
		});

		expect(response.status).toBe(200);
		expect(response.data?.valid).toBe(true);
		expect(response.data?.metadata).toBeDefined();
	});

	test("POST /api/sources/validate with invalid URL", async () => {
		globalThis.fetch = async () => {
			throw new Error("Network error");
		};

		const response = await client.api.sources.validate.post({
			url: "https://invalid.com/feed",
		});

		expect(response.status).toBe(200);
		expect(response.data?.valid).toBe(false);
		expect(response.data?.error).toBeDefined();
	});

	test("POST /api/sources creates new source", async () => {
		const response = await client.api.sources.post({
			url: "https://example.com/feed.xml",
			name: "Example Feed",
			type: "feed",
		});

		expect(response.status).toBe(201);
		expect(response.data?.source).toBeDefined();
		expect(response.data?.source.config.name).toBe("Example Feed");
	});

	test("GET /api/sources/:id returns single source", async () => {
		// Create a source first
		const created = await client.api.sources.post({
			url: "https://example.com/feed.xml",
			name: "Test Feed",
			type: "feed",
		});

		const sourceId = created.data?.source.id;

		const response = await client.api.sources({ id: sourceId! }).get();

		expect(response.status).toBe(200);
		expect(response.data?.source.id).toBe(sourceId);
	});

	test("PUT /api/sources/:id updates source", async () => {
		// Create a source first
		const created = await client.api.sources.post({
			url: "https://example.com/feed.xml",
			name: "Old Name",
			type: "feed",
		});

		const sourceId = created.data?.source.id;

		const response = await client.api.sources({ id: sourceId! }).put({
			name: "New Name",
		});

		expect(response.status).toBe(200);
		expect(response.data?.source.config.name).toBe("New Name");
	});

	test("DELETE /api/sources/:id soft deletes", async () => {
		// Create a source first
		const created = await client.api.sources.post({
			url: "https://example.com/feed.xml",
			name: "To Delete",
			type: "feed",
		});

		const sourceId = created.data?.source.id;

		const response = await client.api.sources({ id: sourceId! }).delete();

		expect(response.status).toBe(200);
		expect(response.data?.success).toBe(true);

		// Verify it's soft deleted
		const getResponse = await client.api.sources({ id: sourceId! }).get();
		expect(getResponse.data?.source.deletedAt).toBeDefined();
	});

	test("PATCH /api/sources/:id/toggle enables/disables", async () => {
		// Create a source first
		const created = await client.api.sources.post({
			url: "https://example.com/feed.xml",
			name: "Toggle Test",
			type: "feed",
		});

		const sourceId = created.data?.source.id;

		// Toggle to disabled
		const response1 = await client.api.sources({ id: sourceId! }).toggle.patch();
		expect(response1.status).toBe(200);
		expect(response1.data?.source.enabled).toBe(false);

		// Toggle back to enabled
		const response2 = await client.api.sources({ id: sourceId! }).toggle.patch();
		expect(response2.status).toBe(200);
		expect(response2.data?.source.enabled).toBe(true);
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api-worker
bun test src/modules/sources/index.test.ts
```

Expected: Test failures due to missing routes

**Step 3: Implement sources API routes**

Create `apps/api-worker/src/modules/sources/index.ts`:

```typescript
import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { FeedValidatorService } from "../../services/feed-validator";

export const sourcesRoutes = new Elysia({ prefix: "/sources" })
	.derive(() => ({
		sourceRepo: new SourceConfigRepository(db),
		validator: new FeedValidatorService(),
	}))

	// GET /api/sources - List all sources
	.get(
		"/",
		async ({ sourceRepo, query }) => {
			const sources = await sourceRepo.listWithHealth();
			return { sources };
		},
		{
			query: t.Object({
				includeDeleted: t.Optional(t.Boolean({ default: false })),
			}),
		}
	)

	// POST /api/sources/validate - Validate feed without saving
	.post(
		"/validate",
		async ({ validator, body }) => {
			const result = await validator.validate(body.url, body.customUserAgent);
			return result;
		},
		{
			body: t.Object({
				url: t.String(),
				customUserAgent: t.Optional(t.String()),
			}),
		}
	)

	// POST /api/sources - Create new source
	.post(
		"/",
		async ({ sourceRepo, body }) => {
			const source = await sourceRepo.create(body);
			return { source };
		},
		{
			body: t.Object({
				url: t.String(),
				name: t.String(),
				type: t.Union([t.Literal("feed"), t.Literal("x")]),
				customUserAgent: t.Optional(t.String()),
			}),
			response: {
				201: t.Object({
					source: t.Any(),
				}),
			},
		}
	)

	// GET /api/sources/:id - Get single source
	.get(
		"/:id",
		async ({ sourceRepo, params }) => {
			const source = await sourceRepo.findById(params.id);
			if (!source) {
				throw new Error("Source not found");
			}
			return { source };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	)

	// PUT /api/sources/:id - Update source
	.put(
		"/:id",
		async ({ sourceRepo, params, body }) => {
			const existing = await sourceRepo.findById(params.id);
			if (!existing) {
				throw new Error("Source not found");
			}

			// Merge updates into config
			const updatedConfig = {
				...existing.config,
				...body,
			};

			const source = await sourceRepo.update(params.id, {
				config: updatedConfig,
				enabled: body.enabled,
			});

			return { source };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
			body: t.Object({
				url: t.Optional(t.String()),
				name: t.Optional(t.String()),
				customUserAgent: t.Optional(t.String()),
				enabled: t.Optional(t.Boolean()),
			}),
		}
	)

	// DELETE /api/sources/:id - Soft delete source
	.delete(
		"/:id",
		async ({ sourceRepo, params }) => {
			await sourceRepo.softDelete(params.id);
			return { success: true };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	)

	// PATCH /api/sources/:id/toggle - Toggle enabled status
	.patch(
		"/:id/toggle",
		async ({ sourceRepo, params }) => {
			const source = await sourceRepo.toggle(params.id);
			return { source };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	);
```

**Step 4: Register sources routes in main app**

Update `apps/api-worker/src/index.ts`:

```typescript
import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { keywordsRoutes } from "./modules/keywords";
import { mentionsRoutes } from "./modules/mentions";
import { trendsRoutes } from "./modules/trends";
import { sourcesRoutes } from "./modules/sources";

const app = new Elysia({ adapter: CloudflareAdapter })
	.use(cors())
	.use(openapi())
	.group("/api", (app) =>
		app
			.get("/health", () => ({ status: "ok" }))
			.use(keywordsRoutes)
			.use(mentionsRoutes)
			.use(trendsRoutes)
			.use(sourcesRoutes),
	)
	.compile();

export default app;
export type App = typeof app;
```

**Step 5: Run tests to verify they pass**

```bash
cd apps/api-worker
bun test src/modules/sources/index.test.ts
```

Expected: All tests pass

**Step 6: Commit sources API**

```bash
git add apps/api-worker/src/modules/sources/ apps/api-worker/src/index.ts
git commit -m "feat(api): implement sources API endpoints with validation"
```

---

## Phase 5: Ingestion Worker Health Tracking

### Task 6: Update Ingestion Worker

**Files:**
- Modify: `apps/ingestion-feeds/src/index.ts:1-76`
- Modify: `apps/ingestion-feeds/src/index.test.ts` (add new tests)

**Step 1: Write tests for health tracking**

Add to `apps/ingestion-feeds/src/index.test.ts`:

```typescript
describe("Ingestion with health tracking", () => {
	test("record success metrics after successful fetch", async () => {
		// Test implementation
		// Verify lastSuccessAt is updated
		// Verify consecutiveFailures is reset to 0
	});

	test("record failure metrics after failed fetch", async () => {
		// Test implementation
		// Verify lastErrorAt is updated
		// Verify consecutiveFailures is incremented
	});

	test("auto-disable source after 10 consecutive failures", async () => {
		// Test implementation
		// Simulate 10 failures
		// Verify source is disabled
	});

	test("reset failure counter on success after failures", async () => {
		// Test implementation
		// Record failures, then success
		// Verify counter resets
	});
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: New tests fail

**Step 3: Update ingestion worker to track health**

Modify `apps/ingestion-feeds/src/index.ts`:

```typescript
import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "./lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "./services/checkpoint-service";
import { IngestionService } from "./services/ingestion-service";
import { db } from "./lib/db";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export default {
	async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Feed ingestion running at:", new Date().toISOString());

		try {
			// Initialize services
			const feedClient = new FeedClient({
				defaultUserAgent: env.FEED_USER_AGENT,
			});

			const configRepo = new SourceConfigRepository(db);
			const checkpointService = new CheckpointService(env.CHECKPOINT);
			const ingestionService = new IngestionService();

			// Load active source configurations
			const configs = await configRepo.listEnabled();

			if (configs.length === 0) {
				console.log("No active feed source configurations found");
				return;
			}

			console.log(`Processing ${configs.length} feed(s)`);

			// Process each feed and collect events
			const allEvents: IngestionEvent[] = [];

			for (const configRow of configs) {
				try {
					const result = await ingestionService.processFeed(
						configRow.id,
						configRow.config.url,
						feedClient,
						checkpointService,
						configRow.config.customUserAgent,
					);

					// Record success
					const now = new Date().toISOString();
					await configRepo.recordSuccess(configRow.id, {
						lastFetchAt: now,
						lastSuccessAt: now,
						consecutiveFailures: 0,
						lastErrorAt: null,
						lastErrorMessage: null,
					});

					allEvents.push(...result.events);

					console.log(
						`Processed ${configRow.config.name}: ${result.events.length} new posts, checkpoint: ${result.newCheckpoint?.lastPublishedAt || "none"}`,
					);
				} catch (err) {
					// Record failure
					const failures = configRow.consecutiveFailures + 1;
					const now = new Date().toISOString();

					await configRepo.recordFailure(configRow.id, {
						lastFetchAt: now,
						lastErrorAt: now,
						lastErrorMessage: err instanceof Error ? err.message : "Unknown error",
						consecutiveFailures: failures,
					});

					// Auto-disable after 10 consecutive failures
					if (failures >= 10) {
						await configRepo.disable(configRow.id);
						console.warn(
							`Auto-disabled source ${configRow.config.name} after 10 consecutive failures`,
						);
					}

					// Continue with other feeds
					console.error(`Failed to process feed ${configRow.config.name}:`, err);
				}
			}

			// Send events to queue in batch
			if (allEvents.length > 0) {
				await env.INGESTION_QUEUE.sendBatch(allEvents.map((event) => ({ body: event })));
				console.log(`Published ${allEvents.length} events to ingestion queue`);
			} else {
				console.log("No new posts found");
			}
		} catch (err) {
			console.error("Feed ingestion failed:", err);
			throw err;
		}
	},
};
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/ingestion-feeds
bun test
```

Expected: All tests pass

**Step 5: Commit ingestion worker updates**

```bash
git add apps/ingestion-feeds/src/index.ts apps/ingestion-feeds/src/index.test.ts
git commit -m "feat(ingestion): add health tracking and auto-disable logic"
```

---

## Phase 6: Frontend - Install Dependencies

### Task 7: Install Dependencies and shadcn Components

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install TanStack Table and Form**

```bash
cd apps/web
bun add @tanstack/react-table @tanstack/react-form
```

**Step 2: Add required shadcn components**

```bash
cd apps/web
npx shadcn@latest add switch
npx shadcn@latest add sheet
npx shadcn@latest add alert-dialog
```

**Step 3: Commit dependency updates**

```bash
git add apps/web/package.json apps/web/bun.lockb apps/web/src/components/ui/
git commit -m "feat(web): add TanStack Table, Form, and shadcn UI components"
```

---

## Phase 7: Frontend - Components

### Task 8: Create Health Badge Component

**Files:**
- Create: `apps/web/src/components/sources/HealthBadge.tsx`

**Step 1: Implement HealthBadge component**

Create `apps/web/src/components/sources/HealthBadge.tsx`:

```typescript
import { Badge } from "../ui/badge";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

interface HealthBadgeProps {
	source: SourceConfigWithHealth;
}

export function HealthBadge({ source }: HealthBadgeProps) {
	const getHealthColor = () => {
		switch (source.health) {
			case "success":
				return "bg-green-500 hover:bg-green-600";
			case "warning":
				return "bg-yellow-500 hover:bg-yellow-600";
			case "error":
				return "bg-red-500 hover:bg-red-600";
		}
	};

	const getHealthLabel = () => {
		switch (source.health) {
			case "success":
				return "Healthy";
			case "warning":
				return "Warning";
			case "error":
				return "Error";
		}
	};

	const getTooltipText = () => {
		if (!source.lastFetchAt) {
			return "Never fetched";
		}

		const parts = [];
		if (source.lastSuccessAt) {
			parts.push(`Last success: ${new Date(source.lastSuccessAt).toLocaleString()}`);
		}
		if (source.consecutiveFailures > 0) {
			parts.push(`${source.consecutiveFailures} consecutive failures`);
		}
		if (source.lastErrorMessage) {
			parts.push(`Last error: ${source.lastErrorMessage}`);
		}

		return parts.join(" • ");
	};

	return (
		<Badge className={getHealthColor()} title={getTooltipText()}>
			{getHealthLabel()}
		</Badge>
	);
}
```

**Step 2: Commit health badge component**

```bash
git add apps/web/src/components/sources/HealthBadge.tsx
git commit -m "feat(web): add HealthBadge component for source health status"
```

---

### Task 9: Create Status Toggle Component

**Files:**
- Create: `apps/web/src/components/sources/StatusToggle.tsx`

**Step 1: Implement StatusToggle component**

Create `apps/web/src/components/sources/StatusToggle.tsx`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "../ui/switch";
import { api } from "../../lib/api";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

interface StatusToggleProps {
	source: SourceConfigWithHealth;
}

export function StatusToggle({ source }: StatusToggleProps) {
	const queryClient = useQueryClient();

	const toggleMutation = useMutation({
		mutationFn: async (id: string) => {
			const response = await api.sources[id].toggle.patch();
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});

	return (
		<Switch
			checked={source.enabled}
			onCheckedChange={() => toggleMutation.mutate(source.id)}
			disabled={toggleMutation.isPending}
		/>
	);
}
```

**Step 2: Commit status toggle component**

```bash
git add apps/web/src/components/sources/StatusToggle.tsx
git commit -m "feat(web): add StatusToggle component for enabling/disabling sources"
```

---

### Task 10: Create Action Buttons Component

**Files:**
- Create: `apps/web/src/components/sources/ActionButtons.tsx`

**Step 1: Implement ActionButtons component**

Create `apps/web/src/components/sources/ActionButtons.tsx`:

```typescript
import { Button } from "../ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

interface ActionButtonsProps {
	source: SourceConfigWithHealth;
	onEdit: (source: SourceConfigWithHealth) => void;
	onDelete: (source: SourceConfigWithHealth) => void;
}

export function ActionButtons({ source, onEdit, onDelete }: ActionButtonsProps) {
	return (
		<div className="flex gap-2">
			<Button
				variant="ghost"
				size="sm"
				onClick={() => onEdit(source)}
				title="Edit source"
			>
				<Pencil className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => onDelete(source)}
				title="Delete source"
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}
```

**Step 2: Commit action buttons component**

```bash
git add apps/web/src/components/sources/ActionButtons.tsx
git commit -m "feat(web): add ActionButtons component for edit/delete actions"
```

---

### Task 11: Create Feed Preview Component

**Files:**
- Create: `apps/web/src/components/sources/FeedPreview.tsx`

**Step 1: Implement FeedPreview component**

Create `apps/web/src/components/sources/FeedPreview.tsx`:

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { FeedValidationResult } from "@trend-monitor/types";

interface FeedPreviewProps {
	validation: FeedValidationResult;
}

export function FeedPreview({ validation }: FeedPreviewProps) {
	if (!validation.valid || !validation.metadata) {
		return null;
	}

	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle>Feed Preview</CardTitle>
				<CardDescription>
					{validation.metadata.title} • {validation.metadata.format.toUpperCase()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{validation.metadata.description && (
					<p className="text-sm text-muted-foreground mb-4">
						{validation.metadata.description}
					</p>
				)}

				{validation.preview && validation.preview.length > 0 && (
					<div>
						<h4 className="font-medium mb-2">Recent Items:</h4>
						<ul className="space-y-2">
							{validation.preview.map((item, idx) => (
								<li key={idx} className="border-l-2 border-primary pl-3">
									<a
										href={item.link}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium hover:underline"
									>
										{item.title}
									</a>
									{item.pubDate && (
										<p className="text-xs text-muted-foreground">
											{new Date(item.pubDate).toLocaleString()}
										</p>
									)}
									{item.content && (
										<p className="text-sm text-muted-foreground mt-1">
											{item.content}
										</p>
									)}
								</li>
							))}
						</ul>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
```

**Step 2: Commit feed preview component**

```bash
git add apps/web/src/components/sources/FeedPreview.tsx
git commit -m "feat(web): add FeedPreview component for displaying feed metadata"
```

---

## Phase 8: Frontend - Forms and Table

### Task 12: Create SourcesTable Component

**Files:**
- Create: `apps/web/src/components/sources/SourcesTable.tsx`

**Step 1: Implement SourcesTable with TanStack Table**

Create `apps/web/src/components/sources/SourcesTable.tsx`:

```typescript
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	type ColumnDef,
	flexRender,
} from "@tanstack/react-table";
import { useState } from "react";
import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { HealthBadge } from "./HealthBadge";
import { StatusToggle } from "./StatusToggle";
import { ActionButtons } from "./ActionButtons";

interface SourcesTableProps {
	sources: SourceConfigWithHealth[];
	onAddSource: () => void;
	onEditSource: (source: SourceConfigWithHealth) => void;
	onDeleteSource: (source: SourceConfigWithHealth) => void;
}

export function SourcesTable({
	sources,
	onAddSource,
	onEditSource,
	onDeleteSource,
}: SourcesTableProps) {
	const [globalFilter, setGlobalFilter] = useState("");

	const columns: ColumnDef<SourceConfigWithHealth>[] = [
		{
			accessorKey: "config.name",
			header: "Name",
			enableSorting: true,
			cell: ({ row }) => (
				<div className="font-medium">{row.original.config.name}</div>
			),
		},
		{
			accessorKey: "config.url",
			header: "Feed URL",
			cell: ({ row }) => (
				<a
					href={row.original.config.url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline text-sm truncate block max-w-md"
				>
					{row.original.config.url}
				</a>
			),
		},
		{
			accessorKey: "type",
			header: "Type",
			cell: ({ row }) => (
				<span className="text-sm capitalize">{row.original.type}</span>
			),
		},
		{
			id: "enabled",
			header: "Status",
			cell: ({ row }) => <StatusToggle source={row.original} />,
		},
		{
			id: "health",
			header: "Health",
			cell: ({ row }) => <HealthBadge source={row.original} />,
		},
		{
			accessorKey: "lastFetchAt",
			header: "Last Fetch",
			enableSorting: true,
			cell: ({ row }) => {
				if (!row.original.lastFetchAt) {
					return <span className="text-sm text-gray-400">Never</span>;
				}
				const date = new Date(row.original.lastFetchAt);
				const now = new Date();
				const diffMs = now.getTime() - date.getTime();
				const diffMins = Math.floor(diffMs / 60000);
				const diffHours = Math.floor(diffMins / 60);
				const diffDays = Math.floor(diffHours / 24);

				let timeAgo = "";
				if (diffDays > 0) timeAgo = `${diffDays}d ago`;
				else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
				else if (diffMins > 0) timeAgo = `${diffMins}m ago`;
				else timeAgo = "Just now";

				return (
					<span className="text-sm" title={date.toLocaleString()}>
						{timeAgo}
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<ActionButtons
					source={row.original}
					onEdit={onEditSource}
					onDelete={onDeleteSource}
				/>
			),
		},
	];

	const table = useReactTable({
		data: sources,
		columns,
		state: {
			globalFilter,
		},
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<Input
					placeholder="Search sources..."
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="max-w-sm"
				/>
				<Button onClick={onAddSource}>Add Source</Button>
			</div>

			<div className="border rounded-lg">
				<table className="w-full">
					<thead className="bg-gray-50 border-b">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext()
											  )}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody className="bg-white divide-y divide-gray-200">
						{table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="hover:bg-gray-50">
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-4 py-4 whitespace-nowrap">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
```

**Step 2: Commit SourcesTable component**

```bash
git add apps/web/src/components/sources/SourcesTable.tsx
git commit -m "feat(web): add SourcesTable with TanStack Table and filtering"
```

---

### Task 13: Create AddSourceForm Component

**Files:**
- Create: `apps/web/src/components/sources/AddSourceForm.tsx`

**Step 1: Implement AddSourceForm with TanStack Form**

Create `apps/web/src/components/sources/AddSourceForm.tsx`:

```typescript
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { api } from "../../lib/api";
import { FeedPreview } from "./FeedPreview";
import type { FeedValidationResult } from "@trend-monitor/types";

interface AddSourceFormProps {
	onSuccess: () => void;
	onCancel: () => void;
}

export function AddSourceForm({ onSuccess, onCancel }: AddSourceFormProps) {
	const queryClient = useQueryClient();
	const [validation, setValidation] = useState<FeedValidationResult | null>(null);
	const [isValidating, setIsValidating] = useState(false);

	const validateMutation = useMutation({
		mutationFn: async (data: { url: string; customUserAgent?: string }) => {
			const response = await api.sources.validate.post(data);
			return response.data;
		},
		onSuccess: (data) => {
			setValidation(data);
		},
	});

	const createMutation = useMutation({
		mutationFn: async (data: {
			url: string;
			name: string;
			type: "feed";
			customUserAgent?: string;
		}) => {
			const response = await api.sources.post(data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			onSuccess();
		},
	});

	const form = useForm({
		defaultValues: {
			url: "",
			name: "",
			customUserAgent: "",
		},
		onSubmit: async ({ value }) => {
			await createMutation.mutateAsync({
				...value,
				type: "feed",
			});
		},
	});

	const handleValidate = async () => {
		const url = form.getFieldValue("url");
		const customUserAgent = form.getFieldValue("customUserAgent");

		if (!url) return;

		setIsValidating(true);
		try {
			await validateMutation.mutateAsync({ url, customUserAgent });
		} finally {
			setIsValidating(false);
		}
	};

	// Pre-fill name from feed metadata
	if (validation?.valid && validation.metadata && !form.getFieldValue("name")) {
		form.setFieldValue("name", validation.metadata.title);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<div>
				<Label htmlFor="url">Feed URL</Label>
				<form.Field name="url">
					{(field) => (
						<div className="flex gap-2 mt-1">
							<Input
								id="url"
								type="url"
								placeholder="https://example.com/feed.xml"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								required
							/>
							<Button
								type="button"
								onClick={handleValidate}
								disabled={!field.state.value || isValidating}
								variant="outline"
							>
								{isValidating ? "Validating..." : "Validate"}
							</Button>
						</div>
					)}
				</form.Field>
				{validation && !validation.valid && (
					<p className="text-sm text-red-600 mt-1">{validation.error}</p>
				)}
			</div>

			{validation?.valid && <FeedPreview validation={validation} />}

			<div>
				<Label htmlFor="name">Name</Label>
				<form.Field name="name">
					{(field) => (
						<Input
							id="name"
							type="text"
							placeholder="My Feed"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							required
							className="mt-1"
						/>
					)}
				</form.Field>
			</div>

			<div>
				<Label htmlFor="customUserAgent">Custom User Agent (optional)</Label>
				<form.Field name="customUserAgent">
					{(field) => (
						<Input
							id="customUserAgent"
							type="text"
							placeholder="MyBot/1.0"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							className="mt-1"
						/>
					)}
				</form.Field>
			</div>

			<div className="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={!validation?.valid || createMutation.isPending}
				>
					{createMutation.isPending ? "Adding..." : "Add Source"}
				</Button>
			</div>
		</form>
	);
}
```

**Step 2: Commit AddSourceForm component**

```bash
git add apps/web/src/components/sources/AddSourceForm.tsx
git commit -m "feat(web): add AddSourceForm with validation and preview"
```

---

### Task 14: Create EditSourceForm Component

**Files:**
- Create: `apps/web/src/components/sources/EditSourceForm.tsx`

**Step 1: Implement EditSourceForm with TanStack Form**

Create `apps/web/src/components/sources/EditSourceForm.tsx`:

```typescript
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { api } from "../../lib/api";
import { FeedPreview } from "./FeedPreview";
import type { SourceConfigWithHealth, FeedValidationResult } from "@trend-monitor/types";

interface EditSourceFormProps {
	source: SourceConfigWithHealth;
	onSuccess: () => void;
	onCancel: () => void;
}

export function EditSourceForm({ source, onSuccess, onCancel }: EditSourceFormProps) {
	const queryClient = useQueryClient();
	const [validation, setValidation] = useState<FeedValidationResult | null>(null);
	const [isValidating, setIsValidating] = useState(false);
	const [urlChanged, setUrlChanged] = useState(false);

	const validateMutation = useMutation({
		mutationFn: async (data: { url: string; customUserAgent?: string }) => {
			const response = await api.sources.validate.post(data);
			return response.data;
		},
		onSuccess: (data) => {
			setValidation(data);
			setUrlChanged(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (data: {
			url?: string;
			name?: string;
			customUserAgent?: string;
		}) => {
			const response = await api.sources({ id: source.id }).put(data);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			onSuccess();
		},
	});

	const form = useForm({
		defaultValues: {
			url: source.config.url,
			name: source.config.name,
			customUserAgent: source.config.customUserAgent || "",
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutateAsync(value);
		},
	});

	const handleValidate = async () => {
		const url = form.getFieldValue("url");
		const customUserAgent = form.getFieldValue("customUserAgent");

		if (!url) return;

		setIsValidating(true);
		try {
			await validateMutation.mutateAsync({ url, customUserAgent });
		} finally {
			setIsValidating(false);
		}
	};

	const handleUrlChange = (newUrl: string) => {
		form.setFieldValue("url", newUrl);
		if (newUrl !== source.config.url) {
			setUrlChanged(true);
			setValidation(null);
		} else {
			setUrlChanged(false);
		}
	};

	const canSave = !urlChanged || (urlChanged && validation?.valid);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<div>
				<Label htmlFor="url">Feed URL</Label>
				<form.Field name="url">
					{(field) => (
						<div className="space-y-2 mt-1">
							<div className="flex gap-2">
								<Input
									id="url"
									type="url"
									placeholder="https://example.com/feed.xml"
									value={field.state.value}
									onChange={(e) => handleUrlChange(e.target.value)}
									required
								/>
								{urlChanged && (
									<Button
										type="button"
										onClick={handleValidate}
										disabled={!field.state.value || isValidating}
										variant="outline"
									>
										{isValidating ? "Validating..." : "Re-validate"}
									</Button>
								)}
							</div>
							{urlChanged && !validation && (
								<p className="text-sm text-yellow-600">
									URL changed - please re-validate before saving
								</p>
							)}
						</div>
					)}
				</form.Field>
				{validation && !validation.valid && (
					<p className="text-sm text-red-600 mt-1">{validation.error}</p>
				)}
			</div>

			{validation?.valid && <FeedPreview validation={validation} />}

			<div>
				<Label htmlFor="name">Name</Label>
				<form.Field name="name">
					{(field) => (
						<Input
							id="name"
							type="text"
							placeholder="My Feed"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							required
							className="mt-1"
						/>
					)}
				</form.Field>
			</div>

			<div>
				<Label htmlFor="customUserAgent">Custom User Agent (optional)</Label>
				<form.Field name="customUserAgent">
					{(field) => (
						<Input
							id="customUserAgent"
							type="text"
							placeholder="MyBot/1.0"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							className="mt-1"
						/>
					)}
				</form.Field>
			</div>

			<div className="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={!canSave || updateMutation.isPending}>
					{updateMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</form>
	);
}
```

**Step 2: Commit EditSourceForm component**

```bash
git add apps/web/src/components/sources/EditSourceForm.tsx
git commit -m "feat(web): add EditSourceForm with URL change detection"
```

---

### Task 15: Create SourceSidePanel Component

**Files:**
- Create: `apps/web/src/components/sources/SourceSidePanel.tsx`

**Step 1: Create SourceSidePanel component**

Create `apps/web/src/components/sources/SourceSidePanel.tsx`:

```typescript
import { Sheet, SheetHeader, SheetTitle, SheetContent } from "../ui/sheet";
import { AddSourceForm } from "./AddSourceForm";
import { EditSourceForm } from "./EditSourceForm";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

interface SourceSidePanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "add" | "edit";
	source?: SourceConfigWithHealth;
}

export function SourceSidePanel({
	open,
	onOpenChange,
	mode,
	source,
}: SourceSidePanelProps) {
	const handleSuccess = () => {
		onOpenChange(false);
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetHeader>
				<SheetTitle>
					{mode === "add" ? "Add New Source" : "Edit Source"}
				</SheetTitle>
			</SheetHeader>
			<SheetContent>
				{mode === "add" ? (
					<AddSourceForm onSuccess={handleSuccess} onCancel={handleCancel} />
				) : source ? (
					<EditSourceForm
						source={source}
						onSuccess={handleSuccess}
						onCancel={handleCancel}
					/>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
```

**Step 2: Commit SourceSidePanel component**

```bash
git add apps/web/src/components/sources/SourceSidePanel.tsx
git commit -m "feat(web): add SourceSidePanel container for forms"
```

---

## Phase 9: Frontend - Page and Navigation

### Task 16: Create Sources Page Route

**Files:**
- Create: `apps/web/src/routes/sources/index.tsx`

**Step 1: Create sources page**

Create `apps/web/src/routes/sources/index.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "../../components/Layout";
import { SourcesTable } from "../../components/sources/SourcesTable";
import { SourceSidePanel } from "../../components/sources/SourceSidePanel";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { api } from "../../lib/api";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

export const Route = createFileRoute("/sources/")({
	component: SourcesPage,
});

function SourcesPage() {
	const queryClient = useQueryClient();
	const [sidePanelOpen, setSidePanelOpen] = useState(false);
	const [sidePanelMode, setSidePanelMode] = useState<"add" | "edit">("add");
	const [selectedSource, setSelectedSource] = useState<SourceConfigWithHealth | undefined>();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [sourceToDelete, setSourceToDelete] = useState<SourceConfigWithHealth | undefined>();

	const { data, isLoading } = useQuery({
		queryKey: ["sources"],
		queryFn: async () => {
			const response = await api.sources.get();
			return response.data;
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			await api.sources({ id }).delete();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			setDeleteDialogOpen(false);
			setSourceToDelete(undefined);
		},
	});

	const handleAddSource = () => {
		setSidePanelMode("add");
		setSelectedSource(undefined);
		setSidePanelOpen(true);
	};

	const handleEditSource = (source: SourceConfigWithHealth) => {
		setSidePanelMode("edit");
		setSelectedSource(source);
		setSidePanelOpen(true);
	};

	const handleDeleteSource = (source: SourceConfigWithHealth) => {
		setSourceToDelete(source);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = () => {
		if (sourceToDelete) {
			deleteMutation.mutate(sourceToDelete.id);
		}
	};

	return (
		<Layout>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Sources</h1>
					<p className="text-gray-600 mt-1">
						Manage RSS/Atom feed sources for trend monitoring
					</p>
				</div>

				{isLoading ? (
					<div className="text-center py-12">Loading sources...</div>
				) : (
					<SourcesTable
						sources={data?.sources || []}
						onAddSource={handleAddSource}
						onEditSource={handleEditSource}
						onDeleteSource={handleDeleteSource}
					/>
				)}
			</div>

			<SourceSidePanel
				open={sidePanelOpen}
				onOpenChange={setSidePanelOpen}
				mode={sidePanelMode}
				source={selectedSource}
			/>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Source</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{sourceToDelete?.config.name}"? This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Layout>
	);
}
```

**Step 2: Commit sources page route**

```bash
git add apps/web/src/routes/sources/index.tsx
git commit -m "feat(web): add sources page route with CRUD operations"
```

---

### Task 17: Update Navigation

**Files:**
- Modify: `apps/web/src/components/Layout.tsx:21-36`

**Step 1: Add Sources link to navigation**

Update `apps/web/src/components/Layout.tsx`:

```typescript
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface LayoutProps {
	children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex">
							<Link
								to="/"
								className="flex items-center px-2 text-gray-900 font-semibold text-xl"
							>
								Trend Monitor
							</Link>
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								<Link
									to="/"
									className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900"
									activeProps={{ className: "border-b-2 border-primary-500" }}
								>
									Overview
								</Link>
								<Link
									to="/keywords"
									className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
									activeProps={{ className: "border-b-2 border-primary-500 text-gray-900" }}
								>
									Keywords
								</Link>
								<Link
									to="/sources"
									className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
									activeProps={{ className: "border-b-2 border-primary-500 text-gray-900" }}
								>
									Sources
								</Link>
							</div>
						</div>
					</div>
				</div>
			</nav>
			<main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
				{children}
			</main>
		</div>
	);
}
```

**Step 2: Commit navigation update**

```bash
git add apps/web/src/components/Layout.tsx
git commit -m "feat(web): add Sources link to navigation"
```

---

## Phase 10: Testing and Documentation

### Task 18: Run Database Migration

**Files:**
- N/A (migration already created in Task 1)

**Step 1: Run migration on local D1 database**

```bash
cd apps/api-worker
bun wrangler d1 migrations apply DB --local
```

Expected: Migration 0002_add_source_health_tracking.sql applied successfully

**Step 2: Verify schema changes**

```bash
wrangler d1 execute DB --local --command "PRAGMA table_info(source_configs)"
```

Expected: Output shows new columns (last_fetch_at, last_success_at, etc.)

**Step 3: Commit migration verification**

No commit needed - this is a verification step only

---

### Task 19: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Document new source config management feature**

Add to `CLAUDE.md` after the "Implemented Architecture" section:

```markdown
### Source Config Management

The source config management feature allows users to manage RSS/Atom feed sources through a web UI:

**Backend (`apps/api-worker/src/modules/sources`):**
- Full CRUD API endpoints for source configurations
- Feed validation service with RSS/Atom parsing using `rss-parser`
- Health tracking with automatic failure monitoring
- Soft delete support

**Frontend (`apps/web/src/routes/sources`):**
- Sources listing table with TanStack Table (sorting, filtering, search)
- Add/Edit forms with TanStack Form and feed preview
- Health status badges with color-coded indicators
- Enable/disable toggle switches
- Soft delete with confirmation dialog

**Health Tracking:**
- **Success** (green): Last fetch successful, no failures
- **Warning** (yellow): 1-5 consecutive failures
- **Error** (red): 6+ consecutive failures
- Auto-disable after 10 consecutive failures in ingestion worker

**Database Schema:**
- `source_configs` table extended with health tracking fields:
  - `last_fetch_at`, `last_success_at`, `last_error_at`
  - `last_error_message`, `consecutive_failures`
  - `deleted_at` for soft deletes

**Key Components:**
- `SourcesTable`: TanStack Table with inline editing controls
- `AddSourceForm`: Multi-step form with feed validation and preview
- `EditSourceForm`: URL change detection with re-validation requirement
- `HealthBadge`: Color-coded health status with tooltip details
- `StatusToggle`: Enable/disable switch with optimistic UI
- `FeedPreview`: Shows feed metadata and recent items before adding
```

**Step 2: Commit documentation update**

```bash
git add CLAUDE.md
git commit -m "docs: add source config management feature documentation"
```

---

## Completion

All tasks (1-20) are now complete. The source config management feature is fully implemented with:

- Backend API endpoints with validation
- Database schema with health tracking
- Ingestion worker health monitoring
- Frontend UI with TanStack Table and Forms
- Navigation integration
- Documentation updates

**Next Steps:**
1. Test the full workflow end-to-end
2. Deploy to staging environment
3. Monitor health tracking in production
