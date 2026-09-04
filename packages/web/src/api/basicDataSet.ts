import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { BasicDataGradeClass } from '@school-app/shared';

export interface BasicDataSetRequest {
  year: number;
  grades: BasicDataGradeClass[];
  departments?: string[];
}

export interface BasicDataSetResponse {
  year: number;
  updatedAt: number;
}

export async function callBasicDataSet(data: BasicDataSetRequest): Promise<BasicDataSetResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/basicDataSet`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/basicDataSet`;

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
  return (body.result ?? body) as BasicDataSetResponse;
}

export function useBasicDataSet() {
  const queryClient = useQueryClient();
  return useMutation<BasicDataSetResponse, Error, BasicDataSetRequest>({
    mutationFn: (data) => callBasicDataSet(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['basic_data', 'get', variables.year] });
    },
  });
}
