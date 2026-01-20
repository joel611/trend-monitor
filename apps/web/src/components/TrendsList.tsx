import { Link } from "@tanstack/react-router";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import type { TrendKeyword } from "@trend-monitor/types";

interface TrendsListProps {
	title: string;
	keywords: TrendKeyword[];
	showGrowth?: boolean;
}

export function TrendsList({ title, keywords, showGrowth = true }: TrendsListProps) {
	if (keywords.length === 0) {
		return (
			<Card className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
				<p className="text-gray-500 text-sm">No trends to display</p>
			</Card>
		);
	}

	return (
		<Card className="p-6">
			<h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
			<div className="space-y-3">
				{keywords.map((keyword) => (
					<Link
						key={keyword.keywordId}
						to="/keywords/$keywordId"
						params={{ keywordId: keyword.keywordId }}
						className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<span className="font-medium text-gray-900">{keyword.name}</span>
								{keyword.isEmerging && (
									<Badge variant="default">Emerging</Badge>
								)}
							</div>
							<div className="flex items-center space-x-4 text-sm">
								<span className="text-gray-600">
									{keyword.currentPeriod} mentions
								</span>
								{showGrowth && keyword.growthRate !== 0 && (
									<span
										className={`font-medium ${keyword.growthRate > 0 ? "text-green-600" : "text-red-600"}`}
									>
										{keyword.growthRate > 0 ? "↑" : "↓"}{" "}
										{Math.abs(keyword.growthRate).toFixed(1)}%
									</span>
								)}
							</div>
						</div>
					</Link>
				))}
			</div>
		</Card>
	);
}
