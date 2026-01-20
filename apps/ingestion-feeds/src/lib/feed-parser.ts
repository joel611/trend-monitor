import Parser from "rss-parser";

export interface FeedItem {
	title: string;
	link: string;
	id: string;
	publishedAt: string;
	author?: string;
	content: string;
}

export class FeedParser {
	private parser: Parser;

	constructor() {
		this.parser = new Parser({
			customFields: {
				item: [["id", "atomId"]],
			},
		});
	}

	async parse(xml: string): Promise<FeedItem[]> {
		const feed = await this.parser.parseString(xml);

		if (!feed.items || feed.items.length === 0) {
			return [];
		}

		return feed.items.map((item) => this.transformItem(item));
	}

	private transformItem(item: any): FeedItem {
		// Extract ID - for Atom feeds, use atomId, otherwise guid or link
		const id = item.atomId || item.guid || item.id || item.link || "";

		// Extract published date (try multiple fields)
		const publishedAt = item.pubDate || item.isoDate || item.date || "";

		// Extract author (handle various formats)
		let author: string | undefined;
		const authorText = item.creator || item.author;
		if (authorText) {
			// Handle "email (Name)" format
			const nameMatch = authorText.match(/\(([^)]+)\)/);
			author = nameMatch ? nameMatch[1] : authorText;
		}

		// Extract content (prefer content, fall back to contentSnippet or description)
		const content =
			item.content ||
			item["content:encoded"] ||
			item.contentSnippet ||
			item.description ||
			"";

		return {
			title: item.title || "",
			link: item.link || "",
			id,
			publishedAt,
			author,
			content,
		};
	}
}
