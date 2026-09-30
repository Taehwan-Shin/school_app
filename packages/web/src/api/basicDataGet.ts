import { useQuery } from '@tanstack/react-query';
import type { BasicDataYear } from '@school-app/shared';
import { callCallable } from './callCallable';

export interface BasicDataGetResponse {
  data: BasicDataYear | null;
}

export async function callBasicDataGet(year: number): Promise<BasicDataGetResponse> {
  return callCallable<{ year: number }, BasicDataGetResponse>(
    'basicDataGet',
    { year },
  );
}

export function useBasicDataGet(year: number, enabled = true) {
  return useQuery<BasicDataGetResponse, Error>({
    queryKey: ['basic_data', 'get', year],
    queryFn: () => callBasicDataGet(year),
    enabled,
    staleTime: 60_000,
    // 4xx 는 재시도 안 함 (denied audit 중복 방지).
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
