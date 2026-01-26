import { env } from "cloudflare:workers";
import { Elysia, t } from "elysia";
import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "../lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "../services/checkpoint-service";
import { IngestionService } from "../services/ingestion-service";
import { FeedProcessor } from "../services/feed-processor";
import { db } from "../lib/db";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	CHECKPOINT: KVNamespace;
	FEED_USER_AGENT: string;
}

export const triggerRoutes = new Elysia({ prefix: "/trigger" })
	.derive(() => {
		const workerEnv = env as unknown as Env;
		const feedClient = new FeedClient({
			defaultUserAgent: workerEnv.FEED_USER_AGENT,
		});
		const configRepo = new SourceConfigRepository(db);
		const checkpointService = new CheckpointService(workerEnv.CHECKPOINT);
		const ingestionService = new IngestionService();

		return {
			processor: new FeedProcessor(
				db,
				feedClient,
				checkpointService,
				ingestionService,
				configRepo,
			),
			queue: workerEnv.INGESTION_QUEUE,
		};
	})
		.post("/all", async ({ processor, queue }) => {
			const startTime = Date.now();
			const { events, results } = await processor.processAllSources();

			// Send events to queue
			if (events.length > 0) {
				await queue.sendBatch(events.map((event) => ({ body: event })));
			}

			return {
				success: true,
				summary: {
					totalSources: results.length,
					successfulSources: results.filter((r) => !r.error).length,
					failedSources: results.filter((r) => r.error).length,
					totalEvents: events.length,
					durationMs: Date.now() - startTime,
				},
				results: results.map((r) => ({
					sourceId: r.sourceId,
					sourceName: r.sourceName,
					status: r.error ? "failed" : "success",
					eventsCount: r.eventsCount,
					checkpoint: r.checkpoint,
					error: r.error,
				})),
			};
		})
		.post(
			"/:id",
			async ({ processor, queue, params }) => {
				const startTime = Date.now();
				const result = await processor.processSource(params.id);

				// Get events if successful
				let eventsCount = 0;
				if (!result.error && result.eventsCount > 0) {
					const workerEnv = env as unknown as Env;
					const configRepo = new SourceConfigRepository(db);
					const configRow = await configRepo.findById(params.id);

					if (configRow) {
						const feedClient = new FeedClient({
							defaultUserAgent: workerEnv.FEED_USER_AGENT,
						});
						const checkpointService = new CheckpointService(workerEnv.CHECKPOINT);
						const ingestionService = new IngestionService();

						const feedResult = await ingestionService.processFeed(
							configRow.id,
							configRow.config.url,
							feedClient,
							checkpointService,
							configRow.config.customUserAgent,
						);

						if (feedResult.events.length > 0) {
							await queue.sendBatch(
								feedResult.events.map((event) => ({ body: event })),
							);
							eventsCount = feedResult.events.length;
						}
					}
				}

				if (result.error) {
					return {
						success: false,
						sourceId: result.sourceId,
						sourceName: result.sourceName,
						error: result.error,
						durationMs: Date.now() - startTime,
					};
				}

				return {
					success: true,
					sourceId: result.sourceId,
					sourceName: result.sourceName,
					eventsCount,
					checkpoint: result.checkpoint,
					durationMs: Date.now() - startTime,
				};
			},
			{
				params: t.Object({
					id: t.String(),
				}),
			},
		);
