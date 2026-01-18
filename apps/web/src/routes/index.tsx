import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatsCard } from "../components/StatsCard";
import { TrendsList } from "../components/TrendsList";
import { SkeletonCard } from "../components/Skeleton";

export const Route = createFileRoute("/")({
	component: Overview,
});

function Overview() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["trends", "overview"],
		queryFn: async () => {
			const response = await api.trends.overview.get();
			if (response.error) throw new Error("Failed to fetch trends");
			return response.data;
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Trends Overview</h1>
					<p className="mt-2 text-gray-600">Loading...</p>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Error loading trends: {error.message}</div>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-gray-900">Trends Overview</h1>
				<p className="mt-2 text-gray-600">
					Monitor technical keywords and emerging trends across multiple sources
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<StatsCard title="Total Mentions" value={data.totalMentions} />
				<StatsCard
					title="Active Keywords"
					value={data.topKeywords.length}
				/>
				<StatsCard
					title="Emerging Topics"
					value={data.emergingKeywords.length}
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<TrendsList title="Top Keywords" keywords={data.topKeywords} />
				<TrendsList
					title="Emerging Keywords"
					keywords={data.emergingKeywords}
				/>
			</div>

			{data.sourceBreakdown.length > 0 && (
				<div className="bg-white rounded-lg shadow-md p-6">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">
						Source Breakdown
					</h2>
					<div className="space-y-3">
						{data.sourceBreakdown.map((item) => (
							<div key={item.source} className="flex items-center justify-between">
								<span className="text-gray-700 capitalize">{item.source}</span>
								<span className="text-gray-900 font-medium">{item.count} mentions</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
