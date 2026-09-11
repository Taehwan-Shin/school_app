import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface OrgunitEntry {
  orgUnitPath: string;
  name?: string;
  description?: string;
  parentOrgUnitPath?: string;
}

export interface OrgunitsListResponse {
  orgUnits: OrgunitEntry[];
}

export async function callOrgunitsList(): Promise<OrgunitsListResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/orgunitsList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/orgunitsList`;

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
      'X-Google-Scopes': 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as OrgunitsListResponse;
}

export function useOrgunitsList(enabled = true) {
  return useQuery<OrgunitsListResponse, Error>({
    queryKey: ['orgunits', 'list'],
    queryFn: callOrgunitsList,
    enabled,
    staleTime: 60_000, // 1분 캐시 — dialog 여러 번 열어도 재요청 안 함.
  });
}
