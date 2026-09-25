import { useMutation } from '@tanstack/react-query';
import { callCallable } from './callCallable';
import type { Role } from '@school-app/shared';

// v0.310: v0.309 callCallable helper 이식 (pilot). 기존 signature 유지 · 내부만 shared helper.

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
  return callCallable<UsersRecheckRoleSplitRequest, UsersRecheckRoleSplitResponse>(
    'usersRecheckRoleSplit',
    data,
    { scopes: 'https://www.googleapis.com/auth/userinfo.email' },
  );
}

// v0.109b F56: 자동 재확인 batch 가 mutation 마다 aggregation query 를 invalidate 하면
// N unknown → N Functions 호출 + N refetch 로 증폭. hook 은 automatic invalidation 을
// 하지 않고 caller (수동 button click · auto batch) 가 적절한 타이밍에 명시적으로
// invalidate. useQueryClient import 는 caller 측에서.
export function useUsersRecheckRoleSplit() {
  return useMutation<UsersRecheckRoleSplitResponse, Error, UsersRecheckRoleSplitRequest>({
    mutationFn: (data) => callUsersRecheckRoleSplit(data),
  });
}
