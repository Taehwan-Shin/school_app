import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { AuditLogEntryRead } from './auditLogList';

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
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/auditLogUnresolvedRoleSplits`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/auditLogUnresolvedRoleSplits`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,
      'X-Google-Scopes': '',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { ...data, _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as AuditLogUnresolvedRoleSplitsResponse;
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
