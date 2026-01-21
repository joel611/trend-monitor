# Source Config Management Design

**Date**: 2026-01-21
**Status**: Draft
**Author**: Design brainstorming session

## Overview

This document describes the design for adding source configuration management to the Trend Monitor dashboard. Users will be able to add, edit, validate, and monitor RSS/Atom feed sources through a dedicated web UI and REST API.

## Goals

- Provide a web UI for managing feed sources (currently only configurable via database)
- Validate feed URLs before saving to ensure they're accessible and parseable
- Preview feed content before adding to help users verify the right feed
- Track feed health and automatically handle failures
- Maintain data integrity with soft deletes

## Non-Goals

- Multi-tenant source configurations (single user for MVP)
- Bulk import of sources from OPML files (can add later)
- Advanced feed filtering or transformation rules
- Real-time feed monitoring dashboard (basic health indicators only)

## Architecture Overview

The feature builds on the existing `source_configs` table and integrates with:
- **API Worker**: New `/api/sources` module for CRUD operations
- **Web App**: New `/sources` route with TanStack Table and TanStack Form
- **Ingestion Worker**: Extended to track feed health metrics

## Data Model

### Schema Changes

Extend the `source_configs` table with operational tracking fields:

```typescript
export const sourceConfigs = sqliteTable("source_configs", {
  // Existing fields
  id: text("id").primaryKey(),
  type: text("type", { enum: ["feed", "x"] }).notNull(),
  config: text("config", { mode: "json" }).$type<FeedSourceConfig>().notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),

  // New operational tracking fields
  lastFetchAt: text("last_fetch_at"),           // Last attempt (success or failure)
  lastSuccessAt: text("last_success_at"),       // Last successful fetch
  lastErrorAt: text("last_error_at"),           // Last error timestamp
  lastErrorMessage: text("last_error_message"), // Error details for debugging
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),

  // Soft delete support
  deletedAt: text("deleted_at"),
});
```

### Config JSON Structure

The `config` JSON field stores feed-specific configuration:

```typescript
interface FeedSourceConfig {
  url: string;                // RSS/Atom feed URL
  name: string;               // User-friendly name
  customUserAgent?: string;   // Optional custom User-Agent header
  feedTitle?: string;         // Feed metadata (from <title>)
  feedDescription?: string;   // Feed metadata (from <description>)
}
```

### Health Status Calculation

Health status is derived from operational metrics:

```typescript
function calculateHealth(source: SourceConfig): 'success' | 'warning' | 'error' {
  if (!source.lastFetchAt) return 'warning'; // Never fetched
  if (source.consecutiveFailures === 0) return 'success';
  if (source.consecutiveFailures < 6) return 'warning';
  return 'error'; // 6+ failures
}
```

**Health Indicators:**
- **Success** (green): Last fetch successful, no recent failures
- **Warning** (yellow): 1-5 consecutive failures, still retrying
- **Error** (red): 6+ consecutive failures, may auto-disable soon

## API Design

### New Module: `/api/sources`

Create `apps/api-worker/src/modules/sources/` following the existing pattern.

#### Endpoints

```typescript
// List all sources
GET /api/sources
Query params:
  - includeDeleted: boolean (default: false)
Response: {
  sources: SourceConfigWithHealth[]
}

// Validate feed URL without saving
POST /api/sources/validate
Body: {
  url: string
  customUserAgent?: string
}
Response: {
  valid: boolean
  metadata?: {
    title: string
    description: string
    format: 'rss' | 'atom'
    lastUpdated?: string
  }
  preview?: Array<{
    title: string
    link: string
    pubDate?: string
    content?: string
  }>
  error?: string
}

// Create new source
POST /api/sources
Body: {
  url: string
  name: string
  type: "feed"
  customUserAgent?: string
}
Response: {
  source: SourceConfig
}

// Get single source
GET /api/sources/:id
Response: {
  source: SourceConfigWithHealth
}

// Update source
PUT /api/sources/:id
Body: {
  url?: string
  name?: string
  customUserAgent?: string
  enabled?: boolean
}
Response: {
  source: SourceConfig
}
Note: If URL changed, requires re-validation via /validate first

// Soft delete source
DELETE /api/sources/:id
Response: {
  success: boolean
}

// Toggle enabled status
PATCH /api/sources/:id/toggle
Response: {
  source: SourceConfig
}
```

