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
}

export * from "./api";
