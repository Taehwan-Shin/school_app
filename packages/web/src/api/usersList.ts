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
    throw new Error(body.error?.message ?? `http_${res.status}`);
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
    retry: options?.retry ?? 1,
  });
}
