# Frontend Reference

This document describes frontend patterns, component architecture, and best practices for the React SPA.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: TanStack Router
- **State Management**: TanStack Query for server state
- **Forms**: TanStack Form
- **Tables**: TanStack Table
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **API Client**: Eden Treaty (type-safe Elysia client)

## Source Config Management UI

The sources management page provides a complete CRUD interface for RSS/Atom feed sources.

**Main Page:**
- `apps/web/src/routes/sources/index.tsx` - Sources management page

**UI Components** (`apps/web/src/components/sources/`):
- `SourcesTable.tsx` - TanStack Table with sorting, filtering, search
- `AddSourceForm.tsx` - Multi-step form with feed validation and preview
- `EditSourceForm.tsx` - Edit form with URL change detection
- `SourceSidePanel.tsx` - Sheet container for Add/Edit forms
- `HealthBadge.tsx` - Visual health status indicator
- `StatusToggle.tsx` - Enable/disable switch with mutations
- `ActionButtons.tsx` - Edit and delete actions
- `FeedPreview.tsx` - Displays validated feed metadata and items

## Frontend Patterns

### TanStack Table

Use `useReactTable` with appropriate models for full-featured data tables:

```typescript
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel } from "@tanstack/react-table";

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  state: {
    sorting,
    columnFilters,
  },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
});
```

**Key Features:**
- Sorting: Enable with `enableSorting: true` on column definitions
- Filtering: Use column filters for search functionality
- Selection: Use row selection for bulk actions
- Pagination: Use pagination state for large datasets

### TanStack Form

Use `form.Field` for controlled form fields with validation:

```typescript
import { useForm } from "@tanstack/react-form";

const form = useForm({
  defaultValues: { name: "" },
  onSubmit: async ({ value }) => {
    // Handle submission
  },
});

// In JSX
<form.Field name="name">
  {(field) => (
    <input
      value={field.state.value}
      onChange={(e) => field.handleChange(e.target.value)}
    />
  )}
</form.Field>
```

**Key Patterns:**
- Always use `field.state.value` and `field.handleChange` for controlled fields
- Validation can be synchronous or asynchronous
- Multi-step forms: Use state to track current step

### TanStack Query

Always invalidate queries after mutations to ensure cache consistency:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from '../lib/api'

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: async (data) => {
    return await apiClient.api.sources.post(data);
  },
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ["sources"] });
  },
});
```

**Key Patterns:**
- Query keys: Use consistent query keys across the app
- Optimistic updates: Use `onMutate` for instant UI feedback
- Error handling: Use `onError` to handle mutation failures
- Loading states: Use `isPending`, `isError`, `isSuccess` from query/mutation

### Eden Treaty Client

Use Eden Treaty for type-safe API calls:

```typescript
import { treaty } from "@elysiajs/eden";
import type { App } from "@trend-monitor/api-worker";

const api = treaty<App>("http://localhost:8787");

// Type-safe API calls
const { data, error } = await api.keywords.get();

// For testing
import { treaty } from "@elysiajs/eden";
const client = treaty(app); // Pass app directly, not URL
```

**Key Patterns:**
- Always check `error` before accessing `data`
- Use type inference from backend `App` type
- For integration tests: Use `treaty(app)` directly instead of URL string

## Component Patterns

### shadcn/ui Components

Install components on-demand using the CLI:

```bash
cd apps/web
bunx --bun shadcn@latest add <component> --yes
```

**Common Components:**
- `Button` - Primary actions
- `Dialog` / `Sheet` - Modals and side panels
- `Table` - Data table primitives
- `Form` - Form field wrappers
- `Badge` - Status indicators
- `Switch` - Toggle controls
- `Input` - Text inputs
- `Select` - Dropdowns

### Health Status Indicators

Use the `HealthBadge` component for source health visualization:

```typescript
<HealthBadge consecutiveFailures={source.consecutiveFailures} />
```

**Health Levels:**
- **Success** (green): 0 consecutive failures
- **Warning** (yellow): 1-5 consecutive failures
- **Error** (red): 6+ consecutive failures

## File Organization

```
apps/web/src/
├── routes/                 # TanStack Router routes
│   └── sources/
│       └── index.tsx       # Sources page
├── components/             # Reusable components
│   ├── sources/            # Source-specific components
│   ├── ui/                 # shadcn/ui components
│   └── layout/             # Layout components
├── lib/                    # Utilities
│   ├── api.ts              # Eden Treaty client setup
│   └── utils.ts            # Helper functions
└── styles/                 # Global styles
```

## Best Practices

1. **Type Safety**: Always use TypeScript and infer types from backend
2. **Component Size**: Keep components small and focused (< 200 lines)
3. **Reusability**: Extract common patterns into shared components
4. **Error Handling**: Always handle loading and error states
5. **Accessibility**: Use semantic HTML and ARIA attributes
6. **Performance**: Use React.memo for expensive components
7. **Testing**: Write tests for complex component logic