#### Repository Layer

```typescript
class SourceConfigRepository {
  constructor(private db: DbClient) {}

  // CRUD operations
  async list(includeDeleted: boolean = false): Promise<SourceConfig[]>
  async listWithHealth(): Promise<SourceConfigWithHealth[]>
  async findById(id: string): Promise<SourceConfig | null>
  async create(data: InsertSourceConfig): Promise<SourceConfig>
  async update(id: string, data: Partial<InsertSourceConfig>): Promise<SourceConfig>
  async softDelete(id: string): Promise<void>
  async toggle(id: string): Promise<SourceConfig>

  // Health tracking
  async recordSuccess(id: string, metrics: SuccessMetrics): Promise<void>
  async recordFailure(id: string, metrics: FailureMetrics): Promise<void>
  async disable(id: string): Promise<void>
}
```

#### Feed Validation Service

Create `apps/api-worker/src/services/feed-validator.ts`:

```typescript
class FeedValidatorService {
  async validate(url: string, customUserAgent?: string): Promise<ValidationResult> {
    // 1. Fetch feed URL with timeout (10s)
    // 2. Parse RSS/Atom using rss-parser
    // 3. Extract metadata (title, description, format)
    // 4. Get first 5-10 items as preview
    // 5. Return validation result
  }

  private async fetchFeed(url: string, userAgent?: string): Promise<string>
  private parseFeed(xml: string): Promise<ParsedFeed>
  private extractPreview(items: FeedItem[], limit: number = 10): FeedPreview[]
}
```

**Error Handling:**
- Network errors: timeout, DNS failure, connection refused
- HTTP errors: 404, 403, 500, etc.
- Parse errors: invalid XML, malformed feed structure
- Content errors: no items, missing required fields

All errors are categorized and returned in the validation response.

## Frontend Design

### New Route: `/sources`

Create `apps/web/src/routes/sources/index.tsx` with TanStack Router.

### Component Structure

```
SourcesPage
├── SourcesTable (TanStack Table)
│   ├── Columns: name, url, type, status, health, lastFetchAt, actions
│   ├── Built-in sorting (name, lastFetchAt)
│   ├── Built-in filtering (status, health)
│   ├── Search by name or URL
│   └── "Add Source" button
├── SourceSidePanel (shadcn Sheet)
│   ├── AddSourceForm (TanStack Form)
│   │   ├── Step 1: URL input + "Validate" button
│   │   ├── FeedPreview (appears after successful validation)
│   │   │   ├── Feed metadata display
│   │   │   └── Preview items list (5-10 recent posts)
│   │   └── Step 2: Name input (pre-filled), custom user agent (optional)
│   └── EditSourceForm (TanStack Form)
│       ├── URL input (with change detection)
│       ├── Name input
│       ├── Custom user agent input
│       └── Re-validate button (appears if URL changed)
└── DeleteConfirmDialog (shadcn AlertDialog)
    └── Confirms soft delete action
```

### TanStack Table Implementation

```typescript
const columns: ColumnDef<SourceConfigWithHealth>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: true,
  },
  {
    accessorKey: "url",
    header: "Feed URL",
    cell: ({ row }) => (
      <a href={row.original.config.url} target="_blank" rel="noopener">
        {row.original.config.url}
      </a>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "enabled",
    header: "Status",
    cell: ({ row }) => <StatusToggle source={row.original} />,
    filterFn: (row, id, value) => {
      if (value === 'all') return true;
      return row.original.enabled === (value === 'enabled');
    },
  },
  {
    id: "health",
    header: "Health",
    cell: ({ row }) => <HealthBadge source={row.original} />,
    filterFn: (row, id, value) => {
      if (value === 'all') return true;
      const health = calculateHealth(row.original);
      return health === value;
    },
  },
  {
    accessorKey: "lastFetchAt",
    header: "Last Fetch",
    enableSorting: true,
    cell: ({ row }) => formatRelativeTime(row.original.lastFetchAt),
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionButtons source={row.original} />,
  },
];
```

### TanStack Form Implementation

