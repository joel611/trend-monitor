import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateSourceRequest, UpdateSourceRequest } from "@trend-monitor/types";
import { apiClient, ingestionClient } from "../../lib/api";

export function useCreateSource() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateSourceRequest) => {
			const response = await apiClient.api.sources.post(data);
			if (response.error) throw new Error("Failed to create source");
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});
}

export function useUpdateSource() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: UpdateSourceRequest }) => {
			const response = await apiClient.api.sources({ id }).put(data);
			if (response.error) throw new Error("Failed to update source");
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});
}

export function useDeleteSource() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			await apiClient.api.sources({ id }).delete();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});
}

export function useToggleSourceStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
			// Use PUT endpoint with enabled field to set the status
			const response = await apiClient.api.sources({ id }).put({ enabled });
			if (response.error) throw new Error("Failed to toggle source status");
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});
}

export function useTriggerAllSources() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const response = await ingestionClient.trigger.all.post();
			if (response.error) throw new Error("Failed to trigger ingestion");
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});
}

export function useTriggerSource() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const response = await ingestionClient.trigger({ id }).post();
			if (response.error) throw new Error("Failed to trigger source");
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
		},
	});
}
