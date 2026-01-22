# Testing Reference

This document describes testing patterns, tools, and best practices used across the monorepo.

## Testing Stack

- **Test Runner**: Bun's built-in test runner
- **Mock Database**: `bun:sqlite` in-memory database with Drizzle ORM
- **API Testing**: Eden Treaty client for type-safe API tests
- **Assertions**: Bun's built-in `expect` assertions

## Running Tests

**From specific worker:**
```bash
cd apps/[worker-name]
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage
```

**From monorepo root:**
```bash
bun run test              # Run all workspace tests via Turborepo
bun run test:unit         # Unit tests only
bun run test:integration  # Integration tests only
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage
```

## Mock Database Setup

All workers use the shared mock database from `@trend-monitor/db/mock`:

```typescript
import { createMockDB } from "@trend-monitor/db/mock";
import { keywords, mentions } from "@trend-monitor/db";

// Create in-memory database with schema
const db = createMockDB();

// Seed test data
await db.insert(keywords).values({
  name: "TypeScript",
  status: "active",
});

// Use in tests
const results = await db.select().from(keywords);
expect(results).toHaveLength(1);
```

**Key Features:**
- Uses `bun:sqlite` for in-memory database (fast, no cleanup needed)
- Full Drizzle ORM support with type safety
- Same schema as production D1 database
- Isolated per test file (no state leakage)

## API Worker Testing Patterns

### Integration Tests with Eden Treaty

```typescript
import { treaty } from "@elysiajs/eden";
import { app } from "../src/index";
import { createMockDB } from "@trend-monitor/db/mock";

const client = treaty(app); // Pass app directly, not URL

// Test API endpoint
const { data, error } = await client.keywords.get();
expect(error).toBeNull();
expect(data).toHaveLength(0);
```

**IMPORTANT**: Use `treaty(app)` directly instead of URL string for integration tests to avoid network overhead.

### Repository Tests

```typescript
import { createMockDB } from "@trend-monitor/db/mock";
import { KeywordsRepository } from "../src/modules/keywords/repository";

const db = createMockDB();
const repo = new KeywordsRepository(db);

// Test repository methods
const keyword = await repo.create({ name: "React" });
expect(keyword.name).toBe("React");
```

## Worker Testing Patterns

### Queue Consumer Tests (Processor Worker)

```typescript
import { createMockDB } from "@trend-monitor/db/mock";
import { keywords, mentions } from "@trend-monitor/db";

// Setup with preload for proper isolation
// In test/mock-db.ts:
const db = createMockDB();
// Export for tests

// In tests:
const batch: MessageBatch<IngestionEvent> = {
  queue: "test-queue",
  messages: [
    {
      id: "1",
      timestamp: new Date(),
      body: {
        source: "reddit",
        sourceId: "abc123",
        title: "Check out TypeScript!",
        content: "TypeScript is awesome",
        url: "https://reddit.com/r/programming/abc123",
        author: "testuser",
        createdAt: Date.now(),
      },
    },
  ],
};

await queue(batch, env, ctx);

// Verify mentions created
const result = await db.select().from(mentions);
expect(result).toHaveLength(1);
```

### Scheduled Worker Tests (Feed Ingestion Worker)

```typescript
import { scheduled } from "../src/index";

// Mock ScheduledController
const controller: ScheduledController = {
  scheduledTime: Date.now(),
  cron: "*/15 * * * *",
  noRetry: () => {},
};

await scheduled(controller, env, ctx);

// Verify queue messages published
expect(mockQueue.send).toHaveBeenCalledTimes(5);
```

## Mock Module Setup

For workers with complex dependencies, use module preloading:

**In test/mock-db.ts:**
```typescript
import { createMockDB } from "@trend-monitor/db/mock";
import { keywords } from "@trend-monitor/db";

export const db = createMockDB();

// Seed common test data
await db.insert(keywords).values({
  name: "TypeScript",
  status: "active",
});
```

**In package.json:**
```json
{
  "scripts": {
    "test": "bun test --preload ./test/mock-db.ts"
  }
}
```

This ensures proper test isolation and consistent mock setup.

## Testing Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Mock External Services**: Use mocks for KV, Queue, external APIs
3. **Type Safety**: Use Eden Treaty for type-safe API testing
4. **Coverage**: Aim for >80% coverage on business logic
5. **Fast Tests**: Use in-memory database for speed
6. **Descriptive Names**: Test names should clearly describe what they test
7. **AAA Pattern**: Arrange, Act, Assert structure for clarity

## Example Test Structure

```typescript
import { describe, test, expect, beforeEach } from "bun:test";

describe("KeywordsRepository", () => {
  let db: DrizzleD1Database;
  let repo: KeywordsRepository;

  beforeEach(() => {
    db = createMockDB();
    repo = new KeywordsRepository(db);
  });

  test("should create keyword with valid data", async () => {
    // Arrange
    const data = { name: "TypeScript", status: "active" };

    // Act
    const result = await repo.create(data);

    // Assert
    expect(result.name).toBe("TypeScript");
    expect(result.status).toBe("active");
  });

  test("should throw error for duplicate keyword", async () => {
    // Arrange
    await repo.create({ name: "TypeScript" });

    // Act & Assert
    expect(async () => {
      await repo.create({ name: "TypeScript" });
    }).toThrow();
  });
});
```

## Debugging Tests

```bash
# Run specific test file
bun test src/modules/keywords/repository.test.ts

# Run tests matching pattern
bun test --test-name-pattern "should create"

# Run with verbose output
bun test --verbose

# Run single test
bun test --only
```
