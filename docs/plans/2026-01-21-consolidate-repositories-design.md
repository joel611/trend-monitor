# Design: Consolidate Repositories into @trend-monitor/db

**Date**: 2026-01-21
**Status**: Approved

## Overview

Move all repository classes from individual workers into the `@trend-monitor/db` package, merging duplicate implementations into comprehensive, feature-complete versions.

## Goals

- **Single source of truth** for all data access patterns
- **Reduced duplication** - KeywordsRepository and MentionsRepository exist in multiple workers
- **Better testability** - Repositories tested once, used everywhere
- **Consistent patterns** - All workers use the same data access API
- **Type safety** - Repositories co-located with Drizzle schema they use

## Package Structure

### New structure for `@trend-monitor/db`

```
packages/db/src/
├── schema.ts                    # Existing Drizzle schema
├── client.ts                    # Existing createDbClient() factory
├── mock.ts                      # Existing createMockDB() for testing
├── repositories/                # NEW: Repository classes
│   ├── index.ts                 # Barrel export for all repositories
│   ├── keywords-repository.ts   # Consolidated from api-worker + processor-worker
│   ├── mentions-repository.ts   # Consolidated from api-worker + processor-worker
│   ├── aggregation-repository.ts  # From aggregator-worker
│   └── source-config-repository.ts # From ingestion-feeds
├── repositories/*.test.ts       # Repository tests (moved from workers)
└── index.ts                     # Main export (add repositories)
```

### Updated package.json exports

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./mock": "./src/mock.ts",
    "./repositories": "./src/repositories/index.ts"
  }
}
```

### Usage in workers

```typescript
// Before:
import { KeywordsRepository } from "./repositories/keywords-repository";

// After:
import { KeywordsRepository } from "@trend-monitor/db/repositories";
```

## Repository Consolidation

### KeywordsRepository

**Sources**: api-worker + processor-worker

**Merged API**:
```typescript
class KeywordsRepository {
  // From api-worker (CRUD):
  create(input: { name, aliases, tags }): Promise<Keyword>
  findById(id: string): Promise<Keyword | null>
  list(options?: { limit?, offset? }): Promise<Keyword[]>
  update(id: string, input: { ... }): Promise<Keyword | null>
  delete(id: string): Promise<boolean>  // soft delete

  // From processor-worker (batch loading):
  findAll(): Promise<Keyword[]>  // loads all active keywords
}
```

### MentionsRepository

**Sources**: api-worker + processor-worker

**Merged API**:
```typescript
class MentionsRepository {
  // From processor-worker (write):
  createOrIgnore(input: { ... }): Promise<Mention | null>

  // From api-worker (read):
  list(options: {
    keywordId?,
    source?,
    limit?,
    offset?
  }): Promise<Mention[]>
}
```

### AggregationRepository

**Source**: aggregator-worker only (no merge needed)

**API**:
```typescript
class AggregationRepository {
  upsertDailyAggregate(input: { ... }): Promise<void>
  getMentionsByDateRange(from: string, to: string): Promise<Mention[]>
}
```

### SourceConfigRepository

**Source**: ingestion-feeds only (no merge needed)

**API**:
```typescript
class SourceConfigRepository {
  listEnabled(): Promise<SourceConfig[]>
}
```

## Migration Plan

### Step 1: Create repository structure in @trend-monitor/db

- Create `src/repositories/` directory
- Add barrel export `src/repositories/index.ts`
- Update `package.json` exports to include `./repositories`

### Step 2: Consolidate repositories

- Merge KeywordsRepository implementations (api-worker + processor-worker)
- Merge MentionsRepository implementations (api-worker + processor-worker)
- Move AggregationRepository from aggregator-worker
- Move SourceConfigRepository from ingestion-feeds

### Step 3: Move and consolidate tests

- Move repository tests to `packages/db/src/repositories/*.test.ts`
- Ensure all methods from both sources have test coverage
- Tests use existing `createMockDB()` from `@trend-monitor/db/mock`

### Step 4: Update worker imports

- api-worker: Replace local repository imports with `@trend-monitor/db/repositories`
- processor-worker: Replace local repository imports
- aggregator-worker: Replace local repository imports
- ingestion-feeds: Replace local repository imports

### Step 5: Delete old repository files

- Remove `apps/*/src/repositories/` directories
- Remove worker-local repository tests

### Step 6: Verify and test

- Run `bun test` at root to verify all tests pass
- Run `bun run typecheck` to verify no type errors
- Test each worker individually

## Rollback Strategy

If issues arise, git revert is clean since this is primarily moving code without changing behavior.

## Benefits

1. **Reduced duplication**: Single implementation of KeywordsRepository and MentionsRepository
2. **Improved testability**: Repository tests live with the repositories, tested once
3. **Better separation of concerns**: Workers focus on orchestration (HTTP/queue handling), repositories handle data access
4. **Type safety**: Repositories co-located with Drizzle schema ensures type consistency
5. **Easier maintenance**: Changes to data access patterns happen in one place

## Non-Goals

- Services remain in workers (they have worker-specific context like KV, queues)
- No changes to service layer architecture
- No changes to database schema or migrations
