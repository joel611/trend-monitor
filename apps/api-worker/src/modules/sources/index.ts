import { Elysia, t } from "elysia";
import { SourceConfigRepository } from "@trend-monitor/db/repositories";
import { FeedValidatorService } from "../../services/feed-validator";
import type { SourceConfig, SourceConfigWithHealth } from "@trend-monitor/types";
import { db } from "../../lib/db";

export const sourcesRoutes = new Elysia({ prefix: "/sources" })
	.derive(() => ({
		sourceRepo: new SourceConfigRepository(db),
		feedValidator: new FeedValidatorService(),
	}))
	.get("", async ({ sourceRepo }) => {
		const sources = await sourceRepo.listWithHealth();
		return sources;
	})
	.post(
		"/validate",
		async ({ feedValidator, body }) => {
			const result = await feedValidator.validate(
				body.url,
				body.customUserAgent
			);
			return result;
		},
		{
			body: t.Object({
				url: t.String({ format: "uri" }),
				customUserAgent: t.Optional(t.String()),
			}),
		}
	)
	.post(
		"",
		async ({ sourceRepo, body, set }) => {
			const source = await sourceRepo.create({
				url: body.url,
				name: body.name,
				type: body.type,
				customUserAgent: body.customUserAgent,
				feedTitle: body.feedTitle,
				feedDescription: body.feedDescription,
			});
			set.status = 201;
			return source;
		},
		{
			body: t.Object({
				url: t.String({ format: "uri" }),
				name: t.String({ minLength: 1 }),
				type: t.Union([t.Literal("feed"), t.Literal("x")]),
				customUserAgent: t.Optional(t.String()),
				feedTitle: t.Optional(t.String()),
				feedDescription: t.Optional(t.String()),
			}),
		}
	)
	.get(
		"/:id",
		async ({ sourceRepo, params, set }) => {
			const source = await sourceRepo.findById(params.id);
			if (!source) {
				set.status = 404;
				return null;
			}
			return source;
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	)
	.put(
		"/:id",
		async ({ sourceRepo, params, body, set }) => {
			const source = await sourceRepo.update(params.id, {
				url: body.url,
				name: body.name,
				customUserAgent: body.customUserAgent,
				feedTitle: body.feedTitle,
				feedDescription: body.feedDescription,
				enabled: body.enabled,
			});
			if (!source) {
				set.status = 404;
				return null;
			}
			return source;
		},
		{
			params: t.Object({
				id: t.String(),
			}),
			body: t.Object({
				url: t.Optional(t.String({ format: "uri" })),
				name: t.Optional(t.String({ minLength: 1 })),
				customUserAgent: t.Optional(t.String()),
				feedTitle: t.Optional(t.String()),
				feedDescription: t.Optional(t.String()),
				enabled: t.Optional(t.Boolean()),
			}),
		}
	)
	.delete(
		"/:id",
		async ({ sourceRepo, params, set }) => {
			const existing = await sourceRepo.findById(params.id);
			if (!existing) {
				set.status = 404;
				return null;
			}

			await sourceRepo.softDelete(params.id);
			return { success: true };
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	)
	.patch(
		"/:id/toggle",
		async ({ sourceRepo, params, set }) => {
			const source = await sourceRepo.toggle(params.id);
			if (!source) {
				set.status = 404;
				return null;
			}
			return source;
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	);
