# queryOptions Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the web app to use queryOptions factory functions and custom mutation hooks, moving all API client calls out of components into dedicated feature modules.

**Architecture:** Create feature-based query/mutation modules following TanStack Query best practices. Query options will be pure factory functions returning queryOptions(), while mutations will be custom hooks that encapsulate API calls and cache invalidation.

**Tech Stack:** TanStack Query v5, TanStack Router, Eden Treaty, TypeScript

---

## Task 1: Create Feature Folders Structure

**Files:**
- Create: `apps/web/src/features/keywords/queries.ts`
- Create: `apps/web/src/features/keywords/mutations.ts`
- Create: `apps/web/src/features/sources/queries.ts`
- Create: `apps/web/src/features/sources/mutations.ts`
- Create: `apps/web/src/features/trends/queries.ts`
- Create: `apps/web/src/features/mentions/queries.ts`

**Step 1: Create directory structure**

Run: `mkdir -p apps/web/src/features/{keywords,sources,trends,mentions}`

Expected: Directories created successfully

**Step 2: Create empty query/mutation files**

Run:
```bash
touch apps/web/src/features/keywords/queries.ts
touch apps/web/src/features/keywords/mutations.ts
touch apps/web/src/features/sources/queries.ts
touch apps/web/src/features/sources/mutations.ts
touch apps/web/src/features/trends/queries.ts
touch apps/web/src/features/mentions/queries.ts
```

Expected: All files created

**Step 3: Commit structure**

```bash
git add apps/web/src/features/
git commit -m "chore: create features folder structure for queries and mutations"
```

---

## Task 2: Implement Trends Query Options

**Files:**
- Modify: `apps/web/src/features/trends/queries.ts`

**Step 1: Write trends overview query option**

Add to `apps/web/src/features/trends/queries.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function trendsOverviewQueryOptions() {
  return queryOptions({
    queryKey: ['trends', 'overview'],
    queryFn: async () => {
      const response = await apiClient.api.trends.overview.get();
      if (response.error) throw new Error('Failed to fetch trends');
      return response.data;
    },
  });
}

export function trendDataQueryOptions(keywordId: string) {
  return queryOptions({
    queryKey: ['trends', keywordId],
    queryFn: async () => {
      const response = await apiClient.api.trends({ keywordId }).get();
      if (response.error) throw new Error('Failed to fetch trend');
      return response.data;
    },
  });
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 3: Commit trends queries**

```bash
git add apps/web/src/features/trends/queries.ts
git commit -m "feat(web): add trends query options"
```

---

## Task 3: Implement Keywords Query Options

**Files:**
- Modify: `apps/web/src/features/keywords/queries.ts`

**Step 1: Write keywords query options**

Add to `apps/web/src/features/keywords/queries.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function keywordsQueryOptions() {
  return queryOptions({
    queryKey: ['keywords'],
    queryFn: async () => {
      const response = await apiClient.api.keywords.get();
      if (response.error) throw new Error('Failed to fetch keywords');
      return response.data;
    },
  });
}

export function keywordDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['keywords', id],
    queryFn: async () => {
      const response = await apiClient.api.keywords({ id }).get();
      if (response.error) throw new Error('Failed to fetch keyword');
      return response.data;
    },
  });
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 3: Commit keywords queries**

```bash
git add apps/web/src/features/keywords/queries.ts
git commit -m "feat(web): add keywords query options"
```

---

## Task 4: Implement Sources Query Options

**Files:**
- Modify: `apps/web/src/features/sources/queries.ts`

**Step 1: Write sources query options**

