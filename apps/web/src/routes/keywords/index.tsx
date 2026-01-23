import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { KeywordsList } from "../../components/KeywordsList";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../../components/ui/dialog";
import { KeywordForm } from "../../components/KeywordForm";
import { SkeletonTable } from "../../components/Skeleton";
import { keywordsQueryOptions } from "../../features/keywords/queries";
import { useCreateKeyword, useDeleteKeyword } from "../../features/keywords/mutations";

export const Route = createFileRoute("/keywords/")({
	component: Keywords,
});

function Keywords() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const { data, isLoading, error } = useQuery(keywordsQueryOptions());

	const createMutation = useCreateKeyword();
	const deleteMutation = useDeleteKeyword();

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to archive this keyword?")) {
			deleteMutation.mutate(id);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-gray-900">Keywords</h1>
						<p className="mt-2 text-gray-600">Loading...</p>
					</div>
				</div>
				<SkeletonTable />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-red-600">Error loading keywords: {error.message}</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Keywords</h1>
					<p className="mt-2 text-gray-600">Manage your monitored keywords and their aliases</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger render={<Button />}>Add Keyword</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add New Keyword</DialogTitle>
							<DialogDescription>
								Create a new keyword to monitor across multiple sources.
							</DialogDescription>
						</DialogHeader>
						<KeywordForm
							onSubmit={(data) => {
							createMutation.mutate(data, {
								onSuccess: () => setIsDialogOpen(false),
							});
						}}
							onCancel={() => setIsDialogOpen(false)}
							isSubmitting={createMutation.isPending}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{data && <KeywordsList keywords={data.keywords} onDelete={handleDelete} />}
		</div>
	);
}
