import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "../lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "../services/checkpoint-service";
import { IngestionService } from "../services/ingestion-service";
import { FeedProcessor } from "../services/feed-processor";
import { db } from "../lib/db";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export async function handleScheduled(
	_event: ScheduledEvent,
	env: Env,
	_ctx: ExecutionContext,
): Promise<void> {
	console.log("Feed ingestion running at:", new Date().toISOString());

	try {
		// Initialize services
		const feedClient = new FeedClient({
			defaultUserAgent: env.FEED_USER_AGENT,
		});

		const configRepo = new SourceConfigRepository(db);
		const checkpointService = new CheckpointService(env.CHECKPOINT);
		const ingestionService = new IngestionService();
		const processor = new FeedProcessor(
			db,
			feedClient,
			checkpointService,
			ingestionService,
			configRepo,
		);

		// Process all feeds
		const { events, results } = await processor.processAllSources();

		// Log results
		for (const result of results) {
			if (result.error) {
				console.error(`Failed to process ${result.sourceName}:`, result.error);
			} else {
				console.log(
					`Processed ${result.sourceName}: ${result.eventsCount} new posts, checkpoint: ${result.checkpoint || "none"}`,
				);
			}
		}

		// Send events to queue in batch
		if (events.length > 0) {
			await env.INGESTION_QUEUE.sendBatch(events.map((event) => ({ body: event })));
			console.log(`Published ${events.length} events to ingestion queue`);
		} else {
			console.log("No new posts found");
		}
	} catch (err) {
		console.error("Feed ingestion failed:", err);
		throw err;
	}
}
