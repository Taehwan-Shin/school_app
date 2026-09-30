import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ChatSpaceItem {
  name: string; // "spaces/AAAA"
  displayName?: string;
  spaceType?: string; // 'SPACE' · 'GROUP_CHAT' · 'DIRECT_MESSAGE'
  spaceHistoryState?: string;
  externalUserAllowed?: boolean;
  createTime?: string;
}

export interface ChatListResponse {
  spaces: ChatSpaceItem[];
}

export async function callChatList(): Promise<ChatListResponse> {
  return callCallable<Record<string, never>, ChatListResponse>(
    'chatList',
    {},
    { scopes: 'https://www.googleapis.com/auth/chat.spaces' },
  );
}

export function useChatList(enabled = true) {
  return useQuery<ChatListResponse, Error>({
    queryKey: ['chat', 'list'],
    queryFn: () => callChatList(),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
