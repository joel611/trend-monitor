import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { FeedValidationResult } from "@trend-monitor/types";

interface FeedPreviewProps {
	validation: FeedValidationResult;
}

export function FeedPreview({ validation }: FeedPreviewProps) {
	if (!validation.valid || !validation.metadata) {
		return null;
	}

	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle>Feed Preview</CardTitle>
				<CardDescription>
					{validation.metadata.title} • {validation.metadata.format.toUpperCase()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{validation.metadata.description && (
					<p className="text-sm text-muted-foreground mb-4">
						{validation.metadata.description}
					</p>
				)}

				{validation.preview && validation.preview.length > 0 && (
					<div>
						<h4 className="font-medium mb-2">Recent Items:</h4>
						<ul className="space-y-2">
							{validation.preview.map((item, idx) => (
								<li key={idx} className="border-l-2 border-primary pl-3">
									<a
										href={item.link}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium hover:underline"
									>
										{item.title}
									</a>
									{item.pubDate && (
										<p className="text-xs text-muted-foreground">
											{new Date(item.pubDate).toLocaleString()}
										</p>
									)}
									{item.content && (
										<p className="text-sm text-muted-foreground mt-1">
											{item.content}
										</p>
									)}
								</li>
							))}
						</ul>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
