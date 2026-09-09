import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockGetUserByEmail = vi.fn();
const mockSetCustomUserClaims = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUserByEmail: (...args: any[]) => mockGetUserByEmail(...args),
    setCustomUserClaims: (...args: any[]) => mockSetCustomUserClaims(...args),
  }),
}));

const mockDocSet = vi.fn();
const mockDoc = vi.fn(() => ({ set: mockDocSet }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mockDoc }),
  FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
}));

import { usersUpdateRole } from '../src/callable/users/updateRole.js';

describe('usersUpdateRole unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    mockGetUserByEmail.mockResolvedValue({ uid: 'uid-target-123' });
    mockSetCustomUserClaims.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
  });

  function createRequest(
    options: {
      email?: string;
      role?: any;
      googleAccessToken?: string | null;
      requestId?: string;
      auth?: boolean;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'super@cam.hs.kr';
    const role = 'role' in options ? options.role : 'super_admin';
    const googleAccessToken =
      'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-updrole-1';

    const headers: Record<string, string> = {};
    if (googleAccessToken) headers['x-google-access-token'] = googleAccessToken;
    if (requestId) headers['x-request-id'] = requestId;
    // 이 callable 은 OAuth scope 를 요구하지 않지만 middleware 통과를 위해 최소 헤더 유지.
    headers['x-google-scopes'] = 'https://www.googleapis.com/auth/userinfo.email';

    return {
      data:
        options.data !== undefined
          ? options.data
          : { primaryEmail: 'target@cam.hs.kr', role: 'admin' },
      auth: hasAuth
        ? { token: { email, role }, uid: 'uid-actor-1' }
        : null,
      rawRequest: { headers },
    } as any;
  }

  // 시나리오 1: 미인증 → denied 감사.
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.update_role',
        target: 'target@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: super_admin 아닌 admin 은 system.manage_roles 미보유 → denied.
  it('rejects admin without system.manage_roles capability and writes denied audit', async () => {
    const req = createRequest({ role: 'admin' });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'system.manage_roles',
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'admin',
        action: 'users.update_role',
        result: 'denied',
        message: 'system.manage_roles',
      }),
    );
  });

  // 시나리오 3: teacher 도 거부.
  it('rejects teacher role', async () => {
    const req = createRequest({ role: 'teacher' });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  // 시나리오 4: 유효하지 않은 role → invalid-argument.
  it('rejects invalid role literal and writes error audit', async () => {
    const req = createRequest({ data: { primaryEmail: 'target@cam.hs.kr', role: 'principal' } });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_role',
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.update_role',
        result: 'error',
        message: 'invalid_role',
      }),
    );
  });

  // 시나리오 5: 다른 도메인 이메일 → invalid-argument.
  it('rejects email outside ALLOWED_DOMAIN', async () => {
    const req = createRequest({
      data: { primaryEmail: 'target@other.school', role: 'admin' },
    });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email_domain',
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  // 시나리오 6: 이메일 누락 → invalid-argument.
  it('rejects missing email', async () => {
    const req = createRequest({ data: { role: 'admin' } });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'email_required',
    });
  });

  // 시나리오 7: 본인 강등 방지.
  it('prevents self-demotion when actor targets own email with lower role', async () => {
    const req = createRequest({
      data: { primaryEmail: 'super@cam.hs.kr', role: 'admin' },
    });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'cannot_demote_self',
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.update_role',
        result: 'denied',
        message: 'cannot_demote_self',
      }),
    );
  });

  // 시나리오 8: 본인 super_admin 재설정 (no-op) 은 허용.
  it('allows super_admin to re-assert own super_admin role', async () => {
    const req = createRequest({
      data: { primaryEmail: 'super@cam.hs.kr', role: 'super_admin' },
    });
    const res = await usersUpdateRole.run(req);
    expect(res.role).toBe('super_admin');
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-target-123', { role: 'super_admin' });
  });

  // 시나리오 9: 정상 — setCustomUserClaims + Firestore users/uid role 갱신 · ok 감사.
  it('promotes target user role and writes ok audit', async () => {
    const req = createRequest({
      data: { primaryEmail: 'target@cam.hs.kr', role: 'admin' },
    });
    const res = await usersUpdateRole.run(req);

    expect(res).toEqual({
      primaryEmail: 'target@cam.hs.kr',
      uid: 'uid-target-123',
      role: 'admin',
    });
    expect(mockGetUserByEmail).toHaveBeenCalledWith('target@cam.hs.kr');
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-target-123', { role: 'admin' });
    expect(mockDoc).toHaveBeenCalledWith('users/uid-target-123');
    expect(mockDocSet).toHaveBeenCalledWith(
      { role: 'admin', updatedAt: '__serverTimestamp__' },
      { merge: true },
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'users.update_role',
        target: 'users/uid-target-123',
        result: 'ok',
        message: 'role=admin email=target@cam.hs.kr',
      }),
    );
  });

  // 시나리오 10: teacher 로 강등도 정상.
  it('demotes target from admin to teacher successfully', async () => {
    const req = createRequest({
      data: { primaryEmail: 'target@cam.hs.kr', role: 'teacher' },
    });
    const res = await usersUpdateRole.run(req);
    expect(res.role).toBe('teacher');
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-target-123', { role: 'teacher' });
  });

  // 시나리오 11: Auth getUserByEmail 실패 (사용자 없음) → unknown error 감사.
  it('propagates auth lookup failure with error audit', async () => {
    mockGetUserByEmail.mockRejectedValueOnce(new Error('user-not-found'));
    const req = createRequest({
      data: { primaryEmail: 'unknown@cam.hs.kr', role: 'admin' },
    });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'user-not-found',
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.update_role',
        result: 'error',
        message: 'user-not-found',
      }),
    );
  });
});
