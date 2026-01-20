import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";
import type { FeedPost } from "../lib/feed-client";

export class IngestionService {
	transformPost(post: FeedPost, feedUrl: string): IngestionEvent {
		return {
			source: Source.Feed,
			sourceId: post.id,
			title: post.title,
			content: post.content,
			url: post.url,
			author: post.author,
			createdAt: this.parseDate(post.publishedAt),
			fetchedAt: new Date().toISOString(),
			metadata: {
				feedUrl,
			},
		};
	}

	private parseDate(dateString: string): string {
		// Handles both RSS (RFC 822) and Atom (ISO 8601) formats
		return new Date(dateString).toISOString();
	}
}