```typescript
// Add Source Form
const addSourceForm = useForm({
  defaultValues: {
    url: '',
    name: '',
    customUserAgent: '',
  },
  validators: {
    onChange: ({ value }) => {
      if (!value.url) return 'URL is required';
      if (!isValidUrl(value.url)) return 'Invalid URL format';
      return undefined;
    },
  },
  onSubmit: async ({ value }) => {
    await createSourceMutation.mutateAsync(value);
  },
});

// Edit Source Form with URL change detection
const editSourceForm = useForm({
  defaultValues: source,
  validators: {
    onChange: ({ value }) => {
      const urlChanged = value.url !== source.config.url;
      if (urlChanged && !urlValidated) {
        return 'Please re-validate the feed URL before saving';
      }
      return undefined;
    },
  },
  onSubmit: async ({ value }) => {
    await updateSourceMutation.mutateAsync({ id: source.id, data: value });
  },
});
```

### Add Source Flow

1. User clicks "Add Source" button
2. Side panel opens with empty form
3. User enters feed URL and clicks "Validate"
4. Loading state while validation runs
5. On success:
   - Feed preview appears showing metadata and recent items
   - Name field pre-populated with feed title
   - User can edit name or add custom user agent
   - "Add Source" button becomes enabled
6. On failure:
   - Error message displayed with details
   - User can correct URL and retry validation
7. User clicks "Add Source" to save
8. Side panel closes, table refreshes with new source

### Edit Source Flow

1. User clicks edit button on table row
2. Side panel opens with pre-filled form
3. If user changes URL:
   - Warning appears: "URL changed - please re-validate"
   - "Re-validate" button appears
   - "Save" button disabled until re-validated
4. If user only changes name/user agent:
   - "Save" button immediately available
   - No re-validation required
5. User saves changes
6. Side panel closes, table refreshes

### Components to Create

```
apps/web/src/components/sources/
├── SourcesTable.tsx          # TanStack Table with columns
├── SourceSidePanel.tsx       # Sheet container for forms
├── AddSourceForm.tsx         # TanStack Form for adding
├── EditSourceForm.tsx        # TanStack Form for editing
├── FeedPreview.tsx           # Feed metadata and items preview
├── HealthBadge.tsx           # Health status indicator
├── StatusToggle.tsx          # Enable/disable toggle
└── ActionButtons.tsx         # Edit/delete buttons
```

## Ingestion Worker Updates

Update `apps/ingestion-feeds/src/index.ts` to track health metrics:

```typescript
for (const configRow of configs) {
  try {
    const result = await ingestionService.processFeed(...);

    // Record success
    await sourceConfigRepo.recordSuccess(configRow.id, {
      lastFetchAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      consecutiveFailures: 0, // Reset counter
      lastErrorAt: null,
      lastErrorMessage: null,
    });

    allEvents.push(...result.events);

  } catch (err) {
    // Record failure
    const failures = configRow.consecutiveFailures + 1;
    await sourceConfigRepo.recordFailure(configRow.id, {
      lastFetchAt: new Date().toISOString(),
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: err.message,
      consecutiveFailures: failures,
    });

    // Auto-disable after 10 consecutive failures
    if (failures >= 10) {
      await sourceConfigRepo.disable(configRow.id);
      console.warn(
        `Auto-disabled source ${configRow.config.name} after 10 failures`
      );
    }

    // Continue with other feeds
    console.error(`Failed to process feed ${configRow.config.name}:`, err);
  }
}
```

### Health Tracking Logic

**On Success:**
- Update `lastFetchAt` and `lastSuccessAt` to current timestamp
- Reset `consecutiveFailures` to 0
- Clear `lastErrorAt` and `lastErrorMessage`

**On Failure:**
- Update `lastFetchAt` and `lastErrorAt` to current timestamp
- Store error message in `lastErrorMessage`
- Increment `consecutiveFailures` by 1
- If `consecutiveFailures >= 10`, set `enabled = false`

**Auto-Recovery:**
- When a previously failed source succeeds, `consecutiveFailures` resets to 0
- User can manually re-enable auto-disabled sources via the UI

## Testing Strategy

### Backend Tests (API Worker)

