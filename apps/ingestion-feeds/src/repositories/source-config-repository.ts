import type { FeedSourceConfig } from "@trend-monitor/types";

export interface SourceConfigRow {
	id: string;
	config: FeedSourceConfig;
}

export class SourceConfigRepository {
	constructor(private db: D1Database) {}

	async getActiveConfigs(): Promise<SourceConfigRow[]> {
		const result = await this.db
			.prepare("SELECT id, config FROM source_configs WHERE type = ? AND enabled = 1")
			.bind("feed")
			.all<{ id: string; config: string }>();

		return result.results.map((row) => ({
			id: row.id,
			config: JSON.parse(row.config) as FeedSourceConfig,
		}));
	}
}
