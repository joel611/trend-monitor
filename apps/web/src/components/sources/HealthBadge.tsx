import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { Badge } from "../ui/badge";

interface HealthBadgeProps {
	source: SourceConfigWithHealth;
}

export function HealthBadge({ source }: HealthBadgeProps) {
	const getHealthColor = () => {
		switch (source.health) {
			case "success":
				return "bg-green-500 hover:bg-green-600";
			case "warning":
				return "bg-yellow-500 hover:bg-yellow-600";
			case "error":
				return "bg-red-500 hover:bg-red-600";
		}
	};

	const getHealthLabel = () => {
		switch (source.health) {
			case "success":
				return "Healthy";
			case "warning":
				return "Warning";
			case "error":
				return "Error";
		}
	};

	const getTooltipText = () => {
		if (!source.lastFetchAt) {
			return "Never fetched";
		}

		const parts = [];
		if (source.lastSuccessAt) {
			parts.push(`Last success: ${new Date(source.lastSuccessAt).toLocaleString()}`);
		}
		if (source.consecutiveFailures > 0) {
			parts.push(`${source.consecutiveFailures} consecutive failures`);
		}
		if (source.lastErrorMessage) {
			parts.push(`Last error: ${source.lastErrorMessage}`);
		}

		return parts.join(" • ");
	};

	return (
		<Badge className={getHealthColor()} title={getTooltipText()}>
			{getHealthLabel()}
		</Badge>
	);
}
