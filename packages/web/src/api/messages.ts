import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

// v0.322: 메시지 발송 (Gmail · 챗 DM · 챗 스페이스) + 문구 템플릿 callable 클라이언트.
// 발송은 수신자별 1건씩 — 화면이 순차 호출하며 진행률/결과를 표시한다.

const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';
const CHAT_SPACES = 'https://www.googleapis.com/auth/chat.spaces';
const CHAT_MESSAGES_CREATE = 'https://www.googleapis.com/auth/chat.messages.create';

export interface GmailSendRequest {
  to: string;
  subject: string;
  body: string;
}

export function callGmailSend(data: GmailSendRequest): Promise<{ id: string | null }> {
  return callCallable<GmailSendRequest, { id: string | null }>('gmailSend', data, {
    scopes: GMAIL_SEND,
  });
}

export interface ChatDmSendRequest {
  email: string;
  text: string;
}

export interface ChatDmSendResponse {
  spaceName: string;
  messageName: string | null;
  createdDm: boolean;
}

export function callChatDmSend(data: ChatDmSendRequest): Promise<ChatDmSendResponse> {
  return callCallable<ChatDmSendRequest, ChatDmSendResponse>('chatDmSend', data, {
    scopes: `${CHAT_SPACES} ${CHAT_MESSAGES_CREATE}`,
  });
}

export interface ChatSpaceSendRequest {
  spaceName: string;
  text: string;
}

export function callChatSpaceSend(data: ChatSpaceSendRequest): Promise<{ messageName: string | null }> {
  return callCallable<ChatSpaceSendRequest, { messageName: string | null }>('chatSpaceSend', data, {
    scopes: CHAT_MESSAGES_CREATE,
  });
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedBy?: string;
  updatedAt?: string | null;
}

export function callMessageTemplatesList(): Promise<{ templates: MessageTemplate[] }> {
  return callCallable<Record<string, never>, { templates: MessageTemplate[] }>(
    'messageTemplatesList',
    {},
  );
}

const TEMPLATES_KEY = ['messages', 'templates'] as const;

export function useMessageTemplates(enabled = true) {
  return useQuery<{ templates: MessageTemplate[] }, Error>({
    queryKey: TEMPLATES_KEY,
    queryFn: callMessageTemplatesList,
    enabled,
    staleTime: 60_000,
  });
}

export type MessageTemplateInput = Pick<MessageTemplate, 'id' | 'name' | 'subject' | 'body'>;

export function useUpsertMessageTemplate() {
  const qc = useQueryClient();
  return useMutation<{ template: MessageTemplate }, Error, MessageTemplateInput>({
    mutationFn: (data) =>
      callCallable<MessageTemplateInput, { template: MessageTemplate }>('messageTemplatesUpsert', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation<{ deleted: true; id: string }, Error, { id: string }>({
    mutationFn: (data) =>
      callCallable<{ id: string }, { deleted: true; id: string }>('messageTemplatesDelete', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}
