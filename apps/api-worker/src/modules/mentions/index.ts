import { Elysia, t } from "elysia";
import { MentionsRepository } from "@trend-monitor/db/repositories";
import type { ListMentionsResponse, MentionResponse } from "@trend-monitor/types";
import { db } from "../../lib/db";

export const mentionsRoutes = new Elysia({ prefix: "/mentions" })
	.derive(() => ({
		mentionsRepo: new MentionsRepository(db),
	}))
	.get(
		"",
		async ({ mentionsRepo, query }): Promise<ListMentionsResponse> => {
			const result = await mentionsRepo.list({
				keywordId: query.keywordId,
				source: query.source,
				from: query.from,
				to: query.to,
				limit: query.limit || 20,
				offset: query.offset || 0,
			});

			return {
				mentions: result.mentions.map(toResponse),
				total: result.total,
				limit: query.limit || 20,
				offset: query.offset || 0,
			};
		},
		{
			query: t.Object({
				keywordId: t.Optional(t.String()),
				source: t.Optional(t.Union([t.Literal("reddit"), t.Literal("x"), t.Literal("feed")])),
				from: t.Optional(t.String()),
				to: t.Optional(t.String()),
				limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
				offset: t.Optional(t.Number({ minimum: 0 })),
			}),
		},
	)
	.get(
		"/:id",
		async ({ mentionsRepo, params, status }) => {
			const mention = await mentionsRepo.findById(params.id);
			if (!mention) {
				return status(404, { message: "Mention not found" });
			}
			return toResponse(mention);
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	);

function toResponse(mention: any): MentionResponse {
	return {
		id: mention.id,
		source: mention.source,
		sourceId: mention.sourceId,
		title: mention.title,
		content: mention.content,
		url: mention.url,
		author: mention.author,
		createdAt: mention.createdAt,
		fetchedAt: mention.fetchedAt,
		matchedKeywords: mention.matchedKeywords,
	};
}
