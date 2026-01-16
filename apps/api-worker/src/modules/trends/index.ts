import { Elysia, t } from "elysia";
import { TrendsService } from "../../services/trends-service";
import type {
	TrendsOverviewResponse,
	KeywordTrendResponse,
} from "@trend-monitor/types";
import { db } from "../../lib/db";

export const trendsRoutes = new Elysia({ prefix: "/trends" })
	.derive(() => ({
		trendsService: new TrendsService(db),
	}))
	.get(
		"/overview",
		async ({
			trendsService,
			query,
		}): Promise<TrendsOverviewResponse> => {
			return await trendsService.getOverview({
				from: query.from,
				to: query.to,
			});
		},
		{
			query: t.Object({
				from: t.Optional(t.String()),
				to: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/:keywordId",
		async ({ trendsService, params, query, status }) => {
			try {
				const result: KeywordTrendResponse =
					await trendsService.getKeywordTrend(params.keywordId, {
						from: query.from,
						to: query.to,
						source: query.source,
					});

				// Check if keyword was found (empty name means not found)
				if (!result.name) {
					return status(404, { message: "Keyword not found" });
				}

				return result;
			} catch (err) {
				return status(404, { message: "Keyword not found" });
			}
		},
		{
			params: t.Object({
				keywordId: t.String(),
			}),
			query: t.Object({
				from: t.Optional(t.String()),
				to: t.Optional(t.String()),
				source: t.Optional(
					t.Union([t.Literal("reddit"), t.Literal("x"), t.Literal("feed")]),
				),
			}),
		},
	);
