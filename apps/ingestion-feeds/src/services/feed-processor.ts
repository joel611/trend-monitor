import type { IngestionEvent } from "@trend-monitor/types";
import { FeedClient } from "../lib/feed-client";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { CheckpointService } from "./checkpoint-service";
import { IngestionService } from "./ingestion-service";
import type { DrizzleD1Database } from "drizzle-orm/d1";

interface ProcessResult {
	sourceId: string;
	sourceName: string;
	eventsCount: number;
	checkpoint: string | null;
	error?: string;
}

export class FeedProcessor {
	constructor(
		private db: DrizzleD1Database,
		private feedClient: FeedClient,
		private checkpointService: CheckpointService,
		private ingestionService: IngestionService,
		private configRepo: SourceConfigRepository,
	) {}

	async processAllSources(): Promise<{
		events: IngestionEvent[];
		results: ProcessResult[];
	}> {
		const configs = await this.configRepo.listEnabled();

		if (configs.length === 0) {
			return { events: [], results: [] };
		}

		const allEvents: IngestionEvent[] = [];
		const results: ProcessResult[] = [];

		for (const configRow of configs) {
			const result = await this.processSource(configRow.id);
			results.push(result);

			if (!result.error && result.eventsCount > 0) {
				// Re-process to get events (optimization: cache in processSource)
				const feedResult = await this.ingestionService.processFeed(
					configRow.id,
					configRow.config.url,
					this.feedClient,
					this.checkpointService,
					configRow.config.customUserAgent,
				);
				allEvents.push(...feedResult.events);
			}
		}

		return { events: allEvents, results };
	}

	async processSource(sourceId: string): Promise<ProcessResult> {
		const configRow = await this.configRepo.findById(sourceId);

		if (!configRow) {
			return {
				sourceId,
				sourceName: "Unknown",
				eventsCount: 0,
				checkpoint: null,
				error: "Source not found",
			};
		}

		if (!configRow.enabled) {
			return {
				sourceId,
				sourceName: configRow.config.name,
				eventsCount: 0,
				checkpoint: null,
				error: "Source is disabled",
			};
		}

		try {
			const result = await this.ingestionService.processFeed(
				configRow.id,
				configRow.config.url,
				this.feedClient,
				this.checkpointService,
				configRow.config.customUserAgent,
			);

			// Record success
			const now = new Date().toISOString();
			await this.configRepo.recordSuccess(configRow.id, {
				lastFetchAt: now,
				lastSuccessAt: now,
				consecutiveFailures: 0,
				lastErrorAt: null,
				lastErrorMessage: null,
			});

			return {
				sourceId: configRow.id,
				sourceName: configRow.config.name,
				eventsCount: result.events.length,
				checkpoint: result.newCheckpoint?.lastPublishedAt || null,
			};
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";

			// Record failure
			const failures = configRow.consecutiveFailures + 1;
			const now = new Date().toISOString();

			await this.configRepo.recordFailure(configRow.id, {
				lastFetchAt: now,
				lastErrorAt: now,
				lastErrorMessage: errorMessage,
				consecutiveFailures: failures,
			});

			// Auto-disable after 10 consecutive failures
			if (failures >= 10) {
				await this.configRepo.disable(configRow.id);
			}

			return {
				sourceId: configRow.id,
				sourceName: configRow.config.name,
				eventsCount: 0,
				checkpoint: null,
				error: errorMessage,
			};
		}
	}
}
