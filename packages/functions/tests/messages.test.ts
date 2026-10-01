import { describe, it, expect, vi, beforeEach } from 'vitest';

// v0.322: messages/* callable (gmailSend · chatDmSend · chatSpaceSend · templates) + buildRawEmail.

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockGmailSend = vi.fn();
vi.mock('../src/google/gmailClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/google/gmailClient.js')>();
  return {
    ...actual,
    getGmailClient: () => ({ users: { messages: { send: mockGmailSend } } }),
  };
});

const mockFindDm = vi.fn();
const mockSetup = vi.fn();
const mockMsgCreate = vi.fn();
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: () => ({
    spaces: { findDirectMessage: mockFindDm, setup: mockSetup, messages: { create: mockMsgCreate } },
  }),
}));

const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();
const mockDoc = vi.fn(() => ({ set: mockSet, delete: mockDelete }));
vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return { ...actual, getFirestore: () => ({ collection: () => ({ doc: mockDoc, get: mockGet }) }) };
});

import { buildRawEmail } from '../src/google/gmailClient.js';
import { gmailSend } from '../src/callable/messages/gmailSend.js';
import { chatDmSend } from '../src/callable/messages/chatDmSend.js';
import { chatSpaceSend } from '../src/callable/messages/chatSpaceSend.js';
import {
  messageTemplatesList,
  messageTemplatesUpsert,
  messageTemplatesDelete,
} from '../src/callable/messages/templates.js';

const GMAIL = 'https://www.googleapis.com/auth/gmail.send';
const CHAT_SPACES = 'https://www.googleapis.com/auth/chat.spaces';
const CHAT_MSG = 'https://www.googleapis.com/auth/chat.messages.create';

function req(data: unknown, opts: { role?: string; scopes?: string; auth?: boolean } = {}) {
  return {
    data,
    auth: opts.auth === false ? null : { uid: 'u1', token: { email: 'admin@cam.hs.kr', role: opts.role ?? 'admin' } },
    rawRequest: {
      headers: {
        'x-google-access-token': 'tok',
        'x-request-id': 'req-1',
        'x-google-scopes': opts.scopes ?? `${GMAIL} ${CHAT_SPACES} ${CHAT_MSG}`,
      },
    },
  } as any;
}

function lastAudit() {
  return mockWriteAudit.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAudit.mockResolvedValue(undefined);
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
});

describe('buildRawEmail', () => {
  it('한글 제목 RFC2047 · 본문 base64 UTF-8 · base64url 인코딩', () => {
    const raw = buildRawEmail({ to: 'a@cam.hs.kr', subject: '안내', body: '안녕하세요\n두번째 줄' });
    const mime = Buffer.from(raw, 'base64url').toString('utf8');
    expect(raw).not.toMatch(/[+/=]/);
    expect(mime).toContain('To: a@cam.hs.kr\r\n');
    expect(mime).toContain(`Subject: =?UTF-8?B?${Buffer.from('안내').toString('base64')}?=`);
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    const body = mime.split('\r\n\r\n')[1].replace(/\r\n/g, '');
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('안녕하세요\r\n두번째 줄');
  });

  it('ASCII 제목은 그대로', () => {
    const mime = Buffer.from(buildRawEmail({ to: 'a@b.co', subject: 'Hello', body: 'x' }), 'base64url').toString();
    expect(mime).toContain('Subject: Hello\r\n');
  });
});

