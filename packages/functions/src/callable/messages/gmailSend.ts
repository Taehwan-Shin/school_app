import { onCall } from 'firebase-functions/v2/https';
import { getGmailClient, buildRawEmail } from '../../google/gmailClient.js';
import { runAudited, requireEmail, requireText } from './common.js';

// v0.322: Gmail 1통 발송 (로그인 사용자 본인 계정 · text/plain). 클라이언트가 수신자별로 순차 호출.
// 원본: 메신저 스크립트 sendMessages() 의 GmailApp.sendEmail(email, "선생님 알림", message).

export interface GmailSendRequest {
  to: string;
  subject: string;
  body: string;
}

export interface GmailSendResponse {
  id: string | null;
}

export const SUBJECT_MAX = 200;
export const MAIL_BODY_MAX = 20000;

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;

export const gmailSend = onCall({ region: 'asia-northeast3', cors: true }, async (request) => {
  const data = (request.data ?? {}) as Partial<GmailSendRequest>;
  const toPart = typeof data.to === 'string' && data.to.trim() ? data.to.trim() : '*';
  return runAudited<GmailSendResponse>(
    request,
    { action: 'messages.send', target: `gmail:${toPart}`, cap: 'messages.send', scopes: SCOPES },
    async (user) => {
      const to = requireEmail(data.to);
      const subject = requireText(data.subject, 'subject', SUBJECT_MAX, { singleLine: true });
      const body = requireText(data.body, 'body', MAIL_BODY_MAX);
      const gmail = getGmailClient(user.googleAccessToken);
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: buildRawEmail({ to, subject, body }) },
      });
      // 본문은 감사에 남기지 않는다 (개인정보). 길이만.
      return { result: { id: res.data?.id ?? null }, message: `subject_len=${subject.length} body_len=${body.length}` };
    },
  );
});
