import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { Role } from '@school-app/shared';

export interface UsersRecheckRoleSplitRequest {
  uid: string;
}

export interface UsersRecheckRoleSplitResponse {
  primaryEmail: string;
  uid: string;
  authRole: Role | null;
  firestoreRole: Role | null;
  isSplit: boolean;
}

export async function callUsersRecheckRoleSplit(
  data: UsersRecheckRoleSplitRequest,
): Promise<UsersRecheckRoleSplitResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/usersRecheckRoleSplit`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/usersRecheckRoleSplit`;

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
  return (body.result ?? body) as UsersRecheckRoleSplitResponse;
}

export function useUsersRecheckRoleSplit() {
  const qc = useQueryClient();
  return useMutation<UsersRecheckRoleSplitResponse, Error, UsersRecheckRoleSplitRequest>({
    mutationFn: (data) => callUsersRecheckRoleSplit(data),
    onSettled: () => {
      // 성공/실패 모두 unresolved query 무효화 — 새 detected/resolved 이벤트 반영.
      qc.invalidateQueries({ queryKey: ['audit', 'unresolvedRoleSplits'] });
    },
  });
}
