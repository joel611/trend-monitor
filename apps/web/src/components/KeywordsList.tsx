import { Link } from "@tanstack/react-router";
import type { KeywordResponse } from "@trend-monitor/types";
import { Badge } from "./ui/badge";

interface KeywordsListProps {
	keywords: KeywordResponse[];
	onDelete?: (id: string) => void;
}

export function KeywordsList({ keywords, onDelete }: KeywordsListProps) {
	if (keywords.length === 0) {
		return (
			<div className="text-center py-12">
				<h3 className="text-lg font-medium text-gray-900 mb-2">No keywords yet</h3>
				<p className="text-gray-500">Create your first keyword to start monitoring trends</p>
			</div>
		);
	}

	return (
		<div className="bg-white shadow-md rounded-lg overflow-hidden">
			<table className="min-w-full divide-y divide-gray-200">
				<thead className="bg-gray-50">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Name
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Tags
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Aliases
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
					{keywords.map((keyword) => (
						<tr key={keyword.id} className="hover:bg-gray-50">
							<td className="px-6 py-4 whitespace-nowrap">
								<Link
									to="/keywords/$keywordId"
									params={{ keywordId: keyword.id }}
									className="text-primary-600 hover:text-primary-900 font-medium"
								>
									{keyword.name}
								</Link>
							</td>
							<td className="px-6 py-4">
								<div className="flex flex-wrap gap-1">
									{keyword.tags.length > 0 ? (
										keyword.tags.map((tag) => (
											<Badge key={tag} variant="secondary">
												{tag}
											</Badge>
										))
									) : (
										<span className="text-gray-400 text-sm">—</span>
									)}
								</div>
							</td>
							<td className="px-6 py-4">
								<div className="text-sm text-gray-600">
									{keyword.aliases.length > 0 ? (
										keyword.aliases.join(", ")
									) : (
										<span className="text-gray-400">—</span>
									)}
								</div>
							</td>
							<td className="px-6 py-4 whitespace-nowrap">
								<Badge variant={keyword.status === "active" ? "default" : "secondary"}>
									{keyword.status}
								</Badge>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<Link
									to="/keywords/$keywordId"
									params={{ keywordId: keyword.id }}
									className="text-primary-600 hover:text-primary-900 mr-4"
								>
									View
								</Link>
								{onDelete && (
									<button
										onClick={() => onDelete(keyword.id)}
										className="text-red-600 hover:text-red-900"
									>
										Delete
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
