import { sql } from "drizzle-orm";
import type { DbClient } from "@trend-monitor/db";
import { mentions, dailyAggregates } from "@trend-monitor/db";

export class AggregationRepository {
	constructor(private db: DbClient) {}

	async getPendingDateRanges(lookbackDays: number): Promise<string[]> {
		// Get distinct dates from mentions in the last N days
		const result = await this.db
			.selectDistinct({ date: sql<string>`date(${mentions.createdAt})`.as("date") })
			.from(mentions)
			.where(sql`date(${mentions.createdAt}) >= date('now', ${sql.raw(`'-${lookbackDays} days'`)})`)
			.orderBy(sql`date`);

		const mentionDates = result.map((r) => r.date);

		// Get dates that already have aggregates
		const aggregatedResult = await this.db
			.selectDistinct({ date: dailyAggregates.date })
			.from(dailyAggregates)
			.where(sql`${dailyAggregates.date} >= date('now', ${sql.raw(`'-${lookbackDays} days'`)})`);

		const aggregatedDates = new Set(aggregatedResult.map((r) => r.date));

		// Return dates with mentions but no aggregates
		return mentionDates.filter((date) => !aggregatedDates.has(date));
	}

	async getAggregationStatsForDate(
		date: string,
	): Promise<Array<{ date: string; keywordId: string; source: string; count: number }>> {
		// Query mentions for this date
		const result = await this.db
			.select({
				source: mentions.source,
				matchedKeywords: mentions.matchedKeywords,
			})
			.from(mentions)
			.where(sql`date(${mentions.createdAt}) = ${date}`);

		// Flatten matched keywords and group by keyword + source
		const groups = new Map<string, number>();

		for (const row of result) {
			for (const keywordId of row.matchedKeywords) {
				const key = `${date}|${keywordId}|${row.source}`;
				groups.set(key, (groups.get(key) || 0) + 1);
			}
		}

		// Convert to array
		return Array.from(groups.entries()).map(([key, count]) => {
			const [date, keywordId, source] = key.split("|");
			return { date, keywordId, source, count };
		});
	}
}
