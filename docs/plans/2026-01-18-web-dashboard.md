# Web Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully functional React SPA dashboard for monitoring technical trends with TanStack Router, TanStack Query, and Tailwind CSS.

**Architecture:** Pure SPA deployed to Cloudflare Pages, consuming the existing ElysiaJS API. Uses file-based routing with TanStack Router, declarative data fetching with TanStack Query, and utility-first styling with Tailwind CSS. Component-driven development with co-located tests.

**Tech Stack:** React 19, TanStack Router (file-based routing), TanStack Query (data fetching), Tailwind CSS v4 (styling), Vite (build tool), Bun (package manager), Happy DOM (testing)

---

## Prerequisites

Before starting implementation, verify:
- API worker is running locally (`cd apps/api-worker && bun run dev`)
- API is accessible at `http://localhost:8787`
- Database has sample data for testing

---

## Task 1: Set up Tailwind CSS v4

**Files:**
- Create: `apps/web/postcss.config.js`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/package.json`

**Step 1: Install Tailwind CSS v4**

Run:
```bash
cd apps/web
bun add @tailwindcss/postcss tailwindcss
```

Expected: Dependencies added to package.json

**Step 2: Create PostCSS config**

Create `apps/web/postcss.config.js`:
```js
export default {
	plugins: {
		'@tailwindcss/postcss': {}
	}
}
```

**Step 3: Update CSS with Tailwind directives**

Replace `apps/web/src/index.css` content:
```css
@import "tailwindcss";

@theme {
	--color-primary-50: oklch(0.97 0.01 252);
	--color-primary-100: oklch(0.93 0.03 252);
	--color-primary-200: oklch(0.86 0.06 252);
	--color-primary-300: oklch(0.76 0.11 252);
	--color-primary-400: oklch(0.65 0.16 252);
	--color-primary-500: oklch(0.55 0.21 252);
	--color-primary-600: oklch(0.47 0.20 252);
	--color-primary-700: oklch(0.39 0.17 252);
	--color-primary-800: oklch(0.32 0.13 252);
	--color-primary-900: oklch(0.27 0.10 252);
	--color-primary-950: oklch(0.17 0.06 252);
}

body {
	margin: 0;
	font-family: system-ui, -apple-system, sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}
```

**Step 4: Test Tailwind is working**

Run: `cd apps/web && bun run dev`
Expected: Dev server starts, Tailwind classes work in browser

**Step 5: Commit**

```bash
git add apps/web/postcss.config.js apps/web/src/index.css apps/web/package.json apps/web/bun.lockb
git commit -m "$(cat <<'EOF'
feat(web): set up Tailwind CSS v4

Configure Tailwind CSS v4 with PostCSS for the web dashboard.
Add custom primary color theme using OKLCH color space.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create API client with type safety

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/api.test.ts`

**Step 1: Write failing test**

Create `apps/web/src/lib/api.test.ts`:
```typescript
import { describe, it, expect } from "bun:test";
import { api } from "./api";

