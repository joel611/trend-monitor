import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MentionsList } from "../../components/MentionsList";
import { TrendChart } from "../../components/TrendChart";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { keywordDetailQueryOptions } from "../../features/keywords/queries";
import { mentionsQueryOptions } from "../../features/mentions/queries";
import { trendDataQueryOptions } from "../../features/trends/queries";

export const Route = createFileRoute("/keywords/$keywordId")({
	component: KeywordDetail,
});

function KeywordDetail() {
	const { keywordId } = Route.useParams();

	const { data: keyword, isLoading: keywordLoading } = useQuery(
		keywordDetailQueryOptions(keywordId),
	);

	const { data: trend, isLoading: trendLoading } = useQuery(trendDataQueryOptions(keywordId));

	const { data: mentions, isLoading: mentionsLoading } = useQuery(
		mentionsQueryOptions(keywordId, 20),
	);

	const isLoading = keywordLoading || trendLoading || mentionsLoading;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading keyword details...</div>
			</div>
		);
	}

	if (!keyword || !trend) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Keyword not found</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center space-x-3 mb-2">
					<h1 className="text-3xl font-bold text-gray-900">{keyword.name}</h1>
					<Badge variant={keyword.status === "active" ? "default" : "secondary"}>
						{keyword.status}
					</Badge>
				</div>
				{keyword.tags.length > 0 && (
					<div className="flex flex-wrap gap-2 mt-2">
						{keyword.tags.map((tag: string) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</div>
				)}
				{keyword.aliases.length > 0 && (
					<p className="mt-2 text-gray-600">Aliases: {keyword.aliases.join(", ")}</p>
				)}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="p-6">
					<div className="text-sm font-medium text-gray-500">Total Mentions</div>
					<div className="mt-1 text-3xl font-semibold text-gray-900">{trend.totalMentions}</div>
				</Card>
				<Card className="p-6">
					<div className="text-sm font-medium text-gray-500">Average per Day</div>
					<div className="mt-1 text-3xl font-semibold text-gray-900">
						{trend.averagePerDay.toFixed(1)}
					</div>
				</Card>
				<Card className="p-6">
					<div className="text-sm font-medium text-gray-500">Data Points</div>
					<div className="mt-1 text-3xl font-semibold text-gray-900">{trend.timeSeries.length}</div>
				</Card>
			</div>

			<Card className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Over Time</h2>
				<TrendChart data={trend.timeSeries} />
			</Card>

			<div>
				<h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Mentions</h2>
				{mentions && <MentionsList mentions={mentions.mentions} />}
			</div>
		</div>
	);
}
