import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface GroupsMembersDeleteRequest {
  groupEmail: string;
  memberEmail: string;
}

export interface GroupsMembersDeleteResponse {
  groupEmail: string;
  memberEmail: string;
  deleted: true;
}

export async function callGroupsMembersDelete(
  data: GroupsMembersDeleteRequest
): Promise<GroupsMembersDeleteResponse> {
  return callCallable<GroupsMembersDeleteRequest, GroupsMembersDeleteResponse>(
    'groupsMembersDelete',
    data,
    { scopes: 'https://www.googleapis.com/auth/admin.directory.group.member' },
  );
}

export function useRemoveMember(groupEmail?: string) {
  const queryClient = useQueryClient();
  return useMutation<GroupsMembersDeleteResponse, Error, GroupsMembersDeleteRequest>({
    mutationFn: (data) => callGroupsMembersDelete(data),
    onSuccess: (_data, variables) => {
      const targetGroup = variables?.groupEmail || groupEmail;
      if (targetGroup) {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', targetGroup] });
        queryClient.invalidateQueries({ queryKey: [`groups/members/${targetGroup}`] });
      }
    },
  });
}
