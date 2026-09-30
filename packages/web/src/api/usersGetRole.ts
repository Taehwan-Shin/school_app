import { useQuery } from '@tanstack/react-query';
import type { Role } from '@school-app/shared';
import { callCallable } from './callCallable';

export interface UsersGetRoleResponse {
  primaryEmail: string;
  uid: string;
  role: Role | null;
}

export async function callUsersGetRole(primaryEmail: string): Promise<UsersGetRoleResponse> {
  return callCallable<{ primaryEmail: string }, UsersGetRoleResponse>(
    'usersGetRole',
    { primaryEmail },
    { scopes: 'https://www.googleapis.com/auth/userinfo.email' },
  );
}

export function useUserRole(email: string | null, enabled = true) {
  return useQuery<UsersGetRoleResponse, Error>({
    queryKey: ['users', 'role', email],
    queryFn: () => callUsersGetRole(email as string),
    enabled: enabled && !!email,
    staleTime: 30_000,
  });
}
