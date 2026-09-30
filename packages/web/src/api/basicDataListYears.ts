import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface BasicDataListYearsResponse {
  years: number[];
}

export async function callBasicDataListYears(): Promise<BasicDataListYearsResponse> {
  return callCallable<Record<string, never>, BasicDataListYearsResponse>(
    'basicDataListYears',
    {},
  );
}

export function useBasicDataListYears(enabled = true) {
  return useQuery<BasicDataListYearsResponse, Error>({
    queryKey: ['basic_data', 'list_years'],
    queryFn: () => callBasicDataListYears(),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
