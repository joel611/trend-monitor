import { Elysia, t } from "elysia";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import type {
	ValidateFeedRequest,
	ValidateFeedResponse,
	CreateSourceRequest,
	UpdateSourceRequest,
	SourceConfigResponse,
	ListSourcesResponse,
} from "@trend-monitor/types";
import type { SourceConfig } from "@trend-monitor/db";
import { db } from "../../lib/db";
import { FeedValidatorService } from "../../services/feed-validator";

/**
 * Calculate health status from source config metrics
 */
function calculateHealth(source: SourceConfig): "success" | "warning" | "error" {
	if (!source.lastFetchAt) return "warning"; // Never fetched
	if (source.consecutiveFailures === 0) return "success";
	if (source.consecutiveFailures < 6) return "warning";
	return "error"; // 6+ failures
}

/**
 * Transform SourceConfig to API response
 */
function toResponse(source: SourceConfig): SourceConfigResponse {
	return {
		id: source.id,
		type: source.type,
		config: source.config,
		enabled: source.enabled,
		createdAt: source.createdAt,
		updatedAt: source.updatedAt,
		lastFetchAt: source.lastFetchAt,
		lastSuccessAt: source.lastSuccessAt,
		lastErrorAt: source.lastErrorAt,
		lastErrorMessage: source.lastErrorMessage,
		consecutiveFailures: source.consecutiveFailures,
		deletedAt: source.deletedAt,
		health: calculateHealth(source),
	};
}

export const sourcesRoutes = new Elysia({ prefix: "/sources" })
	.derive(() => ({
		sourcesRepo: new SourceConfigRepository(db),
		feedValidator: new FeedValidatorService(),
	}))
	.get(
		"",
		async ({ sourcesRepo, query }): Promise<ListSourcesResponse> => {
			const sources = await sourcesRepo.list({
				includeDeleted: query.includeDeleted || false,
			});

			return {
				sources: sources.map(toResponse),
			};
		},
		{
			query: t.Object({
				includeDeleted: t.Optional(t.Boolean()),
			}),
		},
	)
	.post(
		"/validate",
		async ({ feedValidator, body }): Promise<ValidateFeedResponse> => {
			const result = await feedValidator.validate(body.url, body.customUserAgent);
			return result;
		},
		{
			body: t.Object({
				url: t.String({ minLength: 1 }),
				customUserAgent: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"",
		async ({ sourcesRepo, body, set }): Promise<SourceConfigResponse> => {
			const source = await sourcesRepo.create({
				url: body.url,
				name: body.name,
				type: body.type,
				customUserAgent: body.customUserAgent,
				feedTitle: body.feedTitle,
				feedDescription: body.feedDescription,
			});
			set.status = 201;
			return toResponse(source);
		},
		{
			body: t.Object({
				url: t.String({ minLength: 1 }),
				name: t.String({ minLength: 1 }),
				type: t.Union([t.Literal("feed"), t.Literal("x")]),
				customUserAgent: t.Optional(t.String()),
				feedTitle: t.Optional(t.String()),
				feedDescription: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/:id",
		async ({ sourcesRepo, params, status }) => {
			const source = await sourcesRepo.findById(params.id);
			if (!source) {
				return status(404, { message: "Source not found" });
			}
			return toResponse(source);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	)
	.put(
		"/:id",
		async ({ sourcesRepo, params, body, status }) => {
			const source = await sourcesRepo.update(params.id, body);
			if (!source) {
				return status(404, { message: "Source not found" });
			}
			return toResponse(source);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
			body: t.Object({
				url: t.Optional(t.String({ minLength: 1 })),
				name: t.Optional(t.String({ minLength: 1 })),
				customUserAgent: t.Optional(t.String()),
				feedTitle: t.Optional(t.String()),
				feedDescription: t.Optional(t.String()),
				enabled: t.Optional(t.Boolean()),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ sourcesRepo, params, status }) => {
			const existing = await sourcesRepo.findById(params.id);
			if (!existing) {
				return status(404, { message: "Source not found" });
			}

			await sourcesRepo.softDelete(params.id);
			return { success: true };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	)
	.patch(
		"/:id/toggle",
		async ({ sourcesRepo, params, status }) => {
			const source = await sourcesRepo.toggle(params.id);
			if (!source) {
				return status(404, { message: "Source not found" });
			}
			return toResponse(source);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	);
