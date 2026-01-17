import { eq, gte, lte, and, sum, sql, desc } from "drizzle-orm";
import type { DbClient } from "../lib/db/client";
import { dailyAggregates, keywords } from "../lib/db/schema";
import type {
  TrendsOverviewResponse,
  KeywordTrendResponse,
  TrendKeyword,
} from "@trend-monitor/types";

export class TrendsService {
  constructor(private db: DbClient) {}

  async getOverview(params: {
    from?: string;
    to?: string;
  }): Promise<TrendsOverviewResponse> {
    const to = params.to || new Date().toISOString().split("T")[0];
    const from = params.from || this.subtractDays(to, 7);

    // Get top keywords by mentions in current period using Drizzle
    const topKeywordsResult = await this.db
      .select({
        id: keywords.id,
        name: keywords.name,
        total: sum(dailyAggregates.mentionsCount).mapWith(Number).as("total"),
      })
      .from(dailyAggregates)
      .innerJoin(keywords, eq(dailyAggregates.keywordId, keywords.id))
      .where(and(gte(dailyAggregates.date, from), lte(dailyAggregates.date, to)))
      .groupBy(keywords.id, keywords.name)
      .orderBy(desc(sql`total`))
      .limit(10);

    // Calculate growth rates
    const topKeywords: TrendKeyword[] = [];
    for (const row of topKeywordsResult) {
      const prevFrom = this.subtractDays(from, 7);
      const prevTo = this.subtractDays(to, 7);

      const prevResult = await this.db
        .select({ total: sum(dailyAggregates.mentionsCount).mapWith(Number) })
        .from(dailyAggregates)
        .where(
          and(
            eq(dailyAggregates.keywordId, row.id),
            gte(dailyAggregates.date, prevFrom),
            lte(dailyAggregates.date, prevTo)
          )
        );

      const previousPeriod = prevResult[0]?.total || 0;
      const growthRate =
        previousPeriod > 0 ? ((row.total - previousPeriod) / previousPeriod) * 100 : 100;
      const isEmerging = previousPeriod < 3 && row.total >= 10;

      topKeywords.push({
        keywordId: row.id,
        name: row.name,
        currentPeriod: row.total,
        previousPeriod,
        growthRate,
        isEmerging,
      });
    }

    // Get source breakdown using Drizzle
    const sourceResult = await this.db
      .select({
        source: dailyAggregates.source,
        count: sum(dailyAggregates.mentionsCount).mapWith(Number),
      })
      .from(dailyAggregates)
      .where(and(gte(dailyAggregates.date, from), lte(dailyAggregates.date, to)))
      .groupBy(dailyAggregates.source);

    return {
      topKeywords,
      emergingKeywords: topKeywords.filter((k) => k.isEmerging),
      totalMentions: topKeywords.reduce((sum, k) => sum + k.currentPeriod, 0),
      sourceBreakdown: sourceResult.map((r) => ({
        source: r.source,
        count: r.count,
      })),
    };
  }

  async getKeywordTrend(
    keywordId: string,
    params: { from?: string; to?: string; source?: string }
  ): Promise<KeywordTrendResponse> {
    const to = params.to || new Date().toISOString().split("T")[0];
    const from = params.from || this.subtractDays(to, 30);

    // Build conditions using Drizzle
    const conditions = [
      eq(dailyAggregates.keywordId, keywordId),
      gte(dailyAggregates.date, from),
      lte(dailyAggregates.date, to),
    ];

    if (params.source) {
      conditions.push(eq(dailyAggregates.source, params.source as "reddit" | "x" | "feed"));
    }

    const result = await this.db
      .select({
        date: dailyAggregates.date,
        source: dailyAggregates.source,
        count: sum(dailyAggregates.mentionsCount).mapWith(Number),
      })
      .from(dailyAggregates)
      .where(and(...conditions))
      .groupBy(dailyAggregates.date, dailyAggregates.source)
      .orderBy(dailyAggregates.date);

    // Get keyword name using Drizzle
    const keywordResult = await this.db
      .select({ name: keywords.name })
      .from(keywords)
      .where(eq(keywords.id, keywordId))
      .limit(1);

    const totalMentions = result.reduce((sum, r) => sum + r.count, 0);
    const dayCount = new Set(result.map((r) => r.date)).size;

    return {
      keywordId,
      name: keywordResult[0]?.name || "",
      timeSeries: result.map((r) => ({
        date: r.date,
        count: r.count,
        source: r.source,
      })),
      totalMentions,
      averagePerDay: dayCount > 0 ? totalMentions / dayCount : 0,
    };
  }

  private subtractDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  }
}
