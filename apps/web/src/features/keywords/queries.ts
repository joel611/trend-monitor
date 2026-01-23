import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function keywordsQueryOptions() {
  return queryOptions({
    queryKey: ['keywords'],
    queryFn: async () => {
      const response = await apiClient.api.keywords.get();
      if (response.error) throw new Error('Failed to fetch keywords');
      return response.data;
    },
  });
}

export function keywordDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['keywords', id],
    queryFn: async () => {
      const response = await apiClient.api.keywords({ id }).get();
      if (response.error) throw new Error('Failed to fetch keyword');
      return response.data;
    },
  });
}
