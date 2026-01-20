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
}
