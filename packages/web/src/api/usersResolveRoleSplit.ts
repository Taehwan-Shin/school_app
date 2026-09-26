import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';
import type { Role } from '@school-app/shared';

// v0.311: callCallable helper 이식. signature 유지.

export interface UsersResolveRoleSplitRequest {
  uid: string;
  // v0.107b F42: CAS — detected 이벤트에서 파싱한 기대치. 서버가 실제와 대조.
  expectedAuthRole: Role | 'null';
  expectedFirestoreRole: Role | 'null';
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
  return callCallable<UsersResolveRoleSplitRequest, UsersResolveRoleSplitResponse>(
    'usersResolveRoleSplit',
    data,
    { scopes: 'https://www.googleapis.com/auth/userinfo.email' },
  );
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
