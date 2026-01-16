// packages/types/src/db.test.ts
import { describe, expect, test } from "bun:test";
import type { KeywordRow, MentionRow, DailyAggregateRow } from "./db";

describe("Database Types", () => {
  test("KeywordRow has all required fields", () => {
    const row: KeywordRow = {
      id: "kw-1",
      name: "test",
      aliases: "[]",
      tags: "[]",
      status: "active",
      created_at: "2026-01-16T00:00:00Z",
      updated_at: "2026-01-16T00:00:00Z",
    };
    expect(row.id).toBe("kw-1");
  });

  test("MentionRow has all required fields", () => {
    const row: MentionRow = {
      id: "m-1",
      source: "reddit",
      source_id: "abc123",
      title: "Test",
      content: "Content",
      url: "https://example.com",
      author: "user",
      created_at: "2026-01-16T00:00:00Z",
      fetched_at: "2026-01-16T00:00:00Z",
      matched_keywords: "[]",
    };
    expect(row.source).toBe("reddit");
  });

  test("DailyAggregateRow has all required fields", () => {
    const row: DailyAggregateRow = {
      id: "da-1",
      date: "2026-01-16",
      keyword_id: "kw-1",
      source: "reddit",
      mentions_count: 42,
    };
    expect(row.mentions_count).toBe(42);
  });

  test("MentionRow handles nullable fields", () => {
    const row: MentionRow = {
      id: "m-2",
      source: "x",
      source_id: "xyz789",
      title: null,
      content: "Content",
      url: "https://example.com",
      author: null,
      created_at: "2026-01-16T00:00:00Z",
      fetched_at: "2026-01-16T00:00:00Z",
      matched_keywords: "[]",
    };
    expect(row.title).toBeNull();
    expect(row.author).toBeNull();
  });
});
