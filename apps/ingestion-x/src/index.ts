import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
}

export default {
	async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("X ingestion running at:", new Date().toISOString());

		// Example: Fetch X/Twitter data and publish to queue
		const sampleEvent: IngestionEvent = {
			source: Source.X,
			sourceId: "sample-tweet-id",
			content: "Sample tweet content",
			url: "https://x.com/user/status/sample",
			author: "twitter_user",
			createdAt: new Date().toISOString(),
			fetchedAt: new Date().toISOString(),
		};

		// await env.INGESTION_QUEUE.send(sampleEvent);
		console.log("Would publish event:", sampleEvent);
	},
};
