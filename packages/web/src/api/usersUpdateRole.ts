import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';
import type { Role } from '@school-app/shared';

// v0.311: callCallable helper 이식. signature 유지.

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
  // 이 callable 은 OAuth scope 를 요구하지 않지만 middleware 통과를 위해 최소 헤더는 유지.
  return callCallable<UsersUpdateRoleRequest, UsersUpdateRoleResponse>(
    'usersUpdateRole',
    data,
    { scopes: 'https://www.googleapis.com/auth/userinfo.email' },
  );
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