```typescript
// apps/api-worker/src/modules/sources/repository.test.ts
describe('SourceConfigRepository', () => {
  test('create source with valid config')
  test('list sources with health calculation')
  test('update source name without URL change')
  test('update source with URL change')
  test('soft delete source (sets deletedAt)')
  test('toggle enabled status')
  test('record success metrics')
  test('record failure metrics')
  test('auto-disable after 10 failures')
  test('reset failure counter on success')
});

// apps/api-worker/src/modules/sources/index.test.ts
describe('Sources API', () => {
  test('GET /api/sources returns list')
  test('GET /api/sources with includeDeleted=true')
  test('POST /api/sources/validate with valid RSS feed')
  test('POST /api/sources/validate with valid Atom feed')
  test('POST /api/sources/validate with invalid URL')
  test('POST /api/sources/validate with network error')
  test('POST /api/sources creates new source')
  test('PUT /api/sources/:id updates source')
  test('PUT /api/sources/:id rejects URL change without validation')
  test('DELETE /api/sources/:id soft deletes')
  test('PATCH /api/sources/:id/toggle enables/disables')
});

// apps/api-worker/src/services/feed-validator.test.ts
describe('FeedValidatorService', () => {
  test('parse valid RSS 2.0 feed')
  test('parse valid Atom 1.0 feed')
  test('reject invalid XML')
  test('reject non-feed content (HTML)')
  test('handle network timeout')
  test('extract feed metadata correctly')
  test('return limited preview items (max 10)')
  test('handle feeds with missing pubDate')
  test('respect custom user agent')
});
```

### Frontend Tests

```typescript
// apps/web/src/routes/sources/index.test.tsx
describe('SourcesPage', () => {
  test('render sources table with data')
  test('filter by status (enabled/disabled)')
  test('filter by health (success/warning/error)')
  test('sort by name')
  test('sort by last fetch time')
  test('search by name')
  test('search by URL')
});

// apps/web/src/components/sources/AddSourceForm.test.tsx
describe('AddSourceForm', () => {
  test('validate URL format')
  test('show loading state during validation')
  test('display feed preview on success')
  test('pre-fill name from feed title')
  test('show error message on validation failure')
  test('submit form creates source')
});

// apps/web/src/components/sources/EditSourceForm.test.tsx
describe('EditSourceForm', () => {
  test('load existing source data')
  test('show warning when URL changes')
  test('require re-validation when URL changes')
  test('allow save without validation if URL unchanged')
  test('submit form updates source')
});
```

### Integration Tests (Ingestion Worker)

```typescript
// apps/ingestion-feeds/src/index.test.ts
describe('Ingestion with health tracking', () => {
  test('record success metrics after successful fetch')
  test('record failure metrics after failed fetch')
  test('increment consecutive failures on repeated errors')
  test('reset failure counter on success after failures')
  test('auto-disable source after 10 consecutive failures')
  test('continue processing other feeds after one fails')
});
```

## Migration Plan

### Phase 1: Backend Foundation
1. Create database migration for new columns
2. Update `@trend-monitor/db` package with new schema
3. Implement `SourceConfigRepository` with new methods
4. Create `FeedValidatorService`
5. Implement `/api/sources` endpoints
6. Write backend tests

### Phase 2: Ingestion Worker Integration
1. Update ingestion worker to call `recordSuccess`/`recordFailure`
2. Implement auto-disable logic
3. Write integration tests

### Phase 3: Frontend Implementation
1. Install TanStack Table and TanStack Form (if not already present)
2. Create `/sources` route
3. Implement `SourcesTable` with TanStack Table
4. Implement `AddSourceForm` with TanStack Form
5. Implement `EditSourceForm` with TanStack Form
6. Create supporting components (HealthBadge, StatusToggle, etc.)
7. Write frontend tests

### Phase 4: Polish & Documentation
1. Add navigation link to Sources page in main layout
2. Update CLAUDE.md with new patterns
3. Manual testing and bug fixes
4. Performance optimization if needed

## Open Questions

None - all design decisions confirmed through brainstorming session.

## Future Enhancements

- OPML import/export for bulk source management
- Feed health dashboard with trends over time
- Email/webhook notifications for feed failures
- Feed content transformation rules (filters, regex)
- Rate limiting per source
- Custom fetch intervals per source (instead of global cron)
