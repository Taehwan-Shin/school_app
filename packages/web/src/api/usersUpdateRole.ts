import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { Role } from '@school-app/shared';

export interface UsersUpdateRoleRequest {
  primaryEmail: string;
  role: Role;
}

export interface UsersUpdateRoleResponse {
  primaryEmail: string;
  uid: string;
  role: Role;
}

export async function callUsersUpdateRole(
  data: UsersUpdateRoleRequest,
): Promise<UsersUpdateRoleResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  // 이 callable 은 OAuth scope 를 요구하지 않지만 middleware 통과를 위해 최소 헤더는 유지.
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/usersUpdateRole`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/usersUpdateRole`;

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
  return (body.result ?? body) as UsersUpdateRoleResponse;
}

export function useUsersUpdateRole() {
  const qc = useQueryClient();
  return useMutation<UsersUpdateRoleResponse, Error, UsersUpdateRoleRequest>({
    mutationFn: (data) => callUsersUpdateRole(data),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
      // v0.100b F21: 개별 role query cache 도 즉시 갱신·무효화 — dialog 재오픈 시 오래된 role 로
      // no-op 방어가 잘못 걸리는 문제 방지.
      qc.setQueryData(['users', 'role', vars.primaryEmail], res);
      qc.invalidateQueries({ queryKey: ['users', 'role', vars.primaryEmail] });
    },
  });
}
