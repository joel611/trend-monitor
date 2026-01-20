import type { DbClient, Keyword } from "@trend-monitor/db";
import { keywords } from "@trend-monitor/db";
import { eq } from "drizzle-orm";

export class KeywordsRepository {
	constructor(private db: DbClient) {}

	async create(input: { name: string; aliases: string[]; tags: string[] }): Promise<Keyword> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await this.db.insert(keywords).values({
			id,
			name: input.name,
			aliases: input.aliases,
			tags: input.tags,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});

		return {
			id,
			name: input.name,
			aliases: input.aliases,
			tags: input.tags,
			status: "active",
			createdAt: now,
			updatedAt: now,
		};
	}

	async findActive(): Promise<Keyword[]> {
		return await this.db.select().from(keywords).where(eq(keywords.status, "active"));
	}
}
