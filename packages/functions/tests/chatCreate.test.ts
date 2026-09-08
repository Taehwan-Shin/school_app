import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockChatSpacesCreate = vi.fn();
const mockGetChatClient = vi.fn(() => ({
  spaces: {
    create: mockChatSpacesCreate,
  },
}));
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: (...args: any[]) => mockGetChatClient(...args),
}));

import { chatCreate } from '../src/callable/chat/create.js';

describe('chatCreate unit tests', () => {
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-create-123';
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
      displayName: '2026년 1학년 A반',
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
    await expect(chatCreate.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockChatSpacesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'chat.write',
        target: '*',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 부족 (teacher) -> denied audit
  it('rejects teacher with permission-denied (missing cap) and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(chatCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'chat.write',
      target: '2026년 1학년 A반',
      request_id: 'req-test-create-123',
      result: 'denied',
      message: 'chat.write',
    });
  });

  // 시나리오 3: 스코프 부족 -> denied audit
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(chatCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.write',
      target: '2026년 1학년 A반',
      request_id: 'req-test-create-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/chat.spaces',
    });
  });

  // 시나리오 4: displayName 없음/빈 문자열 -> invalid-argument · error audit
  it('rejects missing or empty displayName with invalid-argument and writes error audit', async () => {
    const reqEmpty = createRequest({
      data: { displayName: '   ' },
    });

    await expect(chatCreate.run(reqEmpty)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'display_name_required',
    });

    expect(mockChatSpacesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'chat.write',
        target: '*',
        result: 'error',
        message: 'display_name_required',
      }),
    );

    const reqMissing = createRequest({
      data: {},
    });

    await expect(chatCreate.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'display_name_required',
    });
  });

  // 시나리오 5: 정상 -> mock chat.spaces.create 응답 반환 · ok audit (target=spaces/...)
  it('creates chat space for admin and writes ok audit log with generated space name', async () => {
    mockChatSpacesCreate.mockResolvedValueOnce({
      data: {
        name: 'spaces/AAAA1234',
        displayName: '2026년 1학년 A반',
        spaceType: 'SPACE',
        createTime: '2026-09-06T10:00:00Z',
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatCreate.run(req);

    expect(result).toEqual({
      space: {
        name: 'spaces/AAAA1234',
        displayName: '2026년 1학년 A반',
        spaceType: 'SPACE',
        createTime: '2026-09-06T10:00:00Z',
      },
    });

    expect(mockGetChatClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockChatSpacesCreate).toHaveBeenCalledWith({
      requestBody: {
        displayName: '2026년 1학년 A반',
        spaceType: 'SPACE',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.write',
      target: 'spaces/AAAA1234',
      request_id: 'req-test-create-123',
      result: 'ok',
      message: 'created chat space spaces/AAAA1234 (2026년 1학년 A반)',
    });
  });

  // 시나리오 6: Google API 실패 -> error audit
  it('handles Google API error by writing error audit log and throwing HttpsError unknown', async () => {
    mockChatSpacesCreate.mockRejectedValueOnce(new Error('Google Chat API error: quota exceeded'));

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(chatCreate.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Chat API error: quota exceeded',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.write',
      target: '2026년 1학년 A반',
      request_id: 'req-test-create-123',
      result: 'error',
      message: 'Google Chat API error: quota exceeded',
    });
  });

  // 시나리오 F12: displayName 128자 초과 → invalid-argument display_name_too_long
  it('rejects displayName longer than 128 characters with invalid-argument display_name_too_long', async () => {
    const longName = 'X'.repeat(129);
    const req = createRequest({ data: { displayName: longName } });

    await expect(chatCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'display_name_too_long',
    });

    expect(mockChatSpacesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.write',
        result: 'error',
        message: 'display_name_too_long',
      }),
    );
  });

  // 시나리오 F12b: 정확히 128자 displayName 은 통과 (경계값)
  it('accepts displayName of exactly 128 characters', async () => {
    const boundary = 'X'.repeat(128);
    mockChatSpacesCreate.mockResolvedValueOnce({
      data: { name: 'spaces/BOUND128', displayName: boundary, spaceType: 'SPACE' },
    });

    const req = createRequest({ data: { displayName: boundary } });
    const result = await chatCreate.run(req);
    expect(result.space.name).toBe('spaces/BOUND128');
  });

  // 추가 시나리오: super_admin 도 생성 가능
  it('allows super_admin to create chat space and writes ok audit log', async () => {
    mockChatSpacesCreate.mockResolvedValueOnce({
      data: {
        name: 'spaces/SUPER123',
        displayName: '전교생 소통방',
        spaceType: 'SPACE',
      },
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { displayName: '전교생 소통방' },
    });
    const result = await chatCreate.run(req);

    expect(result.space.name).toBe('spaces/SUPER123');
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'chat.write',
        target: 'spaces/SUPER123',
        result: 'ok',
        message: 'created chat space spaces/SUPER123 (전교생 소통방)',
      }),
    );
  });
});
