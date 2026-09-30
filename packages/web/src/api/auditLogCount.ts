import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface AuditLogCountResponse {
  count: number;
}

export interface UseAuditLogCountOptions {
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}

export async function callAuditLogCount(
  data: UseAuditLogCountOptions = {}
): Promise<AuditLogCountResponse> {
  return callCallable<UseAuditLogCountOptions, AuditLogCountResponse>(
    'auditLogCount',
    data,
  );
}

export function useAuditLogCount(options?: UseAuditLogCountOptions, enabled = true) {
  return useQuery<AuditLogCountResponse, Error>({
    queryKey: [
      'audit',
      'count',
      options?.atMin,
      options?.atMax,
      options?.filterActor,
      options?.filterTarget,
      options?.filterResult,
    ],
    queryFn: () => callAuditLogCount(options ?? {}),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
