import { Badge } from "./ui/badge";
import type { MentionResponse } from "@trend-monitor/types";

interface MentionsListProps {
	mentions: MentionResponse[];
}

export function MentionsList({ mentions }: MentionsListProps) {
	if (mentions.length === 0) {
		return (
			<div className="text-center py-12 text-gray-500">
				No mentions found
			</div>
		);
	}

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	return (
		<div className="space-y-4">
			{mentions.map((mention) => (
				<div
					key={mention.id}
					className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
				>
					<div className="flex items-start justify-between mb-2">
						<div className="flex-1">
							{mention.title && (
								<h3 className="font-medium text-gray-900 mb-1">
									{mention.title}
								</h3>
							)}
							<p className="text-sm text-gray-600 line-clamp-3">
								{mention.content}
							</p>
						</div>
						<Badge variant="secondary">{mention.source}</Badge>
					</div>
					<div className="flex items-center justify-between mt-3 text-sm">
						<div className="flex items-center space-x-4 text-gray-500">
							{mention.author && <span>By {mention.author}</span>}
							<span>{formatDate(mention.createdAt)}</span>
						</div>
						<a
							href={mention.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary-600 hover:text-primary-900"
						>
							View source →
						</a>
					</div>
				</div>
			))}
		</div>
	);
}
