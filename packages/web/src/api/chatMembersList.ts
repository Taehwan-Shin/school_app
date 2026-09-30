import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ChatMember {
  name: string; // "spaces/AAAA/members/BBBBB"
  member?: {
    name: string; // "users/USER_ID" · 또는 "groups/GROUP_ID"
    type?: string; // 'HUMAN' · 'BOT'
    displayName?: string;
  };
  role?: string; // 'ROLE_MEMBER' · 'ROLE_MANAGER'
  state?: string; // 'JOINED' · 'INVITED'
  createTime?: string;
}

export interface ChatMembersListRequest {
  spaceName: string;
}

export interface ChatMembersListResponse {
  members: ChatMember[];
}

export async function callChatMembersList(
  data: ChatMembersListRequest,
): Promise<ChatMembersListResponse> {
  return callCallable<ChatMembersListRequest, ChatMembersListResponse>(
    'chatMembersList',
    data,
    { scopes: 'https://www.googleapis.com/auth/chat.memberships' },
  );
}

export function useChatMembersList(spaceName: string | null, enabled = true) {
  return useQuery<ChatMembersListResponse, Error>({
    queryKey: ['chat', 'members', spaceName],
    queryFn: () => callChatMembersList({ spaceName: spaceName! }),
    enabled: enabled && !!spaceName,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
