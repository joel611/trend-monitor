import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import type { CreateKeywordRequest } from '@trend-monitor/types';

export function useCreateKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateKeywordRequest) => {
      const response = await apiClient.api.keywords.post(data);
      if (response.error) throw new Error('Failed to create keyword');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
    },
  });
}

export function useDeleteKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.api.keywords({ id }).delete();
      if (response.error) throw new Error('Failed to delete keyword');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
    },
  });
}
