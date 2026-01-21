import { eq, and } from "drizzle-orm";
import { sourceConfigs, type SourceConfig, type DbClient } from "../index";

export class SourceConfigRepository {
	constructor(private db: DbClient) {}

	async listEnabled(): Promise<SourceConfig[]> {
		try {
			const result = await this.db
				.select()
				.from(sourceConfigs)
				.where(and(eq(sourceConfigs.type, "feed"), eq(sourceConfigs.enabled, true)));

			return result;
		} catch (err) {
			throw new Error(
				`Failed to list enabled source configs: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}
}
