import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "../ui/switch";
import { api } from "../../lib/api";
import type { SourceConfigWithHealth } from "@trend-monitor/types";

interface StatusToggleProps {
	source: SourceConfigWithHealth;
}

export function StatusToggle({ source }: StatusToggleProps) {
	const queryClient = useQueryClient();

	const toggleMutation = useMutation({
		mutationFn: async (id: string) => {
			const response = await api.sources[id].toggle.patch();
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});

	return (
		<Switch
			checked={source.enabled}
			onCheckedChange={() => toggleMutation.mutate(source.id)}
			disabled={toggleMutation.isPending}
		/>
	);
}
