import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ChatDeleteRequest {
  name: string;
}

export interface ChatDeleteResponse {
  deleted: true;
  name: string;
}

export async function callChatDelete(data: ChatDeleteRequest): Promise<ChatDeleteResponse> {
  return callCallable<ChatDeleteRequest, ChatDeleteResponse>(
    'chatDelete',
    data,
    { scopes: 'https://www.googleapis.com/auth/chat.spaces' },
  );
}

export function useDeleteChatSpace() {
  const queryClient = useQueryClient();
  return useMutation<ChatDeleteResponse, Error, ChatDeleteRequest>({
    mutationFn: (data) => callChatDelete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'list'] });
    },
  });
}
