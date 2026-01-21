import type { IngestionEvent } from "@trend-monitor/types";
import { db } from "./lib/db";
import { MentionsRepository } from "@trend-monitor/db/repositories";
import { KeywordCache } from "./services/keyword-cache";
import { KeywordMatcher } from "./services/keyword-matcher";

interface Env {
	DB: D1Database;
	KEYWORD_CACHE: KVNamespace;
}

export default {
	async queue(batch: MessageBatch<IngestionEvent>, env: Env): Promise<void> {
		// Initialize services
		const keywordCache = new KeywordCache(db, env.KEYWORD_CACHE);
		const keywordMatcher = new KeywordMatcher();
		const mentionsRepo = new MentionsRepository(db);

		// Load active keywords (cached)
		const keywords = await keywordCache.getActiveKeywords();

		if (keywords.length === 0) {
			console.log("No active keywords configured, skipping batch");
			return;
		}

		// Process each message
		for (const message of batch.messages) {
			const event = message.body;

			try {
				// Match keywords in content and title
				const textToMatch = [event.title, event.content].filter(Boolean).join(" ");
				const matchedKeywordIds = keywordMatcher.matchKeywords(textToMatch, keywords);

				// Skip if no matches
				if (matchedKeywordIds.length === 0) {
					console.log(`No keywords matched for ${event.source}:${event.sourceId}`);
					continue;
				}

				// Create mention (idempotent)
				const mention = await mentionsRepo.createOrIgnore({
					source: event.source,
					sourceId: event.sourceId,
					title: event.title,
					content: event.content,
					url: event.url,
					author: event.author,
					createdAt: event.createdAt,
					matchedKeywords: matchedKeywordIds,
				});

				if (mention) {
					console.log(
						`Created mention ${mention.id} for ${event.source}:${event.sourceId} with ${matchedKeywordIds.length} keywords`,
					);
				} else {
					console.log(`Duplicate mention ${event.source}:${event.sourceId}, skipping`);
				}
			} catch (err) {
				console.error(`Failed to process message ${message.id}:`, err);
				// Message will be retried based on queue config
				throw err;
			}
		}
	},
};
