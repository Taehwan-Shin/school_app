import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getChatClient } from '../../google/chatClient.js';
import { runAudited, requireEmail, requireText } from './common.js';

// v0.322: 구글챗 DM 1건 발송. 원본 메신저 스크립트 _sendChat():
//   findDirectMessage(users/<email>) → 없으면 spaces.setup(DIRECT_MESSAGE) → messages.create.

export interface ChatDmSendRequest {
  email: string;
  text: string;
}

export interface ChatDmSendResponse {
  spaceName: string;
  messageName: string | null;
  createdDm: boolean;
}

export const CHAT_TEXT_MAX = 4000;

const SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.messages.create',
] as const;

function upstreamStatus(err: unknown): number | undefined {
  return (err as any)?.response?.status ?? (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
}

export const chatDmSend = onCall({ region: 'asia-northeast3', cors: true }, async (request) => {
  const data = (request.data ?? {}) as Partial<ChatDmSendRequest>;
  const emailPart = typeof data.email === 'string' && data.email.trim() ? data.email.trim() : '*';
  return runAudited<ChatDmSendResponse>(
    request,
    { action: 'messages.send', target: `chat_dm:${emailPart}`, cap: 'messages.send', scopes: SCOPES },
    async (user) => {
      const email = requireEmail(data.email);
      const text = requireText(data.text, 'text', CHAT_TEXT_MAX);
      const chat = getChatClient(user.googleAccessToken);

      let spaceName: string | undefined;
      let createdDm = false;
      try {
        const found = await chat.spaces.findDirectMessage({ name: `users/${email}` });
        spaceName = found.data?.name;
      } catch (err) {
        if (upstreamStatus(err) !== 404) throw err;
      }
      if (!spaceName) {
        try {
          const setup = await chat.spaces.setup({
            requestBody: {
              space: { spaceType: 'DIRECT_MESSAGE' },
              memberships: [{ member: { name: `users/${email}`, type: 'HUMAN' } }],
            },
          });
          spaceName = setup.data?.name;
          createdDm = true;
        } catch (err) {
          const st = upstreamStatus(err);
          if (st === 404) throw new HttpsError('not-found', 'chat_user_not_found');
          throw err;
        }
      }
      if (!spaceName) throw new HttpsError('unknown', 'chat_dm_space_missing');

      const msg = await chat.spaces.messages.create({ parent: spaceName, requestBody: { text } });
      return {
        result: { spaceName, messageName: msg.data?.name ?? null, createdDm },
        message: `text_len=${text.length}${createdDm ? ' dm_created' : ''}`,
      };
    },
  );
});
