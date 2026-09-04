import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { BasicDataYear } from '@school-app/shared';

export interface BasicDataGetResponse {
  data: BasicDataYear | null;
}

export async function callBasicDataGet(year: number): Promise<BasicDataGetResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/basicDataGet`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/basicDataGet`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken, // 사용 안 함, 관행 유지
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { year, _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as BasicDataGetResponse;
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
