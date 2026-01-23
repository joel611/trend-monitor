import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { AddSourceForm } from "./AddSourceForm";
import { EditSourceForm } from "./EditSourceForm";

interface SourceSidePanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "add" | "edit";
	source?: SourceConfigWithHealth;
}

export function SourceSidePanel({ open, onOpenChange, mode, source }: SourceSidePanelProps) {
	const handleSuccess = () => {
		onOpenChange(false);
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>{mode === "add" ? "Add New Source" : "Edit Source"}</SheetTitle>
				</SheetHeader>
				{mode === "add" ? (
					<AddSourceForm onSuccess={handleSuccess} onCancel={handleCancel} />
				) : source ? (
					<EditSourceForm source={source} onSuccess={handleSuccess} onCancel={handleCancel} />
				) : null}
			</SheetContent>
		</Sheet>
	);
}