Add to `apps/web/src/features/sources/queries.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function sourcesQueryOptions() {
  return queryOptions({
    queryKey: ['sources'],
    queryFn: async () => {
      const response = await apiClient.api.sources.get();
      return response.data;
    },
  });
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 3: Commit sources queries**

```bash
git add apps/web/src/features/sources/queries.ts
git commit -m "feat(web): add sources query options"
```

---

## Task 5: Implement Mentions Query Options

**Files:**
- Modify: `apps/web/src/features/mentions/queries.ts`

**Step 1: Write mentions query options**

Add to `apps/web/src/features/mentions/queries.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function mentionsQueryOptions(keywordId: string, limit = 20) {
  return queryOptions({
    queryKey: ['mentions', keywordId, { limit }],
    queryFn: async () => {
      const response = await apiClient.api.mentions.get({
        query: { keywordId, limit },
      });
      if (response.error) throw new Error('Failed to fetch mentions');
      return response.data;
    },
  });
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 3: Commit mentions queries**

```bash
git add apps/web/src/features/mentions/queries.ts
git commit -m "feat(web): add mentions query options"
```

---

## Task 6: Implement Keywords Mutation Hooks

**Files:**
- Modify: `apps/web/src/features/keywords/mutations.ts`

**Step 1: Write keyword mutation hooks**

Add to `apps/web/src/features/keywords/mutations.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import type { CreateKeywordRequest } from '@trend-monitor/types';

export function useCreateKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateKeywordRequest) => {
      const response = await apiClient.api.keywords.post(data);
      if (response.error) throw new Error('Failed to create keyword');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
    },
  });
}

export function useDeleteKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.api.keywords({ id }).delete();
      if (response.error) throw new Error('Failed to delete keyword');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
    },
  });
}
```

**Step 2: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 3: Commit keywords mutations**

```bash
git add apps/web/src/features/keywords/mutations.ts
git commit -m "feat(web): add keywords mutation hooks"
```

---

## Task 7: Implement Sources Mutation Hooks

**Files:**
- Modify: `apps/web/src/features/sources/mutations.ts`

**Step 1: Read existing source components to understand mutations**

Run: `cat apps/web/src/components/sources/AddSourceForm.tsx apps/web/src/components/sources/EditSourceForm.tsx apps/web/src/components/sources/StatusToggle.tsx | grep -A 10 "useMutation"`

Expected: See existing mutation patterns

**Step 2: Write source mutation hooks**

Add to `apps/web/src/features/sources/mutations.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import type { CreateSourceConfigRequest, UpdateSourceConfigRequest } from '@trend-monitor/types';

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSourceConfigRequest) => {
      const response = await apiClient.api.sources.post(data);
      if (response.error) throw new Error('Failed to create source');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSourceConfigRequest }) => {
      const response = await apiClient.api.sources({ id }).put(data);
      if (response.error) throw new Error('Failed to update source');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.api.sources({ id }).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useToggleSourceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await apiClient.api.sources({ id }).patch({ enabled });
      if (response.error) throw new Error('Failed to toggle source status');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
```

**Step 3: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 4: Commit sources mutations**

```bash
git add apps/web/src/features/sources/mutations.ts
git commit -m "feat(web): add sources mutation hooks"
```

---

## Task 8: Refactor Overview Route (routes/index.tsx)

**Files:**
- Modify: `apps/web/src/routes/index.tsx:1-86`

**Step 1: Update imports and use query options**

Replace lines 1-20 in `apps/web/src/routes/index.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "../components/StatsCard";
import { TrendsList } from "../components/TrendsList";
import { SkeletonCard } from "../components/Skeleton";
import { trendsOverviewQueryOptions } from "../features/trends/queries";

export const Route = createFileRoute("/")({
	component: Overview,
});

function Overview() {
	const { data, isLoading, error } = useQuery(trendsOverviewQueryOptions());
```

**Step 2: Verify the route still works**

Run: `cd apps/web && bun run dev`

Expected: Navigate to `/` and see overview page working

**Step 3: Commit overview route refactor**

```bash
git add apps/web/src/routes/index.tsx
git commit -m "refactor(web): use trendsOverviewQueryOptions in overview route"
```

---

## Task 9: Refactor Keywords Route (routes/keywords/index.tsx)

**Files:**
- Modify: `apps/web/src/routes/keywords/index.tsx:1-115`

**Step 1: Update imports and use query options and mutation hooks**

Replace lines 1-56 in `apps/web/src/routes/keywords/index.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { KeywordsList } from "../../components/KeywordsList";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../../components/ui/dialog";
import { KeywordForm } from "../../components/KeywordForm";
import { SkeletonTable } from "../../components/Skeleton";
import { keywordsQueryOptions } from "../../features/keywords/queries";
import { useCreateKeyword, useDeleteKeyword } from "../../features/keywords/mutations";

export const Route = createFileRoute("/keywords/")({
	component: Keywords,
});

function Keywords() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const { data, isLoading, error } = useQuery(keywordsQueryOptions());

	const createMutation = useCreateKeyword();
	const deleteMutation = useDeleteKeyword();

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to archive this keyword?")) {
			deleteMutation.mutate(id);
		}
	};
```

**Step 2: Update form submission to add UI state handling**

Update line 103 in `apps/web/src/routes/keywords/index.tsx`:

```typescript
						<KeywordForm
							onSubmit={(data) => {
								createMutation.mutate(data, {
									onSuccess: () => setIsDialogOpen(false),
								});
							}}
							onCancel={() => setIsDialogOpen(false)}
							isSubmitting={createMutation.isPending}
						/>
```

**Step 3: Verify the route still works**

Run: `cd apps/web && bun run dev`

Expected: Navigate to `/keywords` and test create/delete

**Step 4: Commit keywords route refactor**

```bash
git add apps/web/src/routes/keywords/index.tsx
git commit -m "refactor(web): use query options and mutation hooks in keywords route"
```

---

## Task 10: Refactor Keyword Detail Route (routes/keywords/$keywordId.tsx)

**Files:**
- Modify: `apps/web/src/routes/keywords/$keywordId.tsx:1-115`

**Step 1: Update imports and use query options**

Replace lines 1-43 in `apps/web/src/routes/keywords/$keywordId.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { TrendChart } from "../../components/TrendChart";
import { MentionsList } from "../../components/MentionsList";
import { keywordDetailQueryOptions } from "../../features/keywords/queries";
import { trendDataQueryOptions } from "../../features/trends/queries";
import { mentionsQueryOptions } from "../../features/mentions/queries";

export const Route = createFileRoute("/keywords/$keywordId")({
	component: KeywordDetail,
});

function KeywordDetail() {
	const { keywordId } = Route.useParams();

	const { data: keyword, isLoading: keywordLoading } = useQuery(
		keywordDetailQueryOptions(keywordId)
	);

	const { data: trend, isLoading: trendLoading } = useQuery(
		trendDataQueryOptions(keywordId)
	);

	const { data: mentions, isLoading: mentionsLoading } = useQuery(
		mentionsQueryOptions(keywordId, 20)
	);

	const isLoading = keywordLoading || trendLoading || mentionsLoading;
```

**Step 2: Verify the route still works**

Run: `cd apps/web && bun run dev`

Expected: Navigate to `/keywords/:id` and see detail page working

**Step 3: Commit keyword detail route refactor**

```bash
git add apps/web/src/routes/keywords/\$keywordId.tsx
git commit -m "refactor(web): use query options in keyword detail route"
```

---

## Task 11: Refactor Sources Route (routes/sources/index.tsx)

**Files:**
- Modify: `apps/web/src/routes/sources/index.tsx:1-119`

**Step 1: Update imports and use query options and mutation hooks**

Replace lines 1-49 in `apps/web/src/routes/sources/index.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { sourcesQueryOptions } from "../../features/sources/queries";
import { useDeleteSource } from "../../features/sources/mutations";

export const Route = createFileRoute("/sources/")({
	component: SourcesPage,
});

function SourcesPage() {
	const [sidePanelOpen, setSidePanelOpen] = useState(false);
	const [sidePanelMode, setSidePanelMode] = useState<"add" | "edit">("add");
	const [selectedSource, setSelectedSource] = useState<SourceConfigWithHealth | undefined>();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [sourceToDelete, setSourceToDelete] = useState<SourceConfigWithHealth | undefined>();

	const { data, isLoading } = useQuery(sourcesQueryOptions());

	const deleteMutation = useDeleteSource();
```

**Step 2: Update delete handler to add UI state handling**

Replace lines 68-72 in `apps/web/src/routes/sources/index.tsx`:

```typescript
	const handleConfirmDelete = () => {
		if (sourceToDelete) {
			deleteMutation.mutate(sourceToDelete.id, {
				onSuccess: () => {
					setDeleteDialogOpen(false);
					setSourceToDelete(undefined);
				},
			});
		}
	};
```

**Step 3: Verify the route still works**

Run: `cd apps/web && bun run dev`

Expected: Navigate to `/sources` and test delete

**Step 4: Commit sources route refactor**

```bash
git add apps/web/src/routes/sources/index.tsx
git commit -m "refactor(web): use query options and mutation hooks in sources route"
```

---

## Task 12: Refactor AddSourceForm Component

**Files:**
- Modify: `apps/web/src/components/sources/AddSourceForm.tsx`

**Step 1: Read current implementation**

Run: `cat apps/web/src/components/sources/AddSourceForm.tsx | grep -A 20 "useMutation"`

Expected: See current mutation implementation

**Step 2: Update imports and use mutation hook**

Find and replace the mutation section (around lines 1-50) in `apps/web/src/components/sources/AddSourceForm.tsx`:

```typescript
// Add to imports at top
import { useCreateSource } from "../../features/sources/mutations";

// Replace the useMutation call with:
const createMutation = useCreateSource();
```

**Step 3: Update onSubmit handler to add UI state handling**

Find the form's onSubmit and update to:

```typescript
onSubmit: async ({ value }) => {
  createMutation.mutate(value, {
    onSuccess: () => {
      onSuccess?.();
    },
  });
},
```

**Step 4: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 5: Commit AddSourceForm refactor**

```bash
git add apps/web/src/components/sources/AddSourceForm.tsx
git commit -m "refactor(web): use useCreateSource hook in AddSourceForm"
```

---

## Task 13: Refactor EditSourceForm Component

**Files:**
- Modify: `apps/web/src/components/sources/EditSourceForm.tsx`

**Step 1: Read current implementation**

Run: `cat apps/web/src/components/sources/EditSourceForm.tsx | grep -A 20 "useMutation"`

Expected: See current mutation implementation

**Step 2: Update imports and use mutation hook**

Find and replace the mutation section in `apps/web/src/components/sources/EditSourceForm.tsx`:

```typescript
// Add to imports at top
import { useUpdateSource } from "../../features/sources/mutations";

// Replace the useMutation call with:
const updateMutation = useUpdateSource();
```

**Step 3: Update onSubmit handler to add UI state handling**

Find the form's onSubmit and update to:

```typescript
onSubmit: async ({ value }) => {
  updateMutation.mutate(
    { id: source.id, data: value },
    {
      onSuccess: () => {
        onSuccess?.();
      },
    }
  );
},
```

**Step 4: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 5: Commit EditSourceForm refactor**

```bash
git add apps/web/src/components/sources/EditSourceForm.tsx
git commit -m "refactor(web): use useUpdateSource hook in EditSourceForm"
```

---

## Task 14: Refactor StatusToggle Component

**Files:**
- Modify: `apps/web/src/components/sources/StatusToggle.tsx`

**Step 1: Read current implementation**

Run: `cat apps/web/src/components/sources/StatusToggle.tsx`

Expected: See full component implementation

**Step 2: Update imports and use mutation hook**

Find and replace the mutation section in `apps/web/src/components/sources/StatusToggle.tsx`:

```typescript
// Add to imports at top
import { useToggleSourceStatus } from "../../features/sources/mutations";

// Replace the useMutation call with:
const toggleMutation = useToggleSourceStatus();
```

**Step 3: Update toggle handler**

Update the handler to use the new mutation:

```typescript
const handleToggle = (enabled: boolean) => {
  toggleMutation.mutate({ id: sourceId, enabled });
};
```

**Step 4: Verify types compile**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 5: Commit StatusToggle refactor**

```bash
git add apps/web/src/components/sources/StatusToggle.tsx
git commit -m "refactor(web): use useToggleSourceStatus hook in StatusToggle"
```

---

## Task 15: Update Frontend Documentation

**Files:**
- Modify: `docs/references/frontend.md:93-119`

**Step 1: Add queryOptions pattern to TanStack Query section**

Insert after line 93 in `docs/references/frontend.md`:

```markdown
### Query Options Pattern

Use queryOptions factory functions for all queries to ensure type safety and reusability:

```typescript
// features/keywords/queries.ts
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function keywordsQueryOptions() {
  return queryOptions({
    queryKey: ['keywords'],
    queryFn: async () => {
      const response = await apiClient.api.keywords.get();
      if (response.error) throw new Error('Failed to fetch keywords');
      return response.data;
    },
  });
}

// In components:
const { data } = useQuery(keywordsQueryOptions());
```

### Mutation Hooks Pattern

Use custom hooks for mutations to encapsulate API calls and cache invalidation:

```typescript
// features/keywords/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import type { CreateKeywordRequest } from '@trend-monitor/types';

export function useCreateKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateKeywordRequest) => {
      const response = await apiClient.api.keywords.post(data);
      if (response.error) throw new Error('Failed to create keyword');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
    },
  });
}

