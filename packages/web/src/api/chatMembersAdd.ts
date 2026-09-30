import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMember } from './chatMembersList';
import { callCallable } from './callCallable';

export type { ChatMember };

export interface ChatMembersAddRequest {
  spaceName: string;
  email: string;
}

export interface ChatMembersAddResponse {
  member: ChatMember;
}

export async function callChatMembersAdd(
  data: ChatMembersAddRequest,
): Promise<ChatMembersAddResponse> {
  return callCallable<ChatMembersAddRequest, ChatMembersAddResponse>(
    'chatMembersAdd',
    data,
    { scopes: 'https://www.googleapis.com/auth/chat.memberships https://www.googleapis.com/auth/admin.directory.user.readonly' },
  );
}

export function useChatMembersAdd() {
  const qc = useQueryClient();
  return useMutation<ChatMembersAddResponse, Error, ChatMembersAddRequest>({
    mutationFn: (data) => callChatMembersAdd(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['chat', 'members', variables.spaceName] });
    },
  });
}
