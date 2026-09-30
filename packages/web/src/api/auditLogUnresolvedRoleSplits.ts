import { useQuery } from '@tanstack/react-query';
import type { AuditLogEntryRead } from './auditLogList';
import { callCallable } from './callCallable';

export interface UseAuditLogUnresolvedRoleSplitsOptions {
  atMin?: number;
  scanLimit?: number;
}

export interface AuditLogUnresolvedRoleSplitsResponse {
  entries: AuditLogEntryRead[];
  scannedDetected: number;
  scannedResolved: number;
  detectedHasMore: boolean;
  resolvedHasMore: boolean;
}

export async function callAuditLogUnresolvedRoleSplits(
  data: UseAuditLogUnresolvedRoleSplitsOptions = {},
): Promise<AuditLogUnresolvedRoleSplitsResponse> {
  return callCallable<UseAuditLogUnresolvedRoleSplitsOptions, AuditLogUnresolvedRoleSplitsResponse>(
    'auditLogUnresolvedRoleSplits',
    data,
  );
}

export function useAuditLogUnresolvedRoleSplits(
  options?: UseAuditLogUnresolvedRoleSplitsOptions,
  enabled = true,
) {
  return useQuery<AuditLogUnresolvedRoleSplitsResponse, Error>({
    queryKey: ['audit', 'unresolvedRoleSplits', options?.atMin, options?.scanLimit],
    queryFn: () => callAuditLogUnresolvedRoleSplits(options ?? {}),
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