// In components:
const createMutation = useCreateKeyword();
createMutation.mutate(data, {
  onSuccess: () => setIsDialogOpen(false),
});
```

**Key Patterns:**
- Never write API calls directly in components
- Always use queryOptions() factory functions for queries
- Always use custom mutation hooks with built-in cache invalidation
- Component-specific side effects (UI state) go in component's onSuccess
```

**Step 2: Update the TanStack Query section**

Replace lines 93-119 with reference to the new patterns above.

**Step 3: Commit documentation update**

```bash
git add docs/references/frontend.md
git commit -m "docs: add queryOptions and mutation hooks patterns"
```

---

## Task 16: Final Verification and Testing

**Files:**
- Test: All refactored routes and components

**Step 1: Run type check**

Run: `cd apps/web && bun run type-check`

Expected: No type errors

**Step 2: Run build**

Run: `cd apps/web && bun run build`

Expected: Build succeeds

**Step 3: Start dev server and manually test**

Run: `cd apps/web && bun run dev`

Test checklist:
- [ ] Overview page loads (`/`)
- [ ] Keywords list page loads (`/keywords`)
- [ ] Create keyword works
- [ ] Delete keyword works
- [ ] Keyword detail page loads (`/keywords/:id`)
- [ ] Sources list page loads (`/sources`)
- [ ] Add source works
- [ ] Edit source works
- [ ] Toggle source status works
- [ ] Delete source works