describe('gmailSend', () => {
  it('정상 → users.messages.send(me) · 감사 ok (본문 미기록)', async () => {
    mockGmailSend.mockResolvedValueOnce({ data: { id: 'm1' } });
    const res = await gmailSend.run(req({ to: 's1@cam.hs.kr', subject: '안내', body: '비밀 내용' }));
    expect(res).toEqual({ id: 'm1' });
    expect(mockGmailSend.mock.calls[0][0].userId).toBe('me');
    expect(lastAudit()).toMatchObject({ action: 'messages.send', target: 'gmail:s1@cam.hs.kr', result: 'ok' });
    expect(JSON.stringify(lastAudit())).not.toContain('비밀 내용');
  });

  it('teacher → messages.send cap 없음 → permission-denied', async () => {
    await expect(gmailSend.run(req({ to: 's@cam.hs.kr', subject: 'a', body: 'b' }, { role: 'teacher' }))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(mockGmailSend).not.toHaveBeenCalled();
  });

  it('gmail.send scope 없음 → insufficient_scope', async () => {
    await expect(gmailSend.run(req({ to: 's@cam.hs.kr', subject: 'a', body: 'b' }, { scopes: CHAT_MSG }))).rejects.toMatchObject({
      message: expect.stringContaining('insufficient_scope'),
    });
  });

  it('제목 개행 (헤더 injection) · 잘못된 이메일 · 빈 본문 → invalid-argument', async () => {
    for (const d of [
      { to: 's@cam.hs.kr', subject: 'a\r\nBcc: x@y.z', body: 'b' },
      { to: 'not-an-email', subject: 'a', body: 'b' },
      { to: 's@cam.hs.kr', subject: 'a', body: '   ' },
    ]) {
      await expect(gmailSend.run(req(d))).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    expect(mockGmailSend).not.toHaveBeenCalled();
  });

  it('upstream 403 (Gmail API 비활성 등) → permission-denied + denied 감사', async () => {
    mockGmailSend.mockRejectedValueOnce(Object.assign(new Error('Gmail API has not been used'), { code: 403 }));
    await expect(gmailSend.run(req({ to: 's@cam.hs.kr', subject: 'a', body: 'b' }))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(lastAudit()).toMatchObject({ result: 'denied' });
  });
});

describe('chatDmSend', () => {
  it('기존 DM 있음 → findDirectMessage → messages.create (setup 미호출)', async () => {
    mockFindDm.mockResolvedValueOnce({ data: { name: 'spaces/DM1' } });
    mockMsgCreate.mockResolvedValueOnce({ data: { name: 'spaces/DM1/messages/x' } });
    const res = await chatDmSend.run(req({ email: 's1@cam.hs.kr', text: '안녕' }));
    expect(mockFindDm).toHaveBeenCalledWith({ name: 'users/s1@cam.hs.kr' });
    expect(mockSetup).not.toHaveBeenCalled();
    expect(mockMsgCreate).toHaveBeenCalledWith({ parent: 'spaces/DM1', requestBody: { text: '안녕' } });
    expect(res).toEqual({ spaceName: 'spaces/DM1', messageName: 'spaces/DM1/messages/x', createdDm: false });
  });

  it('DM 없음 (404) → spaces.setup(DIRECT_MESSAGE) 후 발송 · createdDm=true', async () => {
    mockFindDm.mockRejectedValueOnce(Object.assign(new Error('nf'), { code: 404 }));
    mockSetup.mockResolvedValueOnce({ data: { name: 'spaces/NEW' } });
    mockMsgCreate.mockResolvedValueOnce({ data: {} });
    const res = await chatDmSend.run(req({ email: 's2@cam.hs.kr', text: 'hi' }));
    expect(mockSetup.mock.calls[0][0].requestBody).toEqual({
      space: { spaceType: 'DIRECT_MESSAGE' },
      memberships: [{ member: { name: 'users/s2@cam.hs.kr', type: 'HUMAN' } }],
    });
    expect(res.createdDm).toBe(true);
  });

  it('setup 404 → not-found chat_user_not_found', async () => {
    mockFindDm.mockRejectedValueOnce(Object.assign(new Error('nf'), { code: 404 }));
    mockSetup.mockRejectedValueOnce(Object.assign(new Error('nf'), { code: 404 }));
    await expect(chatDmSend.run(req({ email: 's3@cam.hs.kr', text: 'hi' }))).rejects.toMatchObject({
      code: 'not-found',
      message: 'chat_user_not_found',
    });
    expect(mockMsgCreate).not.toHaveBeenCalled();
  });

  it('findDirectMessage 403 → 그대로 permission-denied (setup 시도 안 함)', async () => {
    mockFindDm.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 403 }));
    await expect(chatDmSend.run(req({ email: 's@cam.hs.kr', text: 'hi' }))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockSetup).not.toHaveBeenCalled();
  });

  it('chat.messages.create scope 없음 → insufficient_scope', async () => {
    await expect(chatDmSend.run(req({ email: 's@cam.hs.kr', text: 'hi' }, { scopes: CHAT_SPACES }))).rejects.toMatchObject({
      message: expect.stringContaining('chat.messages.create'),
    });
  });
});

