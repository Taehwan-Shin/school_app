import { google } from 'googleapis';

// v0.322: Gmail API (users.messages.send) — 로그인 사용자 OAuth 토큰으로 「본인 계정에서」 발송.
// 서비스 계정 · 도메인 위임 없음 (AGENTS.md §1 인증 모델 ⓑ).

export interface GmailClient {
  users: {
    messages: {
      send: (params: {
        userId: 'me';
        requestBody: { raw: string };
      }) => Promise<{ data: { id?: string; threadId?: string } }>;
    };
  };
}

export function getGmailClient(accessToken: string): GmailClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth }) as unknown as GmailClient;
}

/**
 * RFC 2047 encoded-word (UTF-8 base64) — 한글 제목.
 * v0.324 (Codex v0.322 R1 F-B): encoded-word 하나는 75자 이하여야 한다 (RFC 2047 §2).
 * `=?UTF-8?B?` + `?=` = 12자 → base64 63자 이하 → 원문 45 byte 이하씩 글자 경계로 잘라
 * 여러 encoded-word 를 CRLF + 공백으로 접는다 (인접 encoded-word 사이 공백은 디코딩 시 무시됨).
 */
export const ENCODED_WORD_MAX_BYTES = 45;

export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const ch of value) {
    if (Buffer.byteLength(chunk + ch, 'utf8') > ENCODED_WORD_MAX_BYTES) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words
    .map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`)
    .join('\r\n ');
}

/**
 * text/plain UTF-8 메일 → Gmail `raw` (base64url). 본문은 base64 transfer-encoding
 * (76자 줄바꿈) 으로 한글 · 긴 줄 안전. 헤더 injection 방지는 호출자가 to/subject 의
 * CR/LF 를 거부해야 한다 (validate 단계).
 */
export function buildRawEmail(input: { to: string; subject: string; body: string }): string {
  const bodyB64 = Buffer.from(input.body.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{1,76}/g, '$&\r\n')
    .trimEnd();
  const mime = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}
