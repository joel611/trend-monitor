import { describe, expect, test, beforeEach } from "bun:test";
import { TrendsService } from "./trends-service";
import { createMockDB } from "../lib/db/mock";
import type { DbClient } from "../lib/db/client";
import { keywords, dailyAggregates } from "../lib/db/schema";

describe("TrendsService", () => {
  let db: DbClient;
  let service: TrendsService;

  beforeEach(() => {
    db = createMockDB();
    service = new TrendsService(db);
  });

  describe("getOverview", () => {
    test("returns top keywords with growth rates", async () => {
      // Insert test data using Drizzle
      await db.insert(keywords).values([
        {
          id: "kw1",
          name: "React",
          aliases: [],
          tags: [],
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "kw2",
          name: "Vue",
          aliases: [],
          tags: [],
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]);

      // Current period data
      await db.insert(dailyAggregates).values([
        {
          id: "da1",
          date: "2026-01-15",
          keywordId: "kw1",
          source: "reddit",
          mentionsCount: 50,
        },
        {
          id: "da2",
          date: "2026-01-15",
          keywordId: "kw2",
          source: "x",
          mentionsCount: 30,
        },
      ]);

      // Previous period data
      await db.insert(dailyAggregates).values([
        {
          id: "da3",
          date: "2026-01-08",
          keywordId: "kw1",
          source: "reddit",
          mentionsCount: 25,
        },
      ]);

      const result = await service.getOverview({
        from: "2026-01-15",
        to: "2026-01-15",
      });

      expect(result.topKeywords).toHaveLength(2);
      expect(result.topKeywords[0].name).toBe("React");
      expect(result.topKeywords[0].currentPeriod).toBe(50);
      expect(result.topKeywords[0].previousPeriod).toBe(25);
      expect(result.topKeywords[0].growthRate).toBe(100);
    });

    test("identifies emerging keywords", async () => {
      await db.insert(keywords).values({
        id: "kw1",
        name: "NewFramework",
        aliases: [],
        tags: [],
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      // New keyword with low previous period and high current
      await db.insert(dailyAggregates).values([
        {
          id: "da1",
          date: "2026-01-15",
          keywordId: "kw1",
          source: "reddit",
          mentionsCount: 15,
        },
        {
          id: "da2",
          date: "2026-01-08",
          keywordId: "kw1",
          source: "reddit",
          mentionsCount: 2,
        },
      ]);

      const result = await service.getOverview({
        from: "2026-01-15",
        to: "2026-01-15",
      });

      expect(result.emergingKeywords).toHaveLength(1);
      expect(result.emergingKeywords[0].isEmerging).toBe(true);
    });
  });

  describe("getKeywordTrend", () => {
    test("returns time series for a keyword", async () => {
      await db.insert(keywords).values({
        id: "kw1",
        name: "React",
        aliases: [],
        tags: [],
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await db.insert(dailyAggregates).values([
        {
          id: "da1",
          date: "2026-01-10",
          keywordId: "kw1",
          source: "reddit",
          mentionsCount: 10,
        },
        {
          id: "da2",
          date: "2026-01-11",
          keywordId: "kw1",
          source: "x",
          mentionsCount: 15,
        },
      ]);

      const result = await service.getKeywordTrend("kw1", {
        from: "2026-01-10",
        to: "2026-01-11",
      });

      expect(result.name).toBe("React");
      expect(result.timeSeries).toHaveLength(2);
      expect(result.totalMentions).toBe(25);
      expect(result.averagePerDay).toBe(12.5);
    });

    test("filters by source", async () => {
      await db.insert(keywords).values({
        id: "kw1",
        name: "React",
        aliases: [],
        tags: [],
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await db.insert(dailyAggregates).values([
        {
          id: "da1",
          date: "2026-01-10",
          keywordId: "kw1",
          source: "reddit",
          mentionsCount: 10,
        },
        {
          id: "da2",
          date: "2026-01-10",
          keywordId: "kw1",
          source: "x",
          mentionsCount: 15,
        },
      ]);

      const result = await service.getKeywordTrend("kw1", {
        from: "2026-01-10",
        to: "2026-01-10",
        source: "reddit",
      });

      expect(result.timeSeries).toHaveLength(1);
      expect(result.timeSeries[0].source).toBe("reddit");
      expect(result.totalMentions).toBe(10);
    });
  });
});
