import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface GroupsMembersInsertRequest {
  groupEmail: string;
  memberEmail: string;
  role?: 'OWNER' | 'MANAGER' | 'MEMBER';
}

export interface GroupsMembersInsertResponse {
  groupEmail: string;
  memberEmail: string;
  role: string;
}

export async function callGroupsMembersInsert(
  data: GroupsMembersInsertRequest
): Promise<GroupsMembersInsertResponse> {
  return callCallable<GroupsMembersInsertRequest, GroupsMembersInsertResponse>(
    'groupsMembersInsert',
    data,
    { scopes: 'https://www.googleapis.com/auth/admin.directory.group.member' },
  );
}

export function useAddMember(groupEmail?: string) {
  const queryClient = useQueryClient();
  return useMutation<GroupsMembersInsertResponse, Error, GroupsMembersInsertRequest>({
    mutationFn: (data) => callGroupsMembersInsert(data),
    onSuccess: (_data, variables) => {
      const targetGroup = variables?.groupEmail || groupEmail;
      if (targetGroup) {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', targetGroup] });
        queryClient.invalidateQueries({ queryKey: [`groups/members/${targetGroup}`] });
      }
    },
  });
}
