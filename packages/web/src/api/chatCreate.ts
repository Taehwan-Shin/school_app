import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatSpaceItem } from './chatList';
import { callCallable } from './callCallable';

export interface ChatCreateRequest {
  displayName: string;
}

export interface ChatCreateResponse {
  space: ChatSpaceItem;
}

export async function callChatCreate(data: ChatCreateRequest): Promise<ChatCreateResponse> {
  return callCallable<ChatCreateRequest, ChatCreateResponse>(
    'chatCreate',
    data,
    { scopes: 'https://www.googleapis.com/auth/chat.spaces' },
  );
}

export function useCreateChatSpace() {
  const queryClient = useQueryClient();
  return useMutation<ChatCreateResponse, Error, ChatCreateRequest>({
    mutationFn: (data) => callChatCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'list'] });
    },
  });
}
