import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface UserItem {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath: string;
  isAdmin: boolean;
  isSuspended: boolean;
}

export interface UsersListResponse {
  users: UserItem[];
}

export async function callUsersList(): Promise<UsersListResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-507112';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/usersList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/usersList`;

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
      'X-Google-Scopes': 'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: {} }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as UsersListResponse;
}

export function useUsersList(enabled = true, options?: { retry?: number | boolean }) {
  return useQuery<UsersListResponse, Error>({
    queryKey: ['users', 'list'],
    queryFn: () => callUsersList(),
    enabled,
    staleTime: 60_000,
    // 4xx 는 재시도하지 않는다 — 서버가 이미 denied/permission-denied 감사 로그를 남긴 상태.
    // 재시도하면 감사 로그가 중복 생성된다.
    // 사용자가 명시적으로 override 하면 그 값을 존중.
    retry:
      options?.retry !== undefined
        ? options.retry
        : (failureCount, error) => {
            const status = (error as Error & { status?: number }).status;
            if (status !== undefined && status >= 400 && status < 500) {
              return false;
            }
            // 5xx / 네트워크 오류: 최대 1회 추가 재시도.
            // (failureCount 는 실패한 횟수. 1 이면 아직 한 번 남았다.)
            return failureCount < 2;
          },
  });
}
