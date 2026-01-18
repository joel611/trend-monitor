import { randomUUID } from "node:crypto";
import type { DbClient, Mention, InsertMention } from "@trend-monitor/db";
import { mentions } from "@trend-monitor/db";

export class MentionsRepository {
	constructor(private db: DbClient) {}

	async createOrIgnore(input: {
		source: "reddit" | "x" | "feed";
		sourceId: string;
		title?: string;
		content: string;
		url: string;
		author?: string;
		createdAt: string;
		matchedKeywords: string[];
	}): Promise<Mention | null> {
		const id = randomUUID();
		const now = new Date().toISOString();

		const newMention: InsertMention = {
			id,
			source: input.source,
			sourceId: input.sourceId,
			title: input.title,
			content: input.content,
			url: input.url,
			author: input.author,
			createdAt: input.createdAt,
			fetchedAt: now,
			matchedKeywords: input.matchedKeywords,
		};

		try {
			await this.db.insert(mentions).values(newMention);
			return {
				...newMention,
				title: input.title || null,
				author: input.author || null,
				matchedKeywords: input.matchedKeywords,
			};
		} catch (err) {
			// If unique constraint violation, return null (duplicate)
			if (err instanceof Error && err.message.includes("UNIQUE")) {
				return null;
			}
			throw new Error(
				`Failed to create mention: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}
}
