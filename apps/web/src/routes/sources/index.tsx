import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "../../components/Layout";
import { SourcesTable } from "../../components/sources/SourcesTable";
import { SourceSidePanel } from "../../components/sources/SourceSidePanel";
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
import { apiClient } from "../../lib/api";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

export const Route = createFileRoute("/sources/")({
	component: SourcesPage,
});

function SourcesPage() {
	const queryClient = useQueryClient();
	const [sidePanelOpen, setSidePanelOpen] = useState(false);
	const [sidePanelMode, setSidePanelMode] = useState<"add" | "edit">("add");
	const [selectedSource, setSelectedSource] = useState<SourceConfigWithHealth | undefined>();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [sourceToDelete, setSourceToDelete] = useState<SourceConfigWithHealth | undefined>();

	const { data, isLoading } = useQuery({
		queryKey: ["sources"],
		queryFn: async () => {
			const response = await apiClient.api.sources.get();
			return response.data;
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			await apiClient.api.sources({ id }).delete();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			setDeleteDialogOpen(false);
			setSourceToDelete(undefined);
		},
	});

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
			deleteMutation.mutate(sourceToDelete.id);
		}
	};

	return (
		<Layout>
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
		</Layout>
	);
}
