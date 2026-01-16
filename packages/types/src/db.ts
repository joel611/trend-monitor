// packages/types/src/db.ts

/**
 * Database row types - matches D1 schema exactly
 */

export interface KeywordRow {
  id: string;
  name: string;
  /** JSON-encoded string array of keyword aliases */
  aliases: string;
  /** JSON-encoded string array of tags */
  tags: string;
  status: "active" | "archived";
  /** ISO 8601 datetime string */
  created_at: string;
  /** ISO 8601 datetime string */
  updated_at: string;
}

export interface MentionRow {
  id: string;
  source: "reddit" | "x" | "feed";
  source_id: string;
  title: string | null;
  content: string;
  url: string;
  author: string | null;
  /** ISO 8601 datetime string */
  created_at: string;
  /** ISO 8601 datetime string */
  fetched_at: string;
  /** JSON-encoded string array of keyword IDs */
  matched_keywords: string;
}

export interface DailyAggregateRow {
  id: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  keyword_id: string;
  source: "reddit" | "x" | "feed";
  mentions_count: number;
}
