import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function mentionsQueryOptions(keywordId: string, limit = 20) {
  return queryOptions({
    queryKey: ['mentions', keywordId, { limit }],
    queryFn: async () => {
      const response = await apiClient.api.mentions.get({
        query: { keywordId, limit },
      });
      if (response.error) throw new Error('Failed to fetch mentions');
      return response.data;
    },
  });
}
