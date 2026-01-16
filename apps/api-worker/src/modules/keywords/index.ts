import { Elysia, t } from "elysia";
import { KeywordsRepository } from "./repository";
import type {
	CreateKeywordRequest,
	UpdateKeywordRequest,
	KeywordResponse,
	ListKeywordsResponse,
} from "@trend-monitor/types";
import { db } from "../../lib/db";

export const keywordsRoutes = new Elysia({ prefix: "/keywords" })
	.derive(() => ({
		keywordsRepo: new KeywordsRepository(db),
	}))
	.get(
		"",
		async ({ keywordsRepo, query }): Promise<ListKeywordsResponse> => {
			let keywords = await keywordsRepo.list();

			// Filter by status if provided
			if (query.status) {
				keywords = keywords.filter((k) => k.status === query.status);
			}

			// Filter by tag if provided
			if (query.tag) {
				keywords = keywords.filter((k) => k.tags.includes(query.tag!));
			}

			return {
				keywords: keywords.map(toResponse),
				total: keywords.length,
			};
		},
		{
			query: t.Object({
				status: t.Optional(t.Union([t.Literal("active"), t.Literal("archived")])),
				tag: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"",
		async ({ keywordsRepo, body, set }): Promise<KeywordResponse> => {
			const keyword = await keywordsRepo.create({
				name: body.name,
				aliases: body.aliases || [],
				tags: body.tags || [],
			});
			set.status = 201;
			return toResponse(keyword);
		},
		{
			body: t.Object({
				name: t.String({ minLength: 1 }),
				aliases: t.Optional(t.Array(t.String())),
				tags: t.Optional(t.Array(t.String())),
			}),
		},
	)
	.get(
		"/:id",
		async ({ keywordsRepo, params, status }) => {
			const keyword = await keywordsRepo.findById(params.id);
			if (!keyword) {
				return status(404, { message: "Keyword not found" });
			}
			return toResponse(keyword);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	)
	.put(
		"/:id",
		async ({ keywordsRepo, params, body, status }) => {
			const keyword = await keywordsRepo.update(params.id, body);
			if (!keyword) {
				return status(404, { message: "Keyword not found" });
			}
			return toResponse(keyword);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
			body: t.Object({
				name: t.Optional(t.String({ minLength: 1 })),
				aliases: t.Optional(t.Array(t.String())),
				tags: t.Optional(t.Array(t.String())),
				status: t.Optional(t.Union([t.Literal("active"), t.Literal("archived")])),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ keywordsRepo, params, status }) => {
			// Check if keyword exists first
			const keyword = await keywordsRepo.findById(params.id);
			if (!keyword) {
				return status(404, { message: "Keyword not found" });
			}

			await keywordsRepo.delete(params.id);
			return status(204);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	);

function toResponse(keyword: any): KeywordResponse {
	return {
		id: keyword.id,
		name: keyword.name,
		aliases: keyword.aliases,
		tags: keyword.tags,
		status: keyword.status,
		createdAt: keyword.createdAt,
		updatedAt: keyword.updatedAt,
	};
}
