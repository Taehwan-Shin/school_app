import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockChatSpacesDelete = vi.fn();
const mockGetChatClient = vi.fn(() => ({
  spaces: {
    delete: mockChatSpacesDelete,
  },
}));
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: (...args: any[]) => mockGetChatClient(...args),
}));

import { chatDelete } from '../src/callable/chat/delete.js';

describe('chatDelete unit tests', () => {
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-delete-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/chat.spaces';

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
      name: 'spaces/AAAA1234',
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
    await expect(chatDelete.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockChatSpacesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'chat.delete',
        target: '*',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 부족 (teacher) -> denied audit
  it('rejects teacher with permission-denied (missing cap) and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(chatDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'chat.delete',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-delete-123',
      result: 'denied',
      message: 'chat.delete',
    });
  });

  // 시나리오 3: 스코프 부족 -> denied audit
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(chatDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.delete',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-delete-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/chat.spaces',
    });
  });

  // 시나리오 4: name 없음/형식 오류 -> invalid-argument · error audit
  it('rejects missing or invalid name with invalid-argument and writes error audit', async () => {
    const reqMissing = createRequest({
      data: {},
    });

    await expect(chatDelete.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockChatSpacesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.delete',
        target: '*',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );

    const reqInvalidFormat = createRequest({
      data: { name: 'invalid-name-format' },
    });

    await expect(chatDelete.run(reqInvalidFormat)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_space_name',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.delete',
        target: 'invalid-name-format',
        result: 'error',
        message: 'invalid_space_name',
      }),
    );
  });

  // 시나리오 5: 정상 -> mock chat.spaces.delete 호출 확인 · ok audit
  it('deletes chat space for admin and writes ok audit log', async () => {
    mockChatSpacesDelete.mockResolvedValueOnce({
      data: {},
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatDelete.run(req);

    expect(result).toEqual({
      deleted: true,
      name: 'spaces/AAAA1234',
    });

    expect(mockGetChatClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockChatSpacesDelete).toHaveBeenCalledWith({
      name: 'spaces/AAAA1234',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.delete',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-delete-123',
      result: 'ok',
      message: 'deleted chat space spaces/AAAA1234',
    });
  });

  // 시나리오 6: Google API 실패 -> error audit
  it('handles Google API error by writing error audit log and throwing HttpsError unknown', async () => {
    mockChatSpacesDelete.mockRejectedValueOnce(new Error('Google Chat API error: space not found'));

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(chatDelete.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Chat API error: space not found',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.delete',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-delete-123',
      result: 'error',
      message: 'Google Chat API error: space not found',
    });
  });

  // 추가 시나리오: super_admin 정상 삭제 가능
  it('allows super_admin to delete chat space and writes ok audit log', async () => {
    mockChatSpacesDelete.mockResolvedValueOnce({
      data: {},
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { name: 'spaces/SUPER123' },
    });
    const result = await chatDelete.run(req);

    expect(result).toEqual({
      deleted: true,
      name: 'spaces/SUPER123',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'chat.delete',
        target: 'spaces/SUPER123',
        result: 'ok',
        message: 'deleted chat space spaces/SUPER123',
      }),
    );
  });
});
