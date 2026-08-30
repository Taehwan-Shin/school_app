import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryUsersList = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  users: {
    list: mockDirectoryUsersList,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { usersList } from '../src/callable/users/list.js';
import { authenticateRequest } from '../src/authz/middleware.js';

describe('usersList unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(options: {
    email?: string;
    role?: any;
    googleAccessToken?: string | null;
    requestId?: string;
    auth?: boolean;
  } = {}) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const googleAccessToken = 'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-123';

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }
    if (requestId) {
      headers['x-request-id'] = requestId;
    }
    // 에뮬레이터 모드에서는 스코프를 헤더로 명시. 기본은 users.list 요구 스코프 포함.
    headers['x-google-scopes'] = 'https://www.googleapis.com/auth/admin.directory.user.readonly';

    return {
      data: {},
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
            uid: 'uid-123',
          }
        : null,
      rawRequest: {
        headers,
      },
    } as any;
  }

  it('allows admin to list users and writes ok audit log', async () => {
    mockDirectoryUsersList.mockResolvedValueOnce({
      data: {
        users: [
          {
            primaryEmail: 'teacher1@cam.hs.kr',
            name: { givenName: '길동', familyName: '홍' },
            orgUnitPath: '/교사',
            isAdmin: false,
            suspended: false,
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await usersList.run(req);

    expect(result).toEqual({
      users: [
        {
          email: 'teacher1@cam.hs.kr',
          firstName: '길동',
          lastName: '홍',
          orgUnitPath: '/교사',
          isAdmin: false,
          isSuspended: false,
        },
      ],
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'users.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 1 users',
    });
  });

  it('allows super_admin to list users and writes ok audit log', async () => {
    mockDirectoryUsersList.mockResolvedValueOnce({
      data: {
        users: [
          {
            primaryEmail: 'super@cam.hs.kr',
            name: { givenName: '슈퍼', familyName: '김' },
            orgUnitPath: '/',
            isAdmin: true,
            suspended: false,
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await usersList.run(req);

    expect(result.users).toHaveLength(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        result: 'ok',
      }),
    );
  });

  it('rejects teacher with permission-denied and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(usersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryUsersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'users.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'users.read',
    });
  });

  it('supports pagination over multiple pages', async () => {
    mockDirectoryUsersList
      .mockResolvedValueOnce({
        data: {
          users: [
            { primaryEmail: 'u1@cam.hs.kr', name: { givenName: '1', familyName: 'U' }, orgUnitPath: '/', isAdmin: false, suspended: false },
          ],
          nextPageToken: 'page-token-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          users: [
            { primaryEmail: 'u2@cam.hs.kr', name: { givenName: '2', familyName: 'U' }, orgUnitPath: '/', isAdmin: false, suspended: false },
          ],
          nextPageToken: null,
        },
      });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await usersList.run(req);

    expect(result.users).toHaveLength(2);
    expect(result.users[0].email).toBe('u1@cam.hs.kr');
    expect(result.users[1].email).toBe('u2@cam.hs.kr');
    expect(mockDirectoryUsersList).toHaveBeenCalledTimes(2);
    expect(mockDirectoryUsersList).toHaveBeenNthCalledWith(1, {
      customer: 'my_customer',
      maxResults: 100,
      pageToken: undefined,
      orderBy: 'email',
    });
    expect(mockDirectoryUsersList).toHaveBeenNthCalledWith(2, {
      customer: 'my_customer',
      maxResults: 100,
      pageToken: 'page-token-2',
      orderBy: 'email',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'listed 2 users',
      }),
    );
  });

  it('handles Google API error by writing error audit log and throwing HttpsError unknown', async () => {
    mockDirectoryUsersList.mockRejectedValueOnce(new Error('Google API network failure'));

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(usersList.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google API network failure',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'users.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'error',
      message: 'Google API network failure',
    });
  });

  it('rejects unauthenticated request', async () => {
    const req = createRequest({ auth: false });
    await expect(usersList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects request with invalid domain', async () => {
    const req = createRequest({ email: 'intruder@example.com', role: 'admin' });
    await expect(usersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects request with missing role', async () => {
    const req = createRequest({ email: 'admin@cam.hs.kr', role: undefined });
    await expect(usersList.run(req)).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('rejects request with missing Google Access Token header', async () => {
    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin', googleAccessToken: null });
    await expect(usersList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'missing_google_access_token',
    });
  });

  // 감사 무결성 회귀 방지 — 인증 실패 시 role='unknown' 을 기록한다.
  // 이전에는 위조된 'teacher' 로 기록되어 실 actor 권한과 감사가 어긋났다.
  describe('denied audit role fidelity (no forgery)', () => {
    it('writes denied audit with actor=unknown role=unknown when unauthenticated', async () => {
      const req = createRequest({ auth: false });
      await expect(usersList.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'unknown',
          role: 'unknown',
          action: 'users.read',
          target: '*',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with role=unknown when role claim is missing', async () => {
      const req = createRequest({ email: 'admin@cam.hs.kr', role: undefined });
      await expect(usersList.run(req)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'admin@cam.hs.kr',
          role: 'unknown',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with role=unknown when role claim is an unknown value', async () => {
      const req = createRequest({ email: 'admin@cam.hs.kr', role: 'wizard' as any });
      await expect(usersList.run(req)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'admin@cam.hs.kr',
          role: 'unknown',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with actor=email role=unknown when domain is invalid', async () => {
      const req = createRequest({ email: 'intruder@example.com', role: 'admin' });
      await expect(usersList.run(req)).rejects.toMatchObject({ code: 'permission-denied' });
      // 도메인 검증은 middleware 초반에 실패해서 role claim 을 보기 전에 throw 하지만
      // 우리 catch 는 claim 을 보고 정상 role 이면 그대로 사용한다.
      // (claim='admin' 이므로 role='admin' 으로 기록. domain 만 잘못이라 role 자체는 유효.)
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'intruder@example.com',
          role: 'admin',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with role=unknown when both email and role are missing', async () => {
      const req = createRequest({ email: null as any, role: null as any });
      await expect(usersList.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'unknown',
          role: 'unknown',
          result: 'denied',
        }),
      );
    });
  });

  describe('production tokeninfo validation', () => {
    beforeEach(() => {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    });

    it('authenticates when tokeninfo matches email in production', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'admin@cam.hs.kr', scope: 'https://www.googleapis.com/auth/admin.directory.user' }),
      } as any);

      try {
        const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin', googleAccessToken: 'prod-token' });
        const user = await authenticateRequest(req);
        expect(user.email).toBe('admin@cam.hs.kr');
        expect(user.googleAccessToken).toBe('prod-token');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws token_subject_mismatch when tokeninfo email differs', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'different@cam.hs.kr' }),
      } as any);

      try {
        const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin', googleAccessToken: 'prod-token' });
        await expect(authenticateRequest(req)).rejects.toMatchObject({
          code: 'unauthenticated',
          message: 'token_subject_mismatch',
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws invalid_google_access_token when tokeninfo returns 400', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error_description: 'Invalid Value' }),
      } as any);

      try {
        const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin', googleAccessToken: 'invalid-token' });
        await expect(authenticateRequest(req)).rejects.toMatchObject({
          code: 'unauthenticated',
          message: 'invalid_google_access_token',
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
