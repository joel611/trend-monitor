import type { AggregationRepository } from "@trend-monitor/db/repositories";

export interface AggregationSummary {
	datesProcessed: string[];
	totalAggregates: number;
}

export class AggregationService {
	constructor(private repo: AggregationRepository) {}

	async aggregateDate(date: string): Promise<number> {
		const stats = await this.repo.getAggregationStatsForDate(date);
		await this.repo.upsertDailyAggregates(stats);
		return stats.length;
	}

	async runAggregation(lookbackDays: number): Promise<AggregationSummary> {
		const pendingDates = await this.repo.getPendingDateRanges(lookbackDays);
		let totalAggregates = 0;

		for (const date of pendingDates) {
			const count = await this.aggregateDate(date);
			totalAggregates += count;
			console.log(`Aggregated ${count} records for ${date}`);
		}

		return {
			datesProcessed: pendingDates,
			totalAggregates,
		};
	}
}
