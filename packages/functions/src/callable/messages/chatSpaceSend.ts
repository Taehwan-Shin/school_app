import { onCall } from 'firebase-functions/v2/https';
import { getChatClient } from '../../google/chatClient.js';
import { runAudited, requireText, SPACE_NAME_RE } from './common.js';
import { HttpsError } from 'firebase-functions/v2/https';
import { CHAT_TEXT_MAX } from './chatDmSend.js';

// v0.322: 챗 스페이스에 메시지 1건. 원본 「스페이스발송」 은 webhook URL 로 보냈지만,
// 여기서는 로그인 사용자 OAuth 로 Chat API messages.create (사용자 이름으로 게시 · webhook URL 관리 불필요).

export interface ChatSpaceSendRequest {
  spaceName: string;
  text: string;
}

export interface ChatSpaceSendResponse {
  messageName: string | null;
}

const SCOPES = ['https://www.googleapis.com/auth/chat.messages.create'] as const;

export const chatSpaceSend = onCall({ region: 'asia-northeast3', cors: true }, async (request) => {
  const data = (request.data ?? {}) as Partial<ChatSpaceSendRequest>;
  const spacePart =
    typeof data.spaceName === 'string' && data.spaceName.trim() ? data.spaceName.trim() : '*';
  return runAudited<ChatSpaceSendResponse>(
    request,
    { action: 'messages.send', target: `chat_space:${spacePart}`, cap: 'messages.send', scopes: SCOPES },
    async (user) => {
      const spaceName = typeof data.spaceName === 'string' ? data.spaceName.trim() : '';
      if (!SPACE_NAME_RE.test(spaceName)) throw new HttpsError('invalid-argument', 'invalid_space_name');
      const text = requireText(data.text, 'text', CHAT_TEXT_MAX);
      const chat = getChatClient(user.googleAccessToken);
      const msg = await chat.spaces.messages.create({ parent: spaceName, requestBody: { text } });
      return { result: { messageName: msg.data?.name ?? null }, message: `text_len=${text.length}` };
    },
  );
});
