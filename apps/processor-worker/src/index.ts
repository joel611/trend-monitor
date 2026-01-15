import type { IngestionEvent } from "@trend-monitor/types";

interface Env {
	DB: D1Database;
	KEYWORD_CACHE: KVNamespace;
}

export default {
	async queue(batch: MessageBatch<IngestionEvent>, _env: Env): Promise<void> {
		for (const message of batch.messages) {
			console.log("Processing message:", message.id);
			// Keyword matching and DB write logic will be added
		}
	},
};