describe("API client", () => {
	it("should have correct base URL in development", () => {
		expect(api.baseURL).toBe("http://localhost:8787/api");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/api.test.ts`
Expected: FAIL with "Cannot find module './api'"

**Step 3: Create API client**

Create `apps/web/src/lib/api.ts`:
```typescript
import type {
	ListKeywordsResponse,
	CreateKeywordRequest,
	UpdateKeywordRequest,
	KeywordResponse,
	TrendsOverviewResponse,
	KeywordTrendResponse,
	ListMentionsResponse,
	MentionResponse,
} from "@trend-monitor/types";

const getBaseURL = (): string => {
	// Use environment variable if available, otherwise default to localhost
	return import.meta.env.VITE_API_URL || "http://localhost:8787/api";
};

class APIClient {
	public baseURL: string;

	constructor() {
		this.baseURL = getBaseURL();
	}

	// Keywords
	async listKeywords(params?: {
		status?: "active" | "archived";
		tag?: string;
	}): Promise<ListKeywordsResponse> {
		const searchParams = new URLSearchParams();
		if (params?.status) searchParams.set("status", params.status);
		if (params?.tag) searchParams.set("tag", params.tag);

		const url = `${this.baseURL}/keywords${searchParams.toString() ? `?${searchParams}` : ""}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch keywords: ${response.statusText}`);
		return response.json();
	}

	async getKeyword(id: string): Promise<KeywordResponse> {
		const response = await fetch(`${this.baseURL}/keywords/${id}`);
		if (!response.ok) throw new Error(`Failed to fetch keyword: ${response.statusText}`);
		return response.json();
	}

	async createKeyword(data: CreateKeywordRequest): Promise<KeywordResponse> {
		const response = await fetch(`${this.baseURL}/keywords`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
		if (!response.ok) throw new Error(`Failed to create keyword: ${response.statusText}`);
		return response.json();
	}

	async updateKeyword(id: string, data: UpdateKeywordRequest): Promise<KeywordResponse> {
		const response = await fetch(`${this.baseURL}/keywords/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
		if (!response.ok) throw new Error(`Failed to update keyword: ${response.statusText}`);
		return response.json();
	}

	async deleteKeyword(id: string): Promise<void> {
		const response = await fetch(`${this.baseURL}/keywords/${id}`, {
			method: "DELETE",
		});
		if (!response.ok) throw new Error(`Failed to delete keyword: ${response.statusText}`);
	}

	// Trends
	async getTrendsOverview(params?: {
		from?: string;
		to?: string;
	}): Promise<TrendsOverviewResponse> {
		const searchParams = new URLSearchParams();
		if (params?.from) searchParams.set("from", params.from);
		if (params?.to) searchParams.set("to", params.to);

		const url = `${this.baseURL}/trends/overview${searchParams.toString() ? `?${searchParams}` : ""}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch trends overview: ${response.statusText}`);
		return response.json();
	}

	async getKeywordTrend(
		keywordId: string,
		params?: { from?: string; to?: string; source?: "reddit" | "x" | "feed" }
	): Promise<KeywordTrendResponse> {
		const searchParams = new URLSearchParams();
		if (params?.from) searchParams.set("from", params.from);
		if (params?.to) searchParams.set("to", params.to);
		if (params?.source) searchParams.set("source", params.source);

		const url = `${this.baseURL}/trends/${keywordId}${searchParams.toString() ? `?${searchParams}` : ""}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch keyword trend: ${response.statusText}`);
		return response.json();
	}

	// Mentions
	async listMentions(params?: {
		keywordId?: string;
		source?: "reddit" | "x" | "feed";
		from?: string;
		to?: string;
		limit?: number;
		offset?: number;
	}): Promise<ListMentionsResponse> {
		const searchParams = new URLSearchParams();
		if (params?.keywordId) searchParams.set("keywordId", params.keywordId);
		if (params?.source) searchParams.set("source", params.source);
		if (params?.from) searchParams.set("from", params.from);
		if (params?.to) searchParams.set("to", params.to);
		if (params?.limit) searchParams.set("limit", params.limit.toString());
		if (params?.offset) searchParams.set("offset", params.offset.toString());

		const url = `${this.baseURL}/mentions${searchParams.toString() ? `?${searchParams}` : ""}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch mentions: ${response.statusText}`);
		return response.json();
	}

	async getMention(id: string): Promise<MentionResponse> {
		const response = await fetch(`${this.baseURL}/mentions/${id}`);
		if (!response.ok) throw new Error(`Failed to fetch mention: ${response.statusText}`);
		return response.json();
	}
}

export const api = new APIClient();
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/
git commit -m "$(cat <<'EOF'
feat(web): add type-safe API client

Create a type-safe API client for all endpoints using shared types.
Supports keywords, trends, and mentions with configurable base URL.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create reusable UI components

**Files:**
- Create: `apps/web/src/components/Card.tsx`
- Create: `apps/web/src/components/Card.test.tsx`
- Create: `apps/web/src/components/Badge.tsx`
- Create: `apps/web/src/components/Badge.test.tsx`
- Create: `apps/web/src/components/Button.tsx`
- Create: `apps/web/src/components/Button.test.tsx`

**Step 1: Write failing test for Card**

Create `apps/web/src/components/Card.test.tsx`:
```typescript
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
	it("should render children", () => {
		const { container } = render(<Card>Test content</Card>);
		expect(container.textContent).toBe("Test content");
	});

	it("should apply className", () => {
		const { container } = render(<Card className="custom-class">Test</Card>);
		const card = container.firstChild as HTMLElement;
		expect(card.className).toContain("custom-class");
	});
});
```

**Step 2: Install testing library**

Run:
```bash
cd apps/web
bun add -D @testing-library/react @testing-library/dom
```

**Step 3: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/Card.test.tsx`
Expected: FAIL with "Cannot find module './Card'"

**Step 4: Create Card component**

Create `apps/web/src/components/Card.tsx`:
```typescript
import type { ReactNode } from "react";

interface CardProps {
	children: ReactNode;
	className?: string;
}

export function Card({ children, className = "" }: CardProps) {
	return (
		<div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
			{children}
		</div>
	);
}
```

**Step 5: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/Card.test.tsx`
Expected: PASS

**Step 6: Write failing test for Badge**

Create `apps/web/src/components/Badge.test.tsx`:
```typescript
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
	it("should render text", () => {
		const { container } = render(<Badge>Test</Badge>);
		expect(container.textContent).toBe("Test");
	});

	it("should apply variant styles", () => {
		const { container } = render(<Badge variant="success">Success</Badge>);
		const badge = container.firstChild as HTMLElement;
		expect(badge.className).toContain("bg-green-100");
	});
});
```

**Step 7: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/Badge.test.tsx`
Expected: FAIL with "Cannot find module './Badge'"

**Step 8: Create Badge component**

Create `apps/web/src/components/Badge.tsx`:
```typescript
import type { ReactNode } from "react";

interface BadgeProps {
	children: ReactNode;
	variant?: "default" | "success" | "warning" | "danger";
	className?: string;
}

const variantStyles = {
	default: "bg-gray-100 text-gray-800",
	success: "bg-green-100 text-green-800",
	warning: "bg-yellow-100 text-yellow-800",
	danger: "bg-red-100 text-red-800",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
		>
			{children}
		</span>
	);
}
```

**Step 9: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/Badge.test.tsx`
Expected: PASS

**Step 10: Write failing test for Button**

Create `apps/web/src/components/Button.test.tsx`:
```typescript
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
	it("should render children", () => {
		const { container } = render(<Button>Click me</Button>);
		expect(container.textContent).toBe("Click me");
	});

	it("should apply variant styles", () => {
		const { container } = render(<Button variant="primary">Primary</Button>);
		const button = container.firstChild as HTMLElement;
		expect(button.className).toContain("bg-primary-600");
	});

	it("should handle disabled state", () => {
		const { container } = render(<Button disabled>Disabled</Button>);
		const button = container.firstChild as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.className).toContain("opacity-50");
	});
});
```

**Step 11: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/Button.test.tsx`
Expected: FAIL with "Cannot find module './Button'"

