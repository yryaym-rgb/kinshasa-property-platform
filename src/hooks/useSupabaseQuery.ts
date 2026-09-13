import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';

interface UseSupabaseQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: number;
}

export function useSupabaseQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000,
  gcTime = 10 * 60 * 1000,
  refetchOnWindowFocus = true,
  retry = 2,
}: UseSupabaseQueryOptions<T>) {
  return useQuery<T, Error>({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry,
  } satisfies UseQueryOptions<T, Error>);
}
