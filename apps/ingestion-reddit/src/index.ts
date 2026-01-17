import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
}

export default {
	async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Reddit ingestion running at:", new Date().toISOString());

		// Example: Fetch Reddit data and publish to queue
		const sampleEvent: IngestionEvent = {
			source: Source.Reddit,
			sourceId: "sample-reddit-post",
			title: "Sample Reddit Post",
			content: "Sample content from Reddit",
			url: "https://reddit.com/r/example/comments/sample",
			author: "reddit_user",
			createdAt: new Date().toISOString(),
			fetchedAt: new Date().toISOString(),
		};

		// await env.INGESTION_QUEUE.send(sampleEvent);
		console.log("Would publish event:", sampleEvent);
	},
};