**Step 12: Create Button component**

Create `apps/web/src/components/Button.tsx`:
```typescript
import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	variant?: "primary" | "secondary" | "danger";
	size?: "sm" | "md" | "lg";
}

const variantStyles = {
	primary: "bg-primary-600 hover:bg-primary-700 text-white",
	secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
	danger: "bg-red-600 hover:bg-red-700 text-white",
};

const sizeStyles = {
	sm: "px-3 py-1.5 text-sm",
	md: "px-4 py-2 text-base",
	lg: "px-6 py-3 text-lg",
};

export function Button({
	children,
	variant = "primary",
	size = "md",
	className = "",
	disabled,
	...props
}: ButtonProps) {
	return (
		<button
			className={`inline-flex items-center justify-center font-medium rounded-md transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
			disabled={disabled}
			{...props}
		>
			{children}
		</button>
	);
}
```

**Step 13: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/Button.test.tsx`
Expected: PASS

**Step 14: Commit**

```bash
git add apps/web/src/components/ apps/web/package.json apps/web/bun.lockb
git commit -m "$(cat <<'EOF'
feat(web): add reusable UI components

Add Card, Badge, and Button components with variants and tests.
Components use Tailwind for styling and are fully typed.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create app layout with navigation

**Files:**
- Create: `apps/web/src/components/Layout.tsx`
- Create: `apps/web/src/components/Layout.test.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

**Step 1: Write failing test**

Create `apps/web/src/components/Layout.test.tsx`:
```typescript
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { Layout } from "./Layout";

describe("Layout", () => {
	it("should render navigation and children", () => {
		const { container, getByText } = render(
			<Layout>
				<div>Test content</div>
			</Layout>
		);
		expect(getByText("Trend Monitor")).toBeTruthy();
		expect(getByText("Test content")).toBeTruthy();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/Layout.test.tsx`
Expected: FAIL with "Cannot find module './Layout'"

**Step 3: Create Layout component**

Create `apps/web/src/components/Layout.tsx`:
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

**Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/Layout.test.tsx`
Expected: PASS (may need to mock TanStack Router)

**Step 5: Update root route to use Layout**

Modify `apps/web/src/routes/__root.tsx`:
```typescript
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Layout } from "../components/Layout";

export const Route = createRootRoute({
	component: () => (
		<Layout>
			<Outlet />
		</Layout>
	),
});
```

**Step 6: Test in browser**

Run: `cd apps/web && bun run dev`
Expected: Navigation visible with "Trend Monitor" title and menu links

**Step 7: Commit**

```bash
git add apps/web/src/components/Layout.tsx apps/web/src/components/Layout.test.tsx apps/web/src/routes/__root.tsx
git commit -m "$(cat <<'EOF'
feat(web): add layout with navigation

Create Layout component with navigation header and apply to root route.
Includes responsive design and active link highlighting.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create Overview (Home) page

**Files:**
- Modify: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/components/StatsCard.tsx`
- Create: `apps/web/src/components/TrendsList.tsx`

**Step 1: Create StatsCard component**

Create `apps/web/src/components/StatsCard.tsx`:
```typescript
import { Card } from "./Card";

interface StatsCardProps {
	title: string;
	value: string | number;
	trend?: {
		value: number;
		isPositive: boolean;
	};
}

