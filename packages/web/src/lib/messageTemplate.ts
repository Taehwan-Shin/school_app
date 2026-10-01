// v0.322: 메시지 문구 helper — 템플릿 변수 치환 · 이메일 목록 파싱 · 기본 문구.

export const ACCOUNT_DELETION_TEMPLATE_ID = 'account_deletion_notice';

export const DEFAULT_ACCOUNT_DELETION_TEMPLATE = {
  id: ACCOUNT_DELETION_TEMPLATE_ID,
  name: '계정 삭제 안내',
  subject: '[학교] 구글 계정 삭제 안내',
  body: [
    '{{name}} 학생에게,',
    '',
    '학교 구글 계정({{email}})이 곧 삭제될 예정입니다.',
    '필요한 파일(드라이브 · 지메일 · 클래스룸 자료)은 삭제 전에 개인 계정으로 옮겨 주세요.',
    '',
    '문의 사항은 담당 선생님께 연락 바랍니다.',
  ].join('\n'),
};

export const TEMPLATE_VARIABLES = ['{{name}}', '{{email}}'] as const;

export interface TemplateVars {
  name?: string;
  email?: string;
}

/** `{{name}}` · `{{email}}` 치환. 값이 없으면 name → email 앞부분 · email → 빈 문자열. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  const email = vars.email ?? '';
  const name = vars.name?.trim() || email.split('@')[0] || '';
  return text.replace(/\{\{\s*name\s*\}\}/g, name).replace(/\{\{\s*email\s*\}\}/g, email);
}

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

/** 줄바꿈 · 쉼표 · 세미콜론 · 공백 구분 이메일 목록 → { valid (소문자 · 중복 제거 · 입력 순서), invalid }. */
export function parseEmailList(input: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const v = raw.trim();
    if (!v) continue;
    if (!EMAIL_RE.test(v)) {
      invalid.push(v);
      continue;
    }
    const lower = v.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    valid.push(lower);
  }
  return { valid, invalid };
}

/** 원본 스페이스발송 buildFinalMessage: 본문 + 「- 보내는 사람」 + 첨부 링크. */
export function buildSpaceMessage(body: string, senderName: string, attachmentLink: string): string {
  let msg = body.trim();
  if (senderName.trim()) msg += `\n\n- ${senderName.trim()}`;
  if (attachmentLink.trim()) msg += `\n첨부파일: ${attachmentLink.trim()}`;
  return msg;
}

/** 서버 insufficient_scope 오류 → 재로그인 안내 대상. */
export function isScopeError(message: string | undefined): boolean {
  return !!message && message.includes('insufficient_scope');
}

export const SUBJECT_MAX = 200;
export const MAIL_BODY_MAX = 20000;
export const CHAT_TEXT_MAX = 4000;
