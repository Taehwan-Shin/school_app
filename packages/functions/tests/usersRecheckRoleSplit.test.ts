import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockGetUser = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ getUser: (...args: any[]) => mockGetUser(...args) }),
}));

const mockDocGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mockDoc }),
}));

import { usersRecheckRoleSplit } from '../src/callable/users/recheckRoleSplit.js';

describe('usersRecheckRoleSplit unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    mockGetUser.mockResolvedValue({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: { role: 'admin' },
    });
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ role: 'teacher' }) });
  });

  function createRequest(
    options: {
      role?: any;
      auth?: boolean;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const role = 'role' in options ? options.role : 'super_admin';
    return {
      data: options.data ?? { uid: 'uid-target-1' },
      auth: hasAuth ? { token: { email: 'super@cam.hs.kr', role }, uid: 'uid-a' } : null,
      rawRequest: {
        headers: {
          'x-google-access-token': 'valid-google-token',
          'x-request-id': 'req-rr-1',
        },
      },
    } as any;
  }

  it('rejects unauthenticated', async () => {
    const req = createRequest({ auth: false });
    await expect(usersRecheckRoleSplit.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects admin (missing system.manage_roles cap)', async () => {
    const req = createRequest({ role: 'admin' });
    await expect(usersRecheckRoleSplit.run(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('records new detected when split (auth=admin firestore=teacher)', async () => {
    const req = createRequest();
    const res = await usersRecheckRoleSplit.run(req);
    expect(res).toEqual({
      primaryEmail: 'target@cam.hs.kr',
      uid: 'uid-target-1',
      authRole: 'admin',
      firestoreRole: 'teacher',
      isSplit: true,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.role_split_detected',
        result: 'error',
        message: expect.stringContaining('role_split: auth=admin firestore=teacher'),
      }),
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('rechecked') }),
    );
  });

  it('records resolved_by_recheck when in sync (auth=admin firestore=admin)', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin' }) });
    const req = createRequest();
    const res = await usersRecheckRoleSplit.run(req);
    expect(res.isSplit).toBe(false);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.role_split_resolved',
        result: 'ok',
        message: expect.stringContaining('resolved_by_recheck'),
      }),
    );
  });

  it('handles Auth=null / Firestore=admin split (auth 삭제됐는데 Firestore 남음)', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: {},
    });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin' }) });
    const req = createRequest();
    const res = await usersRecheckRoleSplit.run(req);
    expect(res.authRole).toBeNull();
    expect(res.firestoreRole).toBe('admin');
    expect(res.isSplit).toBe(true);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('role_split: auth=null firestore=admin'),
      }),
    );
  });

  it('rejects missing uid', async () => {
    const req = createRequest({ data: {} });
    await expect(usersRecheckRoleSplit.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'uid_required',
    });
  });

  it('does not write to Firestore or Auth (read-only)', async () => {
    // mockDoc 은 get 만 노출 (set 없음). getAuth 도 getUser 만 노출.
    const req = createRequest();
    await usersRecheckRoleSplit.run(req);
    // 오직 read + audit 만.
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });
});
