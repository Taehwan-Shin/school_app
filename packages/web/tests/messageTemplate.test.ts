import { describe, it, expect } from 'vitest';
import { renderTemplate, parseEmailList, buildSpaceMessage, isScopeError } from '../src/lib/messageTemplate';
import { parseIndividualPaste } from '../src/routes/admin/messages';

describe('messageTemplate (v0.322)', () => {
  it('renderTemplate: {{name}} · {{email}} 치환 (공백 허용 · 여러 번)', () => {
    expect(renderTemplate('{{ name }} / {{email}} / {{name}}', { name: '홍길동', email: 'a@cam.hs.kr' })).toBe(
      '홍길동 / a@cam.hs.kr / 홍길동',
    );
  });

  it('renderTemplate: 이름 없으면 이메일 앞부분', () => {
    expect(renderTemplate('{{name}}', { name: ' ', email: 's1@cam.hs.kr' })).toBe('s1');
  });

  it('parseEmailList: 줄바꿈/쉼표/세미콜론 · 소문자 · 중복 제거 · 형식 오류 분리', () => {
    expect(parseEmailList('A@cam.hs.kr, b@cam.hs.kr\n a@CAM.hs.kr; bad-entry\n\n')).toEqual({
      valid: ['a@cam.hs.kr', 'b@cam.hs.kr'],
      invalid: ['bad-entry'],
    });
  });

  it('buildSpaceMessage: 원본 buildFinalMessage 형식', () => {
    expect(buildSpaceMessage(' 공지 ', '3학년부', 'https://x')).toBe('공지\n\n- 3학년부\n첨부파일: https://x');
    expect(buildSpaceMessage('공지', '', '')).toBe('공지');
  });

  it('isScopeError', () => {
    expect(isScopeError('insufficient_scope:https://www.googleapis.com/auth/gmail.send')).toBe(true);
    expect(isScopeError('google_upstream_denied')).toBe(false);
    expect(isScopeError(undefined)).toBe(false);
  });

  it('parseIndividualPaste: 시트 두 열 (TAB) → 행 · 빈 줄 제외', () => {
    expect(parseIndividualPaste('a@cam.hs.kr\t안녕\tㅎㅎ\n\nb@cam.hs.kr\t내일 봐요')).toEqual([
      { email: 'a@cam.hs.kr', message: '안녕\tㅎㅎ' },
      { email: 'b@cam.hs.kr', message: '내일 봐요' },
    ]);
  });
});
