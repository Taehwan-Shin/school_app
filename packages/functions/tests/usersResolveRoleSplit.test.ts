import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockGetUser = vi.fn();
const mockSetCustomUserClaims = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: (...args: any[]) => mockGetUser(...args),
    setCustomUserClaims: (...args: any[]) => mockSetCustomUserClaims(...args),
  }),
}));

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet, set: mockDocSet }));
const mockFieldValueDelete = vi.fn(() => ({ __sentinel: 'delete' }));
const mockFieldValueServerTimestamp = vi.fn(() => ({ __sentinel: 'serverTimestamp' }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mockDoc }),
  FieldValue: {
    delete: (...args: any[]) => mockFieldValueDelete(...args),
    serverTimestamp: (...args: any[]) => mockFieldValueServerTimestamp(...args),
  },
}));

import { usersResolveRoleSplit } from '../src/callable/users/resolveRoleSplit.js';

describe('usersResolveRoleSplit unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    // 기본: split 발생 (Auth=admin, Firestore=teacher)
    mockGetUser.mockResolvedValue({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: { role: 'admin' },
    });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'teacher' }),
    });
  });

  function createRequest(
    options: {
      role?: any;
      auth?: boolean;
      data?: any;
      email?: string;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'super@cam.hs.kr';
    const role = 'role' in options ? options.role : 'super_admin';

    return {
      data:
        options.data !== undefined ? options.data : { uid: 'uid-target-1' },
      auth: hasAuth ? { token: { email, role }, uid: 'uid-actor-1' } : null,
      rawRequest: {
        headers: {
          'x-google-access-token': 'v',
          'x-google-scopes': 'https://www.googleapis.com/auth/userinfo.email',
          'x-request-id': 'req-rrs-1',
        },
      },
    } as any;
  }

  it('rejects unauthenticated request', async () => {
    const req = createRequest({ auth: false });
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'system.role_split_resolved', result: 'denied' }),
    );
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects admin (missing system.manage_roles cap)', async () => {
    const req = createRequest({ role: 'admin' });
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('resolves split by writing Auth role to Firestore (Auth=admin, Firestore=teacher)', async () => {
    const req = createRequest();
    const res = await usersResolveRoleSplit.run(req);
    expect(res).toEqual({
      primaryEmail: 'target@cam.hs.kr',
      uid: 'uid-target-1',
      authRole: 'admin',
      previousFirestoreRole: 'teacher',
      newFirestoreRole: 'admin',
    });
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'admin',
        email: 'target@cam.hs.kr',
      }),
      { merge: true },
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.role_split_resolved',
        result: 'ok',
        message: expect.stringContaining('firestore teacher → admin'),
      }),
    );
    // Auth 는 손대지 않아야 (source of truth 로 두고 Firestore 만 갱신).
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('resolves split by deleting Firestore role when Auth=null', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: {},
    });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin' }) });
    const req = createRequest();
    const res = await usersResolveRoleSplit.run(req);
    expect(res.authRole).toBeNull();
    expect(res.previousFirestoreRole).toBe('admin');
    expect(res.newFirestoreRole).toBeNull();
    // Firestore role 필드 삭제.
    expect(mockFieldValueDelete).toHaveBeenCalled();
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        role: { __sentinel: 'delete' },
        email: 'target@cam.hs.kr',
      }),
      { merge: true },
    );
  });

  it('rejects no-op (Auth == Firestore)', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: { role: 'admin' },
    });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin' }) });
    const req = createRequest();
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('no_split'),
    });
    expect(mockDocSet).not.toHaveBeenCalled();
    // 실패도 감사 (result=denied for failed-precondition).
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.role_split_resolved',
        result: 'denied',
        message: expect.stringContaining('no_split'),
      }),
    );
  });

  it('rejects invalid email domain (uid → Auth email 이 non-allowed 도메인)', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-target-1',
      email: 'x@other.school',
      customClaims: { role: 'admin' },
    });
    const req = createRequest();
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email_domain',
    });
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects missing uid', async () => {
    const req = createRequest({ data: {} });
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'uid_required',
    });
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('audits error result when Firestore write throws (not denied)', async () => {
    mockDocSet.mockRejectedValueOnce(new Error('firestore boom'));
    const req = createRequest();
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'firestore boom',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.role_split_resolved',
        result: 'error',
        message: 'firestore boom',
      }),
    );
  });
});
