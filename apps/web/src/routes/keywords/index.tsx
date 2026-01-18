import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
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
import type { CreateKeywordRequest } from "@trend-monitor/types";

export const Route = createFileRoute("/keywords/")({
	component: Keywords,
});

function Keywords() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["keywords"],
		queryFn: async () => {
			const response = await api.keywords.get();
			if (response.error) throw new Error("Failed to fetch keywords");
			return response.data;
		},
	});

	const createMutation = useMutation({
		mutationFn: async (data: CreateKeywordRequest) => {
			const response = await api.keywords.post(data);
			if (response.error) throw new Error("Failed to create keyword");
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
			setIsDialogOpen(false);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const response = await api.keywords({ id }).delete();
			if (response.error) throw new Error("Failed to delete keyword");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
		},
	});

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to archive this keyword?")) {
			deleteMutation.mutate(id);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading keywords...</div>
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
					<p className="mt-2 text-gray-600">
						Manage your monitored keywords and their aliases
					</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button>Add Keyword</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add New Keyword</DialogTitle>
							<DialogDescription>
								Create a new keyword to monitor across multiple sources.
							</DialogDescription>
						</DialogHeader>
						<KeywordForm
							onSubmit={(data) => createMutation.mutate(data)}
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