**Step 4: Commit final verification notes**

```bash
git commit --allow-empty -m "test: verified all refactored routes and components"
```

---

## Task 17: Clean Up and Final Commit

**Step 1: Check for any unused imports**

Run: `cd apps/web && bun run type-check`

Expected: No unused import warnings

**Step 2: Format code**

Run: `cd apps/web && bun run format:fix`

Expected: All files formatted

**Step 3: Create final summary commit**

```bash
git add .
git commit -m "refactor(web): complete queryOptions and mutation hooks migration

- Created feature-based query/mutation modules
- All routes now use queryOptions() factories
- All mutations use custom hooks with cache invalidation
- Removed inline API calls from components
- Updated documentation with new patterns"
```

**Step 4: Verify git log shows clean history**

Run: `git log --oneline -20`

Expected: See all commits from this refactoring

---

## Success Criteria

- ✅ Zero inline API client calls in components
- ✅ All queries use queryOptions() factory functions
- ✅ All mutations use custom hooks
- ✅ Type checking passes
- ✅ Build succeeds
- ✅ All manual tests pass
- ✅ Documentation updated
- ✅ Clean commit history

## Notes

- This refactoring does not change any functionality
- All existing behavior should work exactly the same
- Better type safety and code organization
- Easier to test query/mutation logic in isolation
- Enables future optimizations like prefetching and optimistic updates
