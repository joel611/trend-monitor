import { db } from "./lib/db";
import { AggregationRepository } from "@trend-monitor/db/repositories";
import { AggregationService } from "./services/aggregation-service";

interface Env {
	DB: D1Database;
	CACHE: KVNamespace;
}

export default {
	async scheduled(event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Running aggregation at:", new Date(event.scheduledTime).toISOString());

		try {
			const repo = new AggregationRepository(db);
			const service = new AggregationService(repo);

			const summary = await service.runAggregation(7);

			console.log("Aggregation complete:", {
				datesProcessed: summary.datesProcessed,
				totalAggregates: summary.totalAggregates,
			});
		} catch (error) {
			console.error("Aggregation failed:", error);
			throw error;
		}
	},
};