export function StatsCard({ title, value, trend }: StatsCardProps) {
	return (
		<Card>
			<div className="flex flex-col">
				<dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
				<dd className="mt-1 flex items-baseline">
					<span className="text-3xl font-semibold text-gray-900">{value}</span>
					{trend && (
						<span
							className={`ml-2 text-sm font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}
						>
							{trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
						</span>
					)}
				</dd>
			</div>
		</Card>
	);
}
```

**Step 2: Create TrendsList component**

Create `apps/web/src/components/TrendsList.tsx`:
```typescript
import { Link } from "@tanstack/react-router";
import { Badge } from "./Badge";
import { Card } from "./Card";
import type { TrendKeyword } from "@trend-monitor/types";

interface TrendsListProps {
	title: string;
	keywords: TrendKeyword[];
	showGrowth?: boolean;
}

export function TrendsList({ title, keywords, showGrowth = true }: TrendsListProps) {
	if (keywords.length === 0) {
		return (
			<Card>
				<h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
				<p className="text-gray-500 text-sm">No trends to display</p>
			</Card>
		);
	}

	return (
		<Card>
			<h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
			<div className="space-y-3">
				{keywords.map((keyword) => (
					<Link
						key={keyword.keywordId}
						to="/keywords/$keywordId"
						params={{ keywordId: keyword.keywordId }}
						className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<span className="font-medium text-gray-900">{keyword.name}</span>
								{keyword.isEmerging && (
									<Badge variant="success">Emerging</Badge>
								)}
							</div>
							<div className="flex items-center space-x-4 text-sm">
								<span className="text-gray-600">
									{keyword.currentPeriod} mentions
								</span>
								{showGrowth && keyword.growthRate !== 0 && (
									<span
										className={`font-medium ${keyword.growthRate > 0 ? "text-green-600" : "text-red-600"}`}
									>
										{keyword.growthRate > 0 ? "↑" : "↓"}{" "}
										{Math.abs(keyword.growthRate).toFixed(1)}%
									</span>
								)}
							</div>
						</div>
					</Link>
				))}
			</div>
		</Card>
	);
}
```

**Step 3: Update index route with TanStack Query**

Modify `apps/web/src/routes/index.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatsCard } from "../components/StatsCard";
import { TrendsList } from "../components/TrendsList";

export const Route = createFileRoute("/")({
	component: Overview,
});

function Overview() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["trends", "overview"],
		queryFn: () => api.getTrendsOverview(),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading trends...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Error loading trends: {error.message}</div>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-gray-900">Trends Overview</h1>
				<p className="mt-2 text-gray-600">
					Monitor technical keywords and emerging trends across multiple sources
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<StatsCard title="Total Mentions" value={data.totalMentions} />
				<StatsCard
					title="Active Keywords"
					value={data.topKeywords.length}
				/>
				<StatsCard
					title="Emerging Topics"
					value={data.emergingKeywords.length}
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<TrendsList title="Top Keywords" keywords={data.topKeywords} />
				<TrendsList
					title="Emerging Keywords"
					keywords={data.emergingKeywords}
				/>
			</div>

			{data.sourceBreakdown.length > 0 && (
				<div className="bg-white rounded-lg shadow-md p-6">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">
						Source Breakdown
					</h2>
					<div className="space-y-3">
						{data.sourceBreakdown.map((item) => (
							<div key={item.source} className="flex items-center justify-between">
								<span className="text-gray-700 capitalize">{item.source}</span>
								<span className="text-gray-900 font-medium">{item.count} mentions</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
```

**Step 4: Test in browser**

Run: `cd apps/web && bun run dev`
Expected: Overview page displays with stats and trends (may show empty state if no data)

**Step 5: Commit**

```bash
git add apps/web/src/routes/index.tsx apps/web/src/components/StatsCard.tsx apps/web/src/components/TrendsList.tsx
git commit -m "$(cat <<'EOF'
feat(web): implement overview page with trends

Add overview page showing stats cards, top keywords, and emerging trends.
Uses TanStack Query for data fetching with loading and error states.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create Keywords list page

**Files:**
- Create: `apps/web/src/routes/keywords/index.tsx`
- Create: `apps/web/src/components/KeywordsList.tsx`

**Step 1: Create KeywordsList component**

Create `apps/web/src/components/KeywordsList.tsx`:
```typescript
import { Link } from "@tanstack/react-router";
import { Badge } from "./Badge";
import type { KeywordResponse } from "@trend-monitor/types";

interface KeywordsListProps {
	keywords: KeywordResponse[];
	onDelete?: (id: string) => void;
}

export function KeywordsList({ keywords, onDelete }: KeywordsListProps) {
	if (keywords.length === 0) {
		return (
			<div className="text-center py-12">
				<h3 className="text-lg font-medium text-gray-900 mb-2">No keywords yet</h3>
				<p className="text-gray-500">Create your first keyword to start monitoring trends</p>
			</div>
		);
	}

	return (
		<div className="bg-white shadow-md rounded-lg overflow-hidden">
			<table className="min-w-full divide-y divide-gray-200">
				<thead className="bg-gray-50">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Name
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Tags
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Aliases
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
					{keywords.map((keyword) => (
						<tr key={keyword.id} className="hover:bg-gray-50">
							<td className="px-6 py-4 whitespace-nowrap">
								<Link
									to="/keywords/$keywordId"
									params={{ keywordId: keyword.id }}
									className="text-primary-600 hover:text-primary-900 font-medium"
								>
									{keyword.name}
								</Link>
							</td>
							<td className="px-6 py-4">
								<div className="flex flex-wrap gap-1">
									{keyword.tags.length > 0 ? (
										keyword.tags.map((tag) => (
											<Badge key={tag} variant="default">
												{tag}
											</Badge>
										))
									) : (
										<span className="text-gray-400 text-sm">—</span>
									)}
								</div>
							</td>
							<td className="px-6 py-4">
								<div className="text-sm text-gray-600">
									{keyword.aliases.length > 0 ? (
										keyword.aliases.join(", ")
									) : (
										<span className="text-gray-400">—</span>
									)}
								</div>
							</td>
							<td className="px-6 py-4 whitespace-nowrap">
								<Badge variant={keyword.status === "active" ? "success" : "default"}>
									{keyword.status}
								</Badge>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<Link
									to="/keywords/$keywordId"
									params={{ keywordId: keyword.id }}
									className="text-primary-600 hover:text-primary-900 mr-4"
								>
									View
								</Link>
								{onDelete && (
									<button
										onClick={() => onDelete(keyword.id)}
										className="text-red-600 hover:text-red-900"
									>
										Delete
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
```

**Step 2: Create keywords list route**

Create `apps/web/src/routes/keywords/index.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";
import { KeywordsList } from "../../components/KeywordsList";

export const Route = createFileRoute("/keywords/")({
	component: Keywords,
});

function Keywords() {
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["keywords"],
		queryFn: () => api.listKeywords(),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.deleteKeyword(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
		},
	});

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to archive this keyword?")) {
			deleteMutation.mutate(id);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading keywords...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Error loading keywords: {error.message}</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Keywords</h1>
					<p className="mt-2 text-gray-600">
						Manage your monitored keywords and their aliases
					</p>
				</div>
				<Button>Add Keyword</Button>
			</div>

			{data && <KeywordsList keywords={data.keywords} onDelete={handleDelete} />}
		</div>
	);
}
```

**Step 3: Test in browser**

Run: `cd apps/web && bun run dev`
Expected: Keywords page shows list or empty state with "Add Keyword" button

**Step 4: Commit**

```bash
git add apps/web/src/routes/keywords/ apps/web/src/components/KeywordsList.tsx
git commit -m "$(cat <<'EOF'
feat(web): implement keywords list page

Add keywords list page with table view showing name, tags, aliases, and status.
Includes delete functionality with optimistic updates.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create Keyword detail page with trend chart

**Files:**
- Create: `apps/web/src/routes/keywords/$keywordId.tsx`
- Create: `apps/web/src/components/TrendChart.tsx`
- Create: `apps/web/src/components/MentionsList.tsx`

**Step 1: Install chart library**

Run:
```bash
cd apps/web
bun add recharts
```

**Step 2: Create TrendChart component**

Create `apps/web/src/components/TrendChart.tsx`:
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TimeSeriesDataPoint } from "@trend-monitor/types";

interface TrendChartProps {
	data: TimeSeriesDataPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
	if (data.length === 0) {
		return (
			<div className="h-64 flex items-center justify-center text-gray-500">
				No data to display
			</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={300}>
			<LineChart data={data}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis
					dataKey="date"
					tickFormatter={(value) => new Date(value).toLocaleDateString()}
				/>
				<YAxis />
				<Tooltip
					labelFormatter={(value) => new Date(value).toLocaleDateString()}
					formatter={(value: number) => [value, "Mentions"]}
				/>
				<Line
					type="monotone"
					dataKey="count"
					stroke="#4f46e5"
					strokeWidth={2}
					dot={{ fill: "#4f46e5" }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
```

**Step 3: Create MentionsList component**

Create `apps/web/src/components/MentionsList.tsx`:
```typescript
import { Badge } from "./Badge";
import type { MentionResponse } from "@trend-monitor/types";

interface MentionsListProps {
	mentions: MentionResponse[];
}

export function MentionsList({ mentions }: MentionsListProps) {
	if (mentions.length === 0) {
		return (
			<div className="text-center py-12 text-gray-500">
				No mentions found
			</div>
		);
	}

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	return (
		<div className="space-y-4">
			{mentions.map((mention) => (
				<div
					key={mention.id}
					className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
				>
					<div className="flex items-start justify-between mb-2">
						<div className="flex-1">
							{mention.title && (
								<h3 className="font-medium text-gray-900 mb-1">
									{mention.title}
								</h3>
							)}
							<p className="text-sm text-gray-600 line-clamp-3">
								{mention.content}
							</p>
						</div>
						<Badge variant="default">{mention.source}</Badge>
					</div>
					<div className="flex items-center justify-between mt-3 text-sm">
						<div className="flex items-center space-x-4 text-gray-500">
							{mention.author && <span>By {mention.author}</span>}
							<span>{formatDate(mention.createdAt)}</span>
						</div>
						<a
							href={mention.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary-600 hover:text-primary-900"
						>
							View source →
						</a>
					</div>
				</div>
			))}
		</div>
	);
}
```

**Step 4: Create keyword detail route**

Create `apps/web/src/routes/keywords/$keywordId.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { TrendChart } from "../../components/TrendChart";
import { MentionsList } from "../../components/MentionsList";

export const Route = createFileRoute("/keywords/$keywordId")({
	component: KeywordDetail,
});

function KeywordDetail() {
	const { keywordId } = Route.useParams();

	const { data: keyword, isLoading: keywordLoading } = useQuery({
		queryKey: ["keywords", keywordId],
		queryFn: () => api.getKeyword(keywordId),
	});

	const { data: trend, isLoading: trendLoading } = useQuery({
		queryKey: ["trends", keywordId],
		queryFn: () => api.getKeywordTrend(keywordId),
	});

	const { data: mentions, isLoading: mentionsLoading } = useQuery({
		queryKey: ["mentions", keywordId],
		queryFn: () => api.listMentions({ keywordId, limit: 20 }),
	});

	const isLoading = keywordLoading || trendLoading || mentionsLoading;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading keyword details...</div>
			</div>
		);
	}

	if (!keyword || !trend) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Keyword not found</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center space-x-3 mb-2">
					<h1 className="text-3xl font-bold text-gray-900">{keyword.name}</h1>
					<Badge variant={keyword.status === "active" ? "success" : "default"}>
						{keyword.status}
					</Badge>
				</div>
				{keyword.tags.length > 0 && (
					<div className="flex flex-wrap gap-2 mt-2">
						{keyword.tags.map((tag) => (
							<Badge key={tag} variant="default">
								{tag}
							</Badge>
						))}
					</div>
				)}
				{keyword.aliases.length > 0 && (
					<p className="mt-2 text-gray-600">
						Aliases: {keyword.aliases.join(", ")}
					</p>
				)}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card>
					<div className="text-sm font-medium text-gray-500">Total Mentions</div>
					<div className="mt-1 text-3xl font-semibold text-gray-900">
						{trend.totalMentions}
					</div>
				</Card>
				<Card>
					<div className="text-sm font-medium text-gray-500">Average per Day</div>
					<div className="mt-1 text-3xl font-semibold text-gray-900">
						{trend.averagePerDay.toFixed(1)}
					</div>
				</Card>
				<Card>
					<div className="text-sm font-medium text-gray-500">Data Points</div>
					<div className="mt-1 text-3xl font-semibold text-gray-900">
						{trend.timeSeries.length}
					</div>
				</Card>
			</div>

			<Card>
				<h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Over Time</h2>
				<TrendChart data={trend.timeSeries} />
			</Card>

			<div>
				<h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Mentions</h2>
				{mentions && <MentionsList mentions={mentions.mentions} />}
			</div>
		</div>
	);
}
```

**Step 5: Test in browser**

Run: `cd apps/web && bun run dev`
Expected: Keyword detail page shows stats, chart, and mentions list

**Step 6: Commit**

```bash
git add apps/web/src/routes/keywords/ apps/web/src/components/TrendChart.tsx apps/web/src/components/MentionsList.tsx apps/web/package.json apps/web/bun.lockb
git commit -m "$(cat <<'EOF'
feat(web): implement keyword detail page with charts

Add keyword detail page showing trend chart with Recharts and mentions list.
Includes stats cards for total, average, and data points.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add keyword creation modal

**Files:**
- Create: `apps/web/src/components/Modal.tsx`
- Create: `apps/web/src/components/KeywordForm.tsx`
- Modify: `apps/web/src/routes/keywords/index.tsx`

**Step 1: Create Modal component**

Create `apps/web/src/components/Modal.tsx`:
```typescript
import { useEffect, type ReactNode } from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "unset";
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto">
			<div className="flex min-h-screen items-center justify-center p-4">
				<div
					className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
					onClick={onClose}
				/>
				<div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-semibold text-gray-900">{title}</h2>
						<button
							onClick={onClose}
							className="text-gray-400 hover:text-gray-600"
						>
							<span className="text-2xl">&times;</span>
						</button>
					</div>
					{children}
				</div>
			</div>
		</div>
	);
}
```

**Step 2: Create KeywordForm component**

Create `apps/web/src/components/KeywordForm.tsx`:
```typescript
import { useState } from "react";
import { Button } from "./Button";
import type { CreateKeywordRequest } from "@trend-monitor/types";

interface KeywordFormProps {
	onSubmit: (data: CreateKeywordRequest) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export function KeywordForm({ onSubmit, onCancel, isSubmitting }: KeywordFormProps) {
	const [name, setName] = useState("");
	const [aliases, setAliases] = useState("");
	const [tags, setTags] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const data: CreateKeywordRequest = {
			name: name.trim(),
			aliases: aliases
				.split(",")
				.map((a) => a.trim())
				.filter(Boolean),
			tags: tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
		};

		onSubmit(data);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
					Name *
				</label>
				<input
					type="text"
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
					placeholder="e.g., ElysiaJS"
				/>
			</div>

			<div>
				<label htmlFor="aliases" className="block text-sm font-medium text-gray-700 mb-1">
					Aliases (comma-separated)
				</label>
				<input
					type="text"
					id="aliases"
					value={aliases}
					onChange={(e) => setAliases(e.target.value)}
					className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
					placeholder="e.g., Elysia, elysia.js"
				/>
			</div>

			<div>
				<label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
					Tags (comma-separated)
				</label>
				<input
					type="text"
					id="tags"
					value={tags}
					onChange={(e) => setTags(e.target.value)}
					className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
					placeholder="e.g., framework, backend"
				/>
			</div>

			<div className="flex justify-end space-x-3 pt-4">
				<Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Creating..." : "Create Keyword"}
				</Button>
			</div>
		</form>
	);
}
```

**Step 3: Update keywords list route to use modal**

Modify `apps/web/src/routes/keywords/index.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";
import { KeywordsList } from "../../components/KeywordsList";
import { Modal } from "../../components/Modal";
import { KeywordForm } from "../../components/KeywordForm";
import type { CreateKeywordRequest } from "@trend-monitor/types";

export const Route = createFileRoute("/keywords/")({
	component: Keywords,
});

function Keywords() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["keywords"],
		queryFn: () => api.listKeywords(),
	});

	const createMutation = useMutation({
		mutationFn: (data: CreateKeywordRequest) => api.createKeyword(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
			setIsModalOpen(false);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.deleteKeyword(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
		},
	});

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to archive this keyword?")) {
			deleteMutation.mutate(id);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading keywords...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Error loading keywords: {error.message}</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Keywords</h1>
					<p className="mt-2 text-gray-600">
						Manage your monitored keywords and their aliases
					</p>
				</div>
				<Button onClick={() => setIsModalOpen(true)}>Add Keyword</Button>
			</div>

			{data && <KeywordsList keywords={data.keywords} onDelete={handleDelete} />}

			<Modal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title="Add New Keyword"
			>
				<KeywordForm
					onSubmit={(data) => createMutation.mutate(data)}
					onCancel={() => setIsModalOpen(false)}
					isSubmitting={createMutation.isPending}
				/>
			</Modal>
		</div>
	);
}
```

**Step 4: Test in browser**

Run: `cd apps/web && bun run dev`
Expected: Click "Add Keyword" opens modal, form submits and creates keyword

**Step 5: Commit**

```bash
git add apps/web/src/components/Modal.tsx apps/web/src/components/KeywordForm.tsx apps/web/src/routes/keywords/index.tsx
git commit -m "$(cat <<'EOF'
feat(web): add keyword creation modal

Add modal with form for creating keywords. Includes validation,
optimistic updates, and proper loading states.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add environment variable configuration

**Files:**
- Create: `apps/web/.env.example`
- Create: `apps/web/.env.local`
- Modify: `apps/web/vite.config.ts`

**Step 1: Create environment variable example**

Create `apps/web/.env.example`:
```env
# API Configuration
VITE_API_URL=http://localhost:8787/api
```

**Step 2: Create local environment file**

Create `apps/web/.env.local`:
```env
VITE_API_URL=http://localhost:8787/api
```

**Step 3: Update Vite config for environment variables**

Modify `apps/web/vite.config.ts`:
```typescript
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		plugins: [
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
			}),
			react(),
		],
		server: {
			port: 5173,
		},
		define: {
			"import.meta.env.VITE_API_URL": JSON.stringify(
				env.VITE_API_URL || "http://localhost:8787/api"
			),
		},
	};
});
```

**Step 4: Update .gitignore**

Run:
```bash
cd apps/web
echo ".env.local" >> .gitignore
```

**Step 5: Test environment variable**

Run: `cd apps/web && bun run dev`
Expected: API client uses configured base URL

**Step 6: Commit**

```bash
git add apps/web/.env.example apps/web/vite.config.ts apps/web/.gitignore
git commit -m "$(cat <<'EOF'
feat(web): add environment variable configuration

Add .env support for configuring API URL. Includes example file
and Vite configuration for environment variable handling.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add error boundary and 404 page

**Files:**
- Create: `apps/web/src/components/ErrorBoundary.tsx`
- Create: `apps/web/src/routes/404.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

**Step 1: Create ErrorBoundary component**

Create `apps/web/src/components/ErrorBoundary.tsx`:
```typescript
import { Component, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-gray-50">
					<div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
						<h1 className="text-2xl font-bold text-red-600 mb-4">
							Something went wrong
						</h1>
						<p className="text-gray-600 mb-4">
							{this.state.error?.message || "An unexpected error occurred"}
						</p>
						<Button onClick={() => window.location.reload()}>
							Reload Page
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
```

**Step 2: Create 404 page**

Create `apps/web/src/routes/404.tsx`:
```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "../components/Button";

export const Route = createFileRoute("/404")({
	component: NotFound,
});

function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center h-96">
			<h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
			<p className="text-xl text-gray-600 mb-8">Page not found</p>
			<Link to="/">
				<Button>Go to Homepage</Button>
			</Link>
		</div>
	);
}
```

**Step 3: Update root route to use ErrorBoundary**

Modify `apps/web/src/routes/__root.tsx`:
```typescript
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { ErrorBoundary } from "../components/ErrorBoundary";

export const Route = createRootRoute({
	component: () => (
		<ErrorBoundary>
			<Layout>
				<Outlet />
			</Layout>
		</ErrorBoundary>
	),
});
```

**Step 4: Test error handling**

Run: `cd apps/web && bun run dev`
Expected: Navigate to unknown route shows 404 page

**Step 5: Commit**

```bash
git add apps/web/src/components/ErrorBoundary.tsx apps/web/src/routes/404.tsx apps/web/src/routes/__root.tsx
git commit -m "$(cat <<'EOF'
feat(web): add error boundary and 404 page

Add error boundary for runtime errors and 404 page for unknown routes.
Provides user-friendly error messages and navigation.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add loading states and skeletons

**Files:**
- Create: `apps/web/src/components/Skeleton.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/routes/keywords/index.tsx`

**Step 1: Create Skeleton component**

Create `apps/web/src/components/Skeleton.tsx`:
```typescript
interface SkeletonProps {
	className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
	return (
		<div
			className={`animate-pulse bg-gray-200 rounded ${className}`}
		/>
	);
}

export function SkeletonCard() {
	return (
		<div className="bg-white rounded-lg shadow-md p-6">
			<Skeleton className="h-4 w-24 mb-2" />
			<Skeleton className="h-8 w-32" />
		</div>
	);
}

export function SkeletonTable() {
	return (
		<div className="bg-white shadow-md rounded-lg overflow-hidden p-6">
			<div className="space-y-3">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="flex items-center space-x-4">
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-16" />
					</div>
				))}
			</div>
		</div>
	);
}
```

**Step 2: Update Overview page with skeleton**

Modify `apps/web/src/routes/index.tsx` loading state:
```typescript
if (isLoading) {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-gray-900">Trends Overview</h1>
				<p className="mt-2 text-gray-600">Loading...</p>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<SkeletonCard />
				<SkeletonCard />
				<SkeletonCard />
			</div>
		</div>
	);
}
```

**Step 3: Update Keywords page with skeleton**

Modify `apps/web/src/routes/keywords/index.tsx` loading state:
```typescript
if (isLoading) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Keywords</h1>
					<p className="mt-2 text-gray-600">Loading...</p>
				</div>
			</div>
			<SkeletonTable />
		</div>
	);
}
```

**Step 4: Add imports to both files**

Add to top of both files:
```typescript
import { SkeletonCard, SkeletonTable } from "../components/Skeleton";
```

**Step 5: Test loading states**

Run: `cd apps/web && bun run dev`
Expected: Skeleton loaders appear briefly while data loads

**Step 6: Commit**

```bash
git add apps/web/src/components/Skeleton.tsx apps/web/src/routes/index.tsx apps/web/src/routes/keywords/index.tsx
git commit -m "$(cat <<'EOF'
feat(web): add loading skeletons

Add skeleton components for better loading UX. Applied to overview
and keywords pages with animated placeholders.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Add comprehensive tests

**Files:**
- Create: `apps/web/src/routes/index.test.tsx`
- Create: `apps/web/src/routes/keywords/index.test.tsx`

**Step 1: Write test for Overview page**

Create `apps/web/src/routes/index.test.tsx`:
```typescript
import { describe, it, expect, mock } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "../lib/api";

// Mock the route component
const Overview = () => {
	const { useQuery } = require("@tanstack/react-query");
	const { StatsCard } = require("../components/StatsCard");

	const { data, isLoading } = useQuery({
		queryKey: ["trends", "overview"],
		queryFn: () => api.getTrendsOverview(),
	});

	if (isLoading) return <div>Loading...</div>;
	if (!data) return null;

	return (
		<div>
			<StatsCard title="Total Mentions" value={data.totalMentions} />
		</div>
	);
};

describe("Overview page", () => {
	it("should show loading state initially", () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const { getByText } = render(
			<QueryClientProvider client={queryClient}>
				<Overview />
			</QueryClientProvider>
		);

		expect(getByText("Loading...")).toBeTruthy();
	});
});
```

**Step 2: Run tests**

Run: `cd apps/web && bun test src/routes/index.test.tsx`
Expected: Tests pass

**Step 3: Write test for Keywords page**

Create `apps/web/src/routes/keywords/index.test.tsx`:
```typescript
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { KeywordsList } from "../../components/KeywordsList";

describe("Keywords page", () => {
	it("should show empty state when no keywords", () => {
		const { getByText } = render(<KeywordsList keywords={[]} />);
		expect(getByText("No keywords yet")).toBeTruthy();
	});

	it("should render keywords list", () => {
		const keywords = [
			{
				id: "1",
				name: "ElysiaJS",
				aliases: ["Elysia"],
				tags: ["framework"],
				status: "active" as const,
				createdAt: "2024-01-01",
				updatedAt: "2024-01-01",
			},
		];

		const { getByText } = render(<KeywordsList keywords={keywords} />);
		expect(getByText("ElysiaJS")).toBeTruthy();
	});
});
```

**Step 4: Run tests**

Run: `cd apps/web && bun test src/routes/keywords/index.test.tsx`
Expected: Tests pass

**Step 5: Run all tests**

Run: `cd apps/web && bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add apps/web/src/routes/index.test.tsx apps/web/src/routes/keywords/index.test.tsx
git commit -m "$(cat <<'EOF'
test(web): add route tests

Add tests for Overview and Keywords pages covering loading states
and rendering with data.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Add deployment configuration

**Files:**
- Create: `apps/web/wrangler.toml`
- Create: `apps/web/.dev.vars.example`
- Modify: `apps/web/package.json`

**Step 1: Create Wrangler config for Cloudflare Pages**

Create `apps/web/wrangler.toml`:
```toml
name = "trend-monitor-web"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[site]
bucket = "./dist"

[[pages.rules]]
pattern = "/*"
ignore = false
```

**Step 2: Add deployment scripts**

Modify `apps/web/package.json` scripts section to add:
```json
"deploy:preview": "bun run build && wrangler pages deploy dist --project-name=trend-monitor-web",
"deploy:production": "bun run build && wrangler pages deploy dist --project-name=trend-monitor-web --branch=main"
```

**Step 3: Create deployment environment example**

Create `apps/web/.dev.vars.example`:
```env
# Production API URL
VITE_API_URL=https://api.trend-monitor.workers.dev/api
```

**Step 4: Test build**

Run: `cd apps/web && bun run build`
Expected: Build succeeds, dist/ folder created

**Step 5: Commit**

```bash
git add apps/web/wrangler.toml apps/web/.dev.vars.example apps/web/package.json
git commit -m "$(cat <<'EOF'
feat(web): add Cloudflare Pages deployment config

Add Wrangler configuration for deploying to Cloudflare Pages.
Includes preview and production deployment scripts.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Update root README with web app info

**Files:**
- Modify: `README.md` (project root)

**Step 1: Add web app section to README**

Add to root `README.md` after the API worker section:
```markdown
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
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add web dashboard documentation

Update README with web app development, testing, and deployment info.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Completion Checklist

After implementing all tasks:

- [ ] Overview page displays trends and stats
- [ ] Keywords page shows list with CRUD operations
- [ ] Keyword detail page shows trend chart and mentions
- [ ] API client handles all endpoints with type safety
- [ ] UI components (Card, Badge, Button, Modal) are reusable
- [ ] Loading states use skeleton loaders
- [ ] Error boundary catches runtime errors
- [ ] 404 page handles unknown routes
- [ ] Tests cover main components and routes
- [ ] Environment variables configured
- [ ] Tailwind CSS v4 styling applied
- [ ] Deployment configuration ready for Cloudflare Pages

**Final verification:**

Run from project root:
```bash
cd apps/web
bun run typecheck  # No type errors
bun test           # All tests pass
bun run build      # Build succeeds
```

---

## Post-Implementation

Once all tasks are complete:

1. **Manual testing**: Navigate through all pages in browser
2. **API integration**: Verify API worker is running and responding
3. **Responsive testing**: Test on mobile viewport sizes
4. **Accessibility**: Check keyboard navigation and screen reader support
5. **Performance**: Check bundle size and loading times

**Next steps:**
- Add date range filters for trends
- Implement keyword editing
- Add pagination for mentions list
- Add real-time updates with WebSockets
- Add export functionality (CSV, JSON)
