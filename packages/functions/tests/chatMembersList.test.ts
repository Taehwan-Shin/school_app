import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockChatSpacesMembersList = vi.fn();
const mockGetChatClient = vi.fn(() => ({
  spaces: {
    members: {
      list: mockChatSpacesMembersList,
    },
  },
}));
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: (...args: any[]) => mockGetChatClient(...args),
}));

import { chatMembersList } from '../src/callable/chat/membersList.js';

describe('chatMembersList unit tests', () => {
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-members-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/chat.memberships';

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }
    if (requestId) {
      headers['x-request-id'] = requestId;
    }
    if (scopes !== null && scopes !== undefined) {
      headers['x-google-scopes'] = scopes;
    }

    const defaultData = {
      spaceName: 'spaces/AAAA1234',
    };

    return {
      data: 'data' in options ? options.data : defaultData,
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
            uid: 'uid-admin-123',
          }
        : null,
      rawRequest: {
        headers,
      },
    } as any;
  }

  // 시나리오 1: 미인증 -> denied audit
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false, data: undefined });
    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'chat.read',
        target: '*',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 부족 (teacher) -> denied audit
  it('rejects teacher with permission-denied (missing cap) and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'denied',
      message: 'chat.read',
    });
  });

  // 시나리오 3: 스코프 부족 -> denied audit
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/chat.spaces',
    });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/chat.memberships',
    });
  });

  // 시나리오 4: spaceName 형식 오류 -> invalid-argument · error audit
  it('rejects missing or invalid spaceName with invalid-argument and writes error audit', async () => {
    const reqMissing = createRequest({
      data: {},
    });

    await expect(chatMembersList.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.read',
        target: '*',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );

    const reqInvalidFormat = createRequest({
      data: { spaceName: 'invalid-space-format' },
    });

    await expect(chatMembersList.run(reqInvalidFormat)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.read',
        target: 'invalid-space-format',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );
  });

  // 시나리오 5: 정상 (mock chat.spaces.members.list) -> response.members.length 정확 · ok audit
  it('lists members for admin and writes ok audit log', async () => {
    mockChatSpacesMembersList.mockResolvedValueOnce({
      data: {
        memberships: [
          {
            name: 'spaces/AAAA1234/members/user1',
            member: {
              name: 'users/12345',
              type: 'HUMAN',
              displayName: '김선생',
            },
            role: 'ROLE_MEMBER',
            state: 'JOINED',
            createTime: '2026-09-01T00:00:00Z',
          },
        ],
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatMembersList.run(req);

    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toEqual({
      name: 'spaces/AAAA1234/members/user1',
      member: {
        name: 'users/12345',
        type: 'HUMAN',
        displayName: '김선생',
      },
      role: 'ROLE_MEMBER',
      state: 'JOINED',
      createTime: '2026-09-01T00:00:00Z',
    });

    expect(mockGetChatClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockChatSpacesMembersList).toHaveBeenCalledWith({
      parent: 'spaces/AAAA1234',
      pageSize: 100,
      pageToken: undefined,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'ok',
      message: 'listed 1 members for space spaces/AAAA1234',
    });
  });

  // 시나리오 6: pagination 2 페이지 -> 모두 반환
  it('paginates over multiple pages and returns all members', async () => {
    mockChatSpacesMembersList
      .mockResolvedValueOnce({
        data: {
          memberships: [
            {
              name: 'spaces/AAAA1234/members/user1',
              member: { name: 'users/1' },
            },
            {
              name: 'spaces/AAAA1234/members/user2',
              member: { name: 'users/2' },
            },
          ],
          nextPageToken: 'token-page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          memberships: [
            {
              name: 'spaces/AAAA1234/members/user3',
              member: { name: 'users/3' },
            },
          ],
          nextPageToken: undefined,
        },
      });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatMembersList.run(req);

    expect(result.members).toHaveLength(3);
    expect(mockChatSpacesMembersList).toHaveBeenCalledTimes(2);
    expect(mockChatSpacesMembersList).toHaveBeenNthCalledWith(1, {
      parent: 'spaces/AAAA1234',
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockChatSpacesMembersList).toHaveBeenNthCalledWith(2, {
      parent: 'spaces/AAAA1234',
      pageSize: 100,
      pageToken: 'token-page-2',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'ok',
      message: 'listed 3 members for space spaces/AAAA1234',
    });
  });

  // 시나리오 7: Google API 실패 -> error audit
  it('handles Google API error by writing error audit log and throwing HttpsError unknown', async () => {
    mockChatSpacesMembersList.mockRejectedValueOnce(
      new Error('Google Chat API error: space not found'),
    );

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Chat API error: space not found',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'error',
      message: 'Google Chat API error: space not found',
    });
  });

  // 시나리오 8: spaceName 형식 오류 - spaces/ (뒤에 이름 없음) -> invalid-argument
  it('rejects spaceName with trailing slash only "spaces/" with invalid-argument', async () => {
    const req = createRequest({
      data: { spaceName: 'spaces/' },
    });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.read',
        target: 'spaces/',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );
  });

  // 시나리오 9: spaceName 형식 오류 - spaces/AAA/members/BBB (중첩 경로) -> invalid-argument
  it('rejects spaceName with nested subpath "spaces/AAA/members/BBB" with invalid-argument', async () => {
    const req = createRequest({
      data: { spaceName: 'spaces/AAA/members/BBB' },
    });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.read',
        target: 'spaces/AAA/members/BBB',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );
  });

  // 시나리오 10: spaceName 형식 오류 - spaces/AA BB (공백 포함) -> invalid-argument
  it('rejects spaceName containing spaces "spaces/AA BB" with invalid-argument', async () => {
    const req = createRequest({
      data: { spaceName: 'spaces/AA BB' },
    });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockChatSpacesMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.read',
        target: 'spaces/AA BB',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );
  });

  // 시나리오 11: Google upstream 401 mock -> HttpsError code permission-denied · audit denied
  it('maps Google upstream 401 error to permission-denied and writes denied audit log', async () => {
    const err: any = new Error('invalid auth token');
    err.response = { status: 401 };
    mockChatSpacesMembersList.mockRejectedValueOnce(err);

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: invalid auth token',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'denied',
      message: 'google_upstream_denied: invalid auth token',
    });
  });

  // 시나리오 12: Google upstream 429 mock -> HttpsError code unavailable · audit error
  it('maps Google upstream 429 error to unavailable and writes error audit log', async () => {
    const err: any = new Error('quota');
    err.response = { status: 429 };
    mockChatSpacesMembersList.mockRejectedValueOnce(err);

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(chatMembersList.run(req)).rejects.toMatchObject({
      code: 'unavailable',
      message: 'google_upstream_unavailable: quota',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-members-123',
      result: 'error',
      message: 'google_upstream_unavailable: quota',
    });
  });
});
