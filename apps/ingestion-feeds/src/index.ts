import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "./lib/feed-client";
import { SourceConfigRepository } from "./repositories/source-config-repository";
import { CheckpointService } from "./services/checkpoint-service";
import { IngestionService } from "./services/ingestion-service";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log("Feed ingestion running at:", new Date().toISOString());

		try {
			// Initialize services
			const feedClient = new FeedClient({
				defaultUserAgent: env.FEED_USER_AGENT,
			});

			const configRepo = new SourceConfigRepository(env.DB);
			const checkpointService = new CheckpointService(env.CHECKPOINT);
			const ingestionService = new IngestionService();

			// Load active source configurations
			const configs = await configRepo.getActiveConfigs();

			if (configs.length === 0) {
				console.log("No active feed source configurations found");
				return;
			}

			console.log(`Processing ${configs.length} feed(s)`);

			// Process each feed and collect events
			const allEvents: IngestionEvent[] = [];

			for (const configRow of configs) {
				try {
					const result = await ingestionService.processFeed(
						configRow.id,
						configRow.config.url,
						feedClient,
						checkpointService,
						configRow.config.customUserAgent,
					);

					allEvents.push(...result.events);

					console.log(
						`Processed ${configRow.config.name}: ${result.events.length} new posts, checkpoint: ${result.newCheckpoint?.lastPublishedAt || "none"}`,
					);
				} catch (err) {
					console.error(`Failed to process feed ${configRow.config.name}:`, err);
					// Continue with other feeds
				}
			}

			// Send events to queue in batch
			if (allEvents.length > 0) {
				await env.INGESTION_QUEUE.sendBatch(
					allEvents.map((event) => ({ body: event })),
				);
				console.log(`Published ${allEvents.length} events to ingestion queue`);
			} else {
				console.log("No new posts found");
			}
		} catch (err) {
			console.error("Feed ingestion failed:", err);
			throw err;
		}
	},
};
