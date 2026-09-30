import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface GroupsMembersUpdateRequest {
  groupEmail: string;
  memberEmail: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
}

export interface GroupsMembersUpdateResponse {
  groupEmail: string;
  memberEmail: string;
  role: string;
}

export async function callGroupsMembersUpdate(
  data: GroupsMembersUpdateRequest
): Promise<GroupsMembersUpdateResponse> {
  return callCallable<GroupsMembersUpdateRequest, GroupsMembersUpdateResponse>(
    'groupsMembersUpdate',
    data,
    { scopes: 'https://www.googleapis.com/auth/admin.directory.group.member' },
  );
}

export function useUpdateMemberRole(groupEmail?: string) {
  const queryClient = useQueryClient();
  return useMutation<GroupsMembersUpdateResponse, Error, GroupsMembersUpdateRequest>({
    mutationFn: (data) => callGroupsMembersUpdate(data),
    onSuccess: (_data, variables) => {
      const targetGroup = variables?.groupEmail || groupEmail;
      if (targetGroup) {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', targetGroup] });
        queryClient.invalidateQueries({ queryKey: [`groups/members/${targetGroup}`] });
      }
    },
  });
}
