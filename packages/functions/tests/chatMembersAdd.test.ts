import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockChatMembersCreate = vi.fn();
const mockGetChatClient = vi.fn(() => ({
  spaces: {
    members: {
      create: mockChatMembersCreate,
    },
  },
}));
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: (...args: any[]) => mockGetChatClient(...args),
}));

const mockDirectoryUsersGet = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  users: {
    get: mockDirectoryUsersGet,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

vi.mock('@school-app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@school-app/shared')>();
  return {
    ...actual,
    userHasCap: vi.fn((role: any, cap: any) => actual.userHasCap(role, cap)),
  };
});

import { chatMembersAdd } from '../src/callable/chat/membersAdd.js';

describe('chatMembersAdd unit tests', () => {
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
        : 'https://www.googleapis.com/auth/chat.memberships https://www.googleapis.com/auth/admin.directory.user.readonly';

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
              spaceName: 'spaces/space-1',
              email: 'user1@cam.hs.kr',
            },
    } as any;
  }

  // 시나리오 1: 미인증 -> denied
  it('rejects unauthenticated requests and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(chatMembersAdd.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        action: 'chat.members.add',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 chat.write 부족 -> denied
  it('rejects requests lacking chat.write capability and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);

    const req = createRequest();
    await expect(chatMembersAdd.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        action: 'chat.members.add',
        result: 'denied',
      }),
    );
  });

  // 시나리오 3: 스코프 chat.memberships 부족 -> denied
  it('rejects requests lacking chat.memberships scope and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });
    await expect(chatMembersAdd.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        action: 'chat.members.add',
        result: 'denied',
      }),
    );
  });

  // 시나리오 4: 스코프 admin.directory.user.readonly 부족 -> denied
  it('rejects requests lacking admin.directory.user.readonly scope and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/chat.memberships',
    });
    await expect(chatMembersAdd.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        action: 'chat.members.add',
        result: 'denied',
      }),
    );
  });

  // 시나리오 5: spaceName 형식 오류 -> invalid-argument
  it('rejects request with missing or invalid spaceName format', async () => {
    const reqMissing = createRequest({ data: { email: 'user1@cam.hs.kr' } });
    await expect(chatMembersAdd.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    const reqInvalid = createRequest({
      data: { spaceName: 'invalid-space', email: 'user1@cam.hs.kr' },
    });
    await expect(chatMembersAdd.run(reqInvalid)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockChatMembersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.members.add',
        result: 'error',
      }),
    );
  });

  // 시나리오 6: email 형식 오류 -> invalid-argument
  it('rejects request with missing or invalid email format', async () => {
    const reqMissing = createRequest({ data: { spaceName: 'spaces/space-1' } });
    await expect(chatMembersAdd.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email',
    });

    const reqInvalid = createRequest({
      data: { spaceName: 'spaces/space-1', email: 'not-an-email' },
    });
    await expect(chatMembersAdd.run(reqInvalid)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email',
    });

    expect(mockChatMembersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.members.add',
        result: 'error',
      }),
    );
  });

  // 시나리오 7: 정상 (mock directory.get -> mock chat.members.create) -> response.member.name · audit action 'chat.members.add'
  it('resolves user via directory and adds chat member successfully with ok audit log', async () => {
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        id: 'usr-12345',
        primaryEmail: 'user1@cam.hs.kr',
      },
    });

    const mockMember = {
      name: 'spaces/space-1/members/usr-12345',
      member: {
        name: 'users/usr-12345',
        type: 'HUMAN',
        displayName: '사용자1',
      },
      role: 'ROLE_MEMBER',
      state: 'JOINED',
    };
    mockChatMembersCreate.mockResolvedValueOnce({
      data: mockMember,
    });

    const req = createRequest();
    const res = await chatMembersAdd.run(req);

    expect(mockDirectoryUsersGet).toHaveBeenCalledWith({
      userKey: 'user1@cam.hs.kr',
    });
    expect(mockChatMembersCreate).toHaveBeenCalledWith({
      parent: 'spaces/space-1',
      requestBody: {
        member: {
          name: 'users/usr-12345',
          type: 'HUMAN',
        },
      },
    });
    expect(res.member).toEqual(mockMember);
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.members.add',
      target: 'spaces/space-1/members/usr-12345',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'email=user1@cam.hs.kr',
    });
  });

  // 시나리오 8: directory 404 -> HttpsError not-found · audit error
  it('maps directory 404 to HttpsError not-found and writes error audit log with directory_user_not_found', async () => {
    const err: any = new Error('User not found');
    err.response = { status: 404 };
    mockDirectoryUsersGet.mockRejectedValueOnce(err);

    const req = createRequest();
    await expect(chatMembersAdd.run(req)).rejects.toMatchObject({
      code: 'not-found',
      message: 'directory_user_not_found',
    });

    expect(mockChatMembersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.members.add',
      target: 'spaces/space-1/members/user1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'error',
      message: 'directory_user_not_found',
    });
  });
});
