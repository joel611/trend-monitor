import { eq, and, isNull, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { sourceConfigs, type SourceConfig, type InsertSourceConfig, type DbClient } from "../index";

export class SourceConfigRepository {
	constructor(private db: DbClient) {}

	/**
	 * List all source configs with optional filters
	 */
	async list(options?: { includeDeleted?: boolean }): Promise<SourceConfig[]> {
		const includeDeleted = options?.includeDeleted || false;

		try {
			let query = this.db.select().from(sourceConfigs).orderBy(desc(sourceConfigs.createdAt));

			// Filter out soft-deleted configs unless explicitly requested
			if (!includeDeleted) {
				query = query.where(isNull(sourceConfigs.deletedAt)) as typeof query;
			}

			const result = await query;
			return result;
		} catch (err) {
			throw new Error(
				`Failed to list source configs: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * List enabled source configs (for ingestion worker)
	 */
	async listEnabled(): Promise<SourceConfig[]> {
		try {
			const result = await this.db
				.select()
				.from(sourceConfigs)
				.where(
					and(
						eq(sourceConfigs.type, "feed"),
						eq(sourceConfigs.enabled, true),
						isNull(sourceConfigs.deletedAt),
					),
				);

			return result;
		} catch (err) {
			throw new Error(
				`Failed to list enabled source configs: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Find source config by ID
	 */
	async findById(id: string): Promise<SourceConfig | null> {
		try {
			const result = await this.db
				.select()
				.from(sourceConfigs)
				.where(eq(sourceConfigs.id, id))
				.limit(1);

			return result[0] || null;
		} catch (err) {
			throw new Error(
				`Failed to find source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Create a new source config
	 */
	async create(input: {
		url: string;
		name: string;
		type: "feed" | "x";
		customUserAgent?: string;
		feedTitle?: string;
		feedDescription?: string;
	}): Promise<SourceConfig> {
		// Validate input
		if (!input.url?.trim()) {
			throw new Error("Source URL cannot be empty");
		}
		if (!input.name?.trim()) {
			throw new Error("Source name cannot be empty");
		}

		const id = randomUUID();
		const now = new Date().toISOString();

		const newSource: InsertSourceConfig = {
			id,
			type: input.type,
			config: {
				url: input.url.trim(),
				name: input.name.trim(),
				customUserAgent: input.customUserAgent,
				feedTitle: input.feedTitle,
				feedDescription: input.feedDescription,
			},
			enabled: true,
			createdAt: now,
			updatedAt: now,
			consecutiveFailures: 0,
		};

		try {
			await this.db.insert(sourceConfigs).values(newSource);
		} catch (err) {
			throw new Error(
				`Failed to create source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}

		return {
			id,
			type: input.type,
			config: {
				url: input.url.trim(),
				name: input.name.trim(),
				customUserAgent: input.customUserAgent,
				feedTitle: input.feedTitle,
				feedDescription: input.feedDescription,
			},
			enabled: true,
			createdAt: now,
			updatedAt: now,
			lastFetchAt: null,
			lastSuccessAt: null,
			lastErrorAt: null,
			lastErrorMessage: null,
			consecutiveFailures: 0,
			deletedAt: null,
		};
	}

	/**
	 * Update an existing source config
	 */
	async update(
		id: string,
		input: {
			url?: string;
			name?: string;
			customUserAgent?: string;
			feedTitle?: string;
			feedDescription?: string;
			enabled?: boolean;
		},
	): Promise<SourceConfig | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		// Validate input if provided
		if (input.url !== undefined && !input.url?.trim()) {
			throw new Error("Source URL cannot be empty");
		}
		if (input.name !== undefined && !input.name?.trim()) {
			throw new Error("Source name cannot be empty");
		}

		const updates: Partial<SourceConfig> = {
			updatedAt: new Date().toISOString(),
		};

		// Update config fields
		const configUpdates: any = { ...existing.config };
		let configChanged = false;

		if (input.url !== undefined) {
			configUpdates.url = input.url.trim();
			configChanged = true;
		}
		if (input.name !== undefined) {
			configUpdates.name = input.name.trim();
			configChanged = true;
		}
		if (input.customUserAgent !== undefined) {
			configUpdates.customUserAgent = input.customUserAgent;
			configChanged = true;
		}
		if (input.feedTitle !== undefined) {
			configUpdates.feedTitle = input.feedTitle;
			configChanged = true;
		}
		if (input.feedDescription !== undefined) {
			configUpdates.feedDescription = input.feedDescription;
			configChanged = true;
		}

		if (configChanged) {
			updates.config = configUpdates;
		}

		if (input.enabled !== undefined) {
			updates.enabled = input.enabled;
		}

		if (Object.keys(updates).length === 1) return existing; // Only updatedAt, no real changes

		try {
			await this.db.update(sourceConfigs).set(updates).where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to update source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}

		return this.findById(id);
	}

	/**
	 * Soft delete a source config
	 */
	async softDelete(id: string): Promise<boolean> {
		try {
			await this.db
				.update(sourceConfigs)
				.set({
					deletedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
				.where(eq(sourceConfigs.id, id));

			return true;
		} catch (err) {
			throw new Error(
				`Failed to soft delete source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Toggle enabled status
	 */
	async toggle(id: string): Promise<SourceConfig | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		try {
			await this.db
				.update(sourceConfigs)
				.set({
					enabled: !existing.enabled,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to toggle source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}

		return this.findById(id);
	}

	/**
	 * Record successful fetch
	 */
	async recordSuccess(id: string): Promise<void> {
		const now = new Date().toISOString();

		try {
			await this.db
				.update(sourceConfigs)
				.set({
					lastFetchAt: now,
					lastSuccessAt: now,
					consecutiveFailures: 0,
					lastErrorAt: null,
					lastErrorMessage: null,
					updatedAt: now,
				})
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to record success: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Record failed fetch
	 */
	async recordFailure(id: string, errorMessage: string): Promise<void> {
		const existing = await this.findById(id);
		if (!existing) {
			throw new Error(`Source config ${id} not found`);
		}

		const now = new Date().toISOString();
		const failures = existing.consecutiveFailures + 1;

		try {
			await this.db
				.update(sourceConfigs)
				.set({
					lastFetchAt: now,
					lastErrorAt: now,
					lastErrorMessage: errorMessage,
					consecutiveFailures: failures,
					updatedAt: now,
				})
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to record failure: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Disable a source config (for auto-disable after repeated failures)
	 */
	async disable(id: string): Promise<void> {
		try {
			await this.db
				.update(sourceConfigs)
				.set({
					enabled: false,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(sourceConfigs.id, id));
		} catch (err) {
			throw new Error(
				`Failed to disable source config: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	}
}
