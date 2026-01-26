import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { SourceConfigWithHealth } from "@trend-monitor/types";
import { useState } from "react";
import { toast } from "sonner";
import { SourceSidePanel } from "../../components/sources/SourceSidePanel";
import { SourcesTable } from "../../components/sources/SourcesTable";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
	useDeleteSource,
	useTriggerAllSources,
	useTriggerSource,
} from "../../features/sources/mutations";
import { sourcesQueryOptions } from "../../features/sources/queries";

export const Route = createFileRoute("/sources/")({
	component: SourcesPage,
});

function SourcesPage() {
	const [sidePanelOpen, setSidePanelOpen] = useState(false);
	const [sidePanelMode, setSidePanelMode] = useState<"add" | "edit">("add");
	const [selectedSource, setSelectedSource] = useState<SourceConfigWithHealth | undefined>();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [sourceToDelete, setSourceToDelete] = useState<SourceConfigWithHealth | undefined>();
	const [triggeringSourceId, setTriggeringSourceId] = useState<string | null>(null);

	const { data, isLoading } = useQuery(sourcesQueryOptions());

	const deleteMutation = useDeleteSource();
	const triggerAllMutation = useTriggerAllSources();
	const triggerSourceMutation = useTriggerSource();

	const handleAddSource = () => {
		setSidePanelMode("add");
		setSelectedSource(undefined);
		setSidePanelOpen(true);
	};

	const handleEditSource = (source: SourceConfigWithHealth) => {
		setSidePanelMode("edit");
		setSelectedSource(source);
		setSidePanelOpen(true);
	};

	const handleDeleteSource = (source: SourceConfigWithHealth) => {
		setSourceToDelete(source);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = () => {
		if (sourceToDelete) {
			deleteMutation.mutate(sourceToDelete.id, {
				onSuccess: () => {
					setDeleteDialogOpen(false);
					setSourceToDelete(undefined);
				},
			});
		}
	};

	const handleTriggerAll = () => {
		triggerAllMutation.mutate(undefined, {
			onSuccess: (data) => {
				toast.success("Ingestion triggered", {
					description: `${data.summary.successfulSources} succeeded, ${data.summary.failedSources} failed. ${data.summary.totalEvents} events processed.`,
				});
			},
			onError: (error) => {
				toast.error("Failed to trigger ingestion", {
					description: error.message,
				});
			},
		});
	};

	const handleTriggerSource = (source: SourceConfigWithHealth) => {
		setTriggeringSourceId(source.id);
		triggerSourceMutation.mutate(source.id, {
			onSuccess: (data) => {
				setTriggeringSourceId(null);
				if (data.success) {
					toast.success(`${data.sourceName} triggered`, {
						description: `${data.eventsCount} events processed`,
					});
				} else {
					toast.error(`${data.sourceName} failed`, {
						description: data.error,
					});
				}
			},
			onError: (error) => {
				toast.error("Failed to trigger source", {
					description: error.message,
				});
				setTriggeringSourceId(null);
			},
		});
	};

	return (
		<>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Sources</h1>
					<p className="text-gray-600 mt-1">Manage RSS/Atom feed sources for trend monitoring</p>
				</div>

				{isLoading ? (
					<div className="text-center py-12">Loading sources...</div>
				) : (
					<SourcesTable
						sources={data || []}
						onAddSource={handleAddSource}
						onEditSource={handleEditSource}
						onDeleteSource={handleDeleteSource}
						onTriggerSource={handleTriggerSource}
						onTriggerAll={handleTriggerAll}
						isTriggeringAll={triggerAllMutation.isPending}
						triggeringSourceId={triggeringSourceId}
					/>
				)}
			</div>

			<SourceSidePanel
				open={sidePanelOpen}
				onOpenChange={setSidePanelOpen}
				mode={sidePanelMode}
				source={selectedSource}
			/>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Source</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{sourceToDelete?.config.name}"? This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
