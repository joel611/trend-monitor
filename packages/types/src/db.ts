// packages/types/src/db.ts

/**
 * Database row types - matches D1 schema exactly
 */

export interface KeywordRow {
  id: string;
  name: string;
  aliases: string; // JSON string
  tags: string; // JSON string
  status: "active" | "archived";
  created_at: string;
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
  created_at: string;
  fetched_at: string;
  matched_keywords: string; // JSON string
}

export interface DailyAggregateRow {
  id: string;
  date: string;
  keyword_id: string;
  source: "reddit" | "x" | "feed";
  mentions_count: number;
}
