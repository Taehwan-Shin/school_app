import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockChatMembersDelete = vi.fn();
const mockGetChatClient = vi.fn(() => ({
  spaces: {
    members: {
      delete: mockChatMembersDelete,
    },
  },
}));
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: (...args: any[]) => mockGetChatClient(...args),
}));

vi.mock('@school-app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@school-app/shared')>();
  return {
    ...actual,
    userHasCap: vi.fn((role: any, cap: any) => actual.userHasCap(role, cap)),
  };
});

import { chatMembersDelete } from '../src/callable/chat/membersDelete.js';

describe('chatMembersDelete unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      email?: string;
      role?: any;
      googleAccessToken?: string | null;
      requestId?: string;
      auth?: boolean;
      scopes?: string | null;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const googleAccessToken =
      'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/chat.memberships';

    const headers: Record<string, string> = {};
    if (requestId) headers['x-request-id'] = requestId;
    if (googleAccessToken) headers['x-google-access-token'] = googleAccessToken;
    if (scopes !== null && scopes !== undefined) headers['x-google-scopes'] = scopes;

    return {
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
          }
        : undefined,
      rawRequest: {
        headers,
      },
      data:
        options.data !== undefined
          ? options.data
          : {
              memberName: 'spaces/space-1/members/usr-123',
            },
    } as any;
  }

  // 시나리오 1: 미인증 -> denied
  it('rejects unauthenticated requests and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(chatMembersDelete.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        action: 'chat.members.delete',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 chat.write 부족 -> denied
  it('rejects requests lacking chat.write capability and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);

    const req = createRequest();
    await expect(chatMembersDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        action: 'chat.members.delete',
        result: 'denied',
      }),
    );
  });

  // 시나리오 3: 스코프 chat.memberships 부족 -> denied
  it('rejects requests lacking chat.memberships scope and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/chat.spaces',
    });
    await expect(chatMembersDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        action: 'chat.members.delete',
        result: 'denied',
      }),
    );
  });

  // 시나리오 4: memberName 형식 오류 (누락 또는 빈 문자열) -> invalid-argument
  it('rejects request with missing or empty memberName', async () => {
    const reqMissing = createRequest({ data: {} });
    await expect(chatMembersDelete.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_member_name',
    });

    const reqEmpty = createRequest({ data: { memberName: '   ' } });
    await expect(chatMembersDelete.run(reqEmpty)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_member_name',
    });

    expect(mockChatMembersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.members.delete',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: memberName 형식 오류 (형식 불일치) -> invalid-argument
  it('rejects request with malformed memberName', async () => {
    const reqMalformed = createRequest({ data: { memberName: 'spaces/space-1' } });
    await expect(chatMembersDelete.run(reqMalformed)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_member_name',
    });

    expect(mockChatMembersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.members.delete',
        result: 'error',
      }),
    );
  });

  // 시나리오 6: 정상 -> audit action 'chat.members.delete'
  it('deletes member successfully and writes ok audit log', async () => {
    mockChatMembersDelete.mockResolvedValueOnce({
      data: {},
    });

    const req = createRequest();
    const res = await chatMembersDelete.run(req);

    expect(res).toEqual({ ok: true });
    expect(mockChatMembersDelete).toHaveBeenCalledWith({
      name: 'spaces/space-1/members/usr-123',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.members.delete',
      target: 'spaces/space-1/members/usr-123',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'spaces/space-1/members/usr-123',
    });
  });

  // 시나리오 7: upstream 404 -> HttpsError not-found
  it('maps upstream 404 error to HttpsError not-found and writes error audit log', async () => {
    const err: any = new Error('Member not found');
    err.response = { status: 404 };
    mockChatMembersDelete.mockRejectedValueOnce(err);

    const req = createRequest();
    await expect(chatMembersDelete.run(req)).rejects.toMatchObject({
      code: 'not-found',
      message: 'google_upstream_not_found: Member not found',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.members.delete',
      target: 'spaces/space-1/members/usr-123',
      request_id: 'req-test-123',
      result: 'error',
      message: 'google_upstream_not_found: Member not found',
    });
  });
});
