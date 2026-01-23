import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function trendsOverviewQueryOptions() {
  return queryOptions({
    queryKey: ['trends', 'overview'],
    queryFn: async () => {
      const response = await apiClient.api.trends.overview.get();
      if (response.error) throw new Error('Failed to fetch trends');
      return response.data;
    },
  });
}

export function trendDataQueryOptions(keywordId: string) {
  return queryOptions({
    queryKey: ['trends', keywordId],
    queryFn: async () => {
      const response = await apiClient.api.trends({ keywordId }).get();
      if (response.error) throw new Error('Failed to fetch trend');
      return response.data;
    },
  });
}
