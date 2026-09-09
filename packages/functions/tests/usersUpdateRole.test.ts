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
    mockGetUserByEmail.mockResolvedValue({
      uid: 'uid-target-123',
      customClaims: { role: 'teacher', otherFlag: true },
    });
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
    mockGetUserByEmail.mockResolvedValueOnce({
      uid: 'uid-super-1',
      customClaims: { role: 'super_admin', otherFlag: true },
    });
    const req = createRequest({
      data: { primaryEmail: 'super@cam.hs.kr', role: 'super_admin' },
    });
    const res = await usersUpdateRole.run(req);
    expect(res.role).toBe('super_admin');
    // F15: 기존 claim (otherFlag) 이 보존되어야 한다.
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-super-1', {
      role: 'super_admin',
      otherFlag: true,
    });
  });

  // 시나리오 9: 정상 — setCustomUserClaims + Firestore users/uid role · email 병기 · ok 감사.
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
    // F15: 기존 otherFlag 보존.
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-target-123', {
      role: 'admin',
      otherFlag: true,
    });
    expect(mockDoc).toHaveBeenCalledWith('users/uid-target-123');
    // F18: email 필드가 Firestore 쓰기에 포함되어야 한다.
    expect(mockDocSet).toHaveBeenCalledWith(
      { role: 'admin', email: 'target@cam.hs.kr', updatedAt: '__serverTimestamp__' },
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
    mockGetUserByEmail.mockResolvedValueOnce({
      uid: 'uid-target-123',
      customClaims: { role: 'admin' },
    });
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

  // 시나리오 12 (F15): 기존 customClaims 가 없어도 role 만 저장하며 정상 흐름 완료.
  it('F15: writes role-only claim when existing customClaims is undefined', async () => {
    mockGetUserByEmail.mockResolvedValueOnce({
      uid: 'uid-no-claims',
      customClaims: undefined,
    });
    const req = createRequest({
      data: { primaryEmail: 'nocc@cam.hs.kr', role: 'teacher' },
    });
    const res = await usersUpdateRole.run(req);
    expect(res.role).toBe('teacher');
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-no-claims', { role: 'teacher' });
  });

  // 시나리오 13 (F16): Firestore 쓰기 실패 시 Auth claim 을 이전 상태로 롤백하고 unavailable.
  it('F16: rolls back Auth claim when Firestore write fails and reports unavailable', async () => {
    mockDocSet.mockRejectedValueOnce(new Error('firestore_transient'));

    const req = createRequest({
      data: { primaryEmail: 'target@cam.hs.kr', role: 'admin' },
    });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringContaining('role_firestore_failed_rolled_back'),
    });

    // 두 번 호출: 첫 번째는 새 role 적용, 두 번째는 이전 role 로 롤백.
    expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(mockSetCustomUserClaims).toHaveBeenNthCalledWith(1, 'uid-target-123', {
      role: 'admin',
      otherFlag: true,
    });
    expect(mockSetCustomUserClaims).toHaveBeenNthCalledWith(2, 'uid-target-123', {
      role: 'teacher',
      otherFlag: true,
    });
  });

  // 시나리오 14 (F16): 롤백까지 실패하면 internal · 파괴적 정합 오류 감사.
  it('F16b: escalates to internal when rollback also fails', async () => {
    mockDocSet.mockRejectedValueOnce(new Error('firestore_down'));
    mockSetCustomUserClaims
      .mockResolvedValueOnce(undefined) // 첫 세팅 (새 role) 성공
      .mockRejectedValueOnce(new Error('auth_down')); // 롤백 실패

    const req = createRequest({
      data: { primaryEmail: 'target@cam.hs.kr', role: 'admin' },
    });
    await expect(usersUpdateRole.run(req)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining('role_write_partial_failure'),
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.update_role',
        result: 'error',
      }),
    );
  });
});
