import type { IngestionEvent } from "@trend-monitor/types";
import { Source } from "@trend-monitor/types";
import type { FeedClient, FeedPost } from "../lib/feed-client";
import type { Checkpoint, CheckpointService } from "./checkpoint-service";

interface ProcessResult {
	events: IngestionEvent[];
	newCheckpoint: Checkpoint | null;
}

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

	async processFeed(
		feedId: string,
		feedUrl: string,
		client: FeedClient,
		checkpointService: CheckpointService,
		customUserAgent?: string,
	): Promise<ProcessResult> {
		// Get checkpoint
		const checkpoint = await checkpointService.getCheckpoint(feedId);

		// Fetch posts from feed
		const posts = await client.fetchFeed(feedUrl, customUserAgent);

		// Filter posts newer than checkpoint
		let newPosts = posts;
		if (checkpoint) {
			const checkpointDate = new Date(checkpoint.lastPublishedAt);
			newPosts = posts.filter((post) => {
				const postDate = new Date(post.publishedAt);
				return postDate > checkpointDate;
			});
		}

		// Transform to events
		const events = newPosts.map((post) => this.transformPost(post, feedUrl));

		// Update checkpoint if we got new posts
		let newCheckpoint: Checkpoint | null = null;
		if (newPosts.length > 0) {
			// Find the most recent post
			const mostRecent = newPosts.reduce((latest, post) => {
				const latestDate = new Date(latest.publishedAt);
				const postDate = new Date(post.publishedAt);
				return postDate > latestDate ? post : latest;
			});

			newCheckpoint = {
				lastPublishedAt: mostRecent.publishedAt,
				lastFetchedAt: new Date().toISOString(),
			};

			await checkpointService.saveCheckpoint(feedId, newCheckpoint);
		}

		return {
			events,
			newCheckpoint,
		};
	}
}