describe('chatSpaceSend', () => {
  it('정상 → messages.create(parent=space)', async () => {
    mockMsgCreate.mockResolvedValueOnce({ data: { name: 'spaces/AAA/messages/1' } });
    const res = await chatSpaceSend.run(req({ spaceName: 'spaces/AAA', text: '공지' }));
    expect(mockMsgCreate).toHaveBeenCalledWith({ parent: 'spaces/AAA', requestBody: { text: '공지' } });
    expect(res).toEqual({ messageName: 'spaces/AAA/messages/1' });
    expect(lastAudit()).toMatchObject({ target: 'chat_space:spaces/AAA', result: 'ok' });
  });

  it('잘못된 space 이름 · 4000자 초과 → invalid-argument', async () => {
    await expect(chatSpaceSend.run(req({ spaceName: 'spaces/../x', text: 'a' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chatSpaceSend.run(req({ spaceName: 'spaces/A', text: 'a'.repeat(4001) }))).rejects.toMatchObject({
      message: 'text_too_long',
    });
  });
});

describe('message templates', () => {
  it('list → 이름순 정렬 · updatedAt ISO', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        { id: 'b', data: () => ({ name: '나', subject: '', body: 'x', updatedAt: { toDate: () => new Date('2026-10-01T00:00:00Z') } }) },
        { id: 'a', data: () => ({ name: '가', subject: 's', body: 'y' }) },
      ],
    });
    const res = await messageTemplatesList.run(req({}));
    expect(res.templates.map((t) => t.id)).toEqual(['a', 'b']);
    expect(res.templates[1].updatedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('upsert → set(name/subject/body/updatedBy) · 감사 templates.write', async () => {
    mockSet.mockResolvedValueOnce(undefined);
    const res = await messageTemplatesUpsert.run(
      req({ id: 'account_deletion_notice', name: '계정 삭제 안내', subject: '계정 삭제 안내', body: '{{name}} 학생' }),
    );
    expect(mockDoc).toHaveBeenCalledWith('account_deletion_notice');
    expect(mockSet.mock.calls[0][0]).toMatchObject({ name: '계정 삭제 안내', body: '{{name}} 학생', updatedBy: 'admin@cam.hs.kr' });
    expect(res.template.id).toBe('account_deletion_notice');
    expect(lastAudit()).toMatchObject({ action: 'messages.templates.write', result: 'ok' });
  });

  it('upsert: 잘못된 id · 제목 개행 → invalid-argument', async () => {
    await expect(messageTemplatesUpsert.run(req({ id: '../x', name: 'n', body: 'b' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(messageTemplatesUpsert.run(req({ id: 'ok', name: 'n', subject: 'a\nb', body: 'b' }))).rejects.toMatchObject({
      message: 'invalid_subject',
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('delete → doc(id).delete · teacher 거부', async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    await expect(messageTemplatesDelete.run(req({ id: 'old' }))).resolves.toEqual({ deleted: true, id: 'old' });
    await expect(messageTemplatesDelete.run(req({ id: 'old' }, { role: 'teacher' }))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('미인증 → unauthenticated + denied 감사', async () => {
    await expect(messageTemplatesList.run(req({}, { auth: false }))).rejects.toBeDefined();
    expect(lastAudit()).toMatchObject({ actor: 'unknown', result: 'denied' });
  });
});
