import type { D1Database } from "@cloudflare/workers-types";
import type {
  TrendsOverviewResponse,
  KeywordTrendResponse,
  TrendKeyword,
} from "@trend-monitor/types";

export class TrendsService {
  constructor(private db: D1Database) {}

  async getOverview(params: {
    from?: string;
    to?: string;
  }): Promise<TrendsOverviewResponse> {
    const to = params.to || new Date().toISOString().split("T")[0];
    const from = params.from || this.subtractDays(to, 7);

    // Get top keywords by mentions in current period
    const topKeywordsResult = await this.db
      .prepare(
        `SELECT k.id, k.name, SUM(da.mentions_count) as total
         FROM daily_aggregates da
         JOIN keywords k ON da.keyword_id = k.id
         WHERE da.date >= ? AND da.date <= ?
         GROUP BY k.id, k.name
         ORDER BY total DESC
         LIMIT 10`
      )
      .bind(from, to)
      .all<{ id: string; name: string; total: number }>();

    // Calculate growth rates
    const topKeywords: TrendKeyword[] = [];
    for (const row of topKeywordsResult.results) {
      const prevFrom = this.subtractDays(from, 7);
      const prevTo = this.subtractDays(to, 7);

      const prevResult = await this.db
        .prepare(
          `SELECT SUM(mentions_count) as total
           FROM daily_aggregates
           WHERE keyword_id = ? AND date >= ? AND date <= ?`
        )
        .bind(row.id, prevFrom, prevTo)
        .first<{ total: number }>();

      const previousPeriod = prevResult?.total || 0;
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

    // Get source breakdown
    const sourceResult = await this.db
      .prepare(
        `SELECT source, SUM(mentions_count) as count
         FROM daily_aggregates
         WHERE date >= ? AND date <= ?
         GROUP BY source`
      )
      .bind(from, to)
      .all<{ source: string; count: number }>();

    return {
      topKeywords,
      emergingKeywords: topKeywords.filter((k) => k.isEmerging),
      totalMentions: topKeywords.reduce((sum, k) => sum + k.currentPeriod, 0),
      sourceBreakdown: sourceResult.results.map((r) => ({
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

    const conditions = ["keyword_id = ?", "date >= ?", "date <= ?"];
    const bindParams: any[] = [keywordId, from, to];

    if (params.source) {
      conditions.push("source = ?");
      bindParams.push(params.source);
    }

    const result = await this.db
      .prepare(
        `SELECT date, source, SUM(mentions_count) as count
         FROM daily_aggregates
         WHERE ${conditions.join(" AND ")}
         GROUP BY date, source
         ORDER BY date ASC`
      )
      .bind(...bindParams)
      .all<{ date: string; source: string; count: number }>();

    // Get keyword name
    const keyword = await this.db
      .prepare("SELECT name FROM keywords WHERE id = ?")
      .bind(keywordId)
      .first<{ name: string }>();

    const totalMentions = result.results.reduce((sum, r) => sum + r.count, 0);
    const dayCount = new Set(result.results.map((r) => r.date)).size;

    return {
      keywordId,
      name: keyword?.name || "",
      timeSeries: result.results.map((r) => ({
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
