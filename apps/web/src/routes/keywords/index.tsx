import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { KeywordsList } from "../../components/KeywordsList";

export const Route = createFileRoute("/keywords/")({
	component: Keywords,
});

function Keywords() {
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["keywords"],
		queryFn: async () => {
			const response = await api.keywords.get();
			if (response.error) throw new Error("Failed to fetch keywords");
			return response.data;
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
				<Button>Add Keyword</Button>
			</div>

			{data && <KeywordsList keywords={data.keywords} onDelete={handleDelete} />}
		</div>
	);
}
