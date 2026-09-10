import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { Role } from '@school-app/shared';

export interface UsersResolveRoleSplitRequest {
  uid: string;
}

export interface UsersResolveRoleSplitResponse {
  primaryEmail: string;
  uid: string;
  authRole: Role | null;
  previousFirestoreRole: Role | null;
  newFirestoreRole: Role | null;
}

export async function callUsersResolveRoleSplit(
  data: UsersResolveRoleSplitRequest,
): Promise<UsersResolveRoleSplitResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/usersResolveRoleSplit`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/usersResolveRoleSplit`;

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
      'X-Google-Scopes': 'https://www.googleapis.com/auth/userinfo.email',
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
  return (body.result ?? body) as UsersResolveRoleSplitResponse;
}

export function useUsersResolveRoleSplit() {
  const qc = useQueryClient();
  return useMutation<UsersResolveRoleSplitResponse, Error, UsersResolveRoleSplitRequest>({
    mutationFn: (data) => callUsersResolveRoleSplit(data),
    onSuccess: (res) => {
      // role_split 해결 후 users list · 개별 role · 감사 log 캐시 무효화.
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      qc.setQueryData(['users', 'role', res.primaryEmail], {
        primaryEmail: res.primaryEmail,
        uid: res.uid,
        role: res.authRole,
      });
      qc.invalidateQueries({ queryKey: ['users', 'role', res.primaryEmail] });
      // 감사 log 카드가 새 role_split_resolved 이벤트를 즉시 반영하도록.
      qc.invalidateQueries({ queryKey: ['auditLog'] });
    },
  });
}
