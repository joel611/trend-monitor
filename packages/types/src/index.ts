// Domain entities
export interface Keyword {
	id: string;
	name: string;
	aliases: string[];
	tags: string[];
	status: KeywordStatus;
	createdAt: string;
	updatedAt: string;
}

export enum KeywordStatus {
	Active = "active",
	Archived = "archived",
}

export enum Source {
	Reddit = "reddit",
	X = "x",
	Feed = "feed",
}

export interface Mention {
	id: string;
	source: Source;
	sourceId: string;
	title?: string;
	content: string;
	url: string;
	author?: string;
	createdAt: string;
	fetchedAt: string;
	matchedKeywords: string[];
}

export interface DailyAggregate {
	id: string;
	date: string;
	keywordId: string;
	source: Source;
	mentionsCount: number;
}

export interface IngestionEvent {
	source: Source;
	sourceId: string;
	title?: string;
	content: string;
	url: string;
	author?: string;
	createdAt: string;
	fetchedAt: string;
	metadata?: Record<string, unknown>;
}

// RSS/Atom feed source configuration
export interface FeedSourceConfig {
	url: string; // RSS/Atom feed URL
	name: string; // Display name for the feed (e.g., "Reddit r/programming", "Hacker News")
	customUserAgent?: string; // Optional custom User-Agent for specific feeds
	feedTitle?: string; // Feed metadata from <title>
	feedDescription?: string; // Feed metadata from <description>
}

// Source configuration entity
export interface SourceConfig {
	id: string;
	type: "feed" | "x";
	config: FeedSourceConfig | Record<string, any>;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
	lastFetchAt?: string | null;
	lastSuccessAt?: string | null;
	lastErrorAt?: string | null;
	lastErrorMessage?: string | null;
	consecutiveFailures: number;
	deletedAt?: string | null;
}

// Source configuration with computed health status
export type HealthStatus = "success" | "warning" | "error";

export interface SourceConfigWithHealth extends SourceConfig {
	health: HealthStatus;
}

// Health tracking metrics for repository methods
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

export * from "./api";

// Type alias for feed validation result
export type { ValidateFeedResponse as FeedValidationResult } from "./api";
