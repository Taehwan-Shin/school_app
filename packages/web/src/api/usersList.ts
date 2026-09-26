import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

// v0.312: v0.309 callCallable helper 이식 (batch). 기존 signature 유지 · 내부만 shared helper.

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
  return callCallable<Record<string, never>, UsersListResponse>(
    'usersList',
    {},
    { scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly' },
  );
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
