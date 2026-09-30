import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ChatMembersDeleteRequest {
  memberName: string;
}

export interface ChatMembersDeleteResponse {
  ok: true;
}

export async function callChatMembersDelete(
  data: ChatMembersDeleteRequest,
): Promise<ChatMembersDeleteResponse> {
  return callCallable<ChatMembersDeleteRequest, ChatMembersDeleteResponse>(
    'chatMembersDelete',
    data,
    { scopes: 'https://www.googleapis.com/auth/chat.memberships' },
  );
}

export function useChatMembersDelete() {
  const qc = useQueryClient();
  return useMutation<ChatMembersDeleteResponse, Error, ChatMembersDeleteRequest>({
    mutationFn: (data) => callChatMembersDelete(data),
    onSuccess: (_, variables) => {
      const spaceName = variables.memberName.split('/members/')[0];
      qc.invalidateQueries({ queryKey: ['chat', 'members', spaceName] });
    },
  });
}
