import { type FeedItem, FeedParser } from "./feed-parser";
import { htmlToText } from "./html-to-text";

export interface FeedClientConfig {
	defaultUserAgent: string;
}

export interface FeedPost {
	id: string;
	title: string;
	content: string;
	url: string;
	author?: string;
	publishedAt: string;
}

export class FeedClient {
	private parser: FeedParser;
	private config: FeedClientConfig;

	constructor(config: FeedClientConfig) {
		this.config = config;
		this.parser = new FeedParser();
	}

	async fetchFeed(feedUrl: string, customUserAgent?: string): Promise<FeedPost[]> {
		const response = await fetch(feedUrl, {
			headers: {
				"User-Agent": customUserAgent || this.config.defaultUserAgent,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch feed from ${feedUrl}: ${response.status} ${response.statusText}`,
			);
		}

		const xml = await response.text();
		const items = await this.parser.parse(xml);

		return items.map((item) => this.transformItem(item));
	}

	private transformItem(item: FeedItem): FeedPost {
		// Convert HTML content to plain text
		const content = htmlToText(item.content);

		return {
			id: item.id,
			title: item.title,
			content,
			url: item.link,
			author: item.author,
			publishedAt: item.publishedAt,
		};
	}
}
