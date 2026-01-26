import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

interface ActionButtonsProps {
	source: SourceConfigWithHealth;
	onEdit: (source: SourceConfigWithHealth) => void;
	onDelete: (source: SourceConfigWithHealth) => void;
	onTrigger: (source: SourceConfigWithHealth) => void;
	isTriggeringSource?: boolean;
}

export function ActionButtons({
	source,
	onEdit,
	onDelete,
	onTrigger,
	isTriggeringSource,
}: ActionButtonsProps) {
	return (
		<div className="flex gap-2">
			<Button
				variant="ghost"
				size="sm"
				onClick={() => onTrigger(source)}
				title="Trigger ingestion now"
				disabled={isTriggeringSource}
			>
				<RefreshCw className={`h-4 w-4 ${isTriggeringSource ? "animate-spin" : ""}`} />
			</Button>
			<Button variant="ghost" size="sm" onClick={() => onEdit(source)} title="Edit source">
				<Pencil className="h-4 w-4" />
			</Button>
			<Button variant="ghost" size="sm" onClick={() => onDelete(source)} title="Delete source">
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}
