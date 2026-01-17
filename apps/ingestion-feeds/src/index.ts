import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";

interface Env {
	INGESTION_QUEUE: Queue<IngestionEvent>;
	DB: D1Database;
	CHECKPOINT: KVNamespace;
}

export default {
	async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Feeds ingestion running at:", new Date().toISOString());

		// Example: Fetch RSS/JSON feed and publish to queue
		const sampleEvent: IngestionEvent = {
			source: Source.Feed,
			sourceId: "sample-feed-entry",
			title: "Sample Blog Post",
			content: "Sample content from RSS feed",
			url: "https://example.com/blog/sample-post",
			author: "blog_author",
			createdAt: new Date().toISOString(),
			fetchedAt: new Date().toISOString(),
		};

		// await env.INGESTION_QUEUE.send(sampleEvent);
		console.log("Would publish event:", sampleEvent);
	},
};
