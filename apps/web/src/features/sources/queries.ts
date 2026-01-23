import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export function sourcesQueryOptions() {
  return queryOptions({
    queryKey: ['sources'],
    queryFn: async () => {
      const response = await apiClient.api.sources.get();
      return response.data;
    },
  });
}
