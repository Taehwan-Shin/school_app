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

// v0.107b F42: runTransaction 은 콜백을 실행. 콜백 안 tx.get 은 mockDocGet 사용, tx.set 은
// mockDocSet 로 기록해서 기존 assertion 재사용. 콜백에서 throw 하면 그대로 위로 propagate.
const mockRunTransaction = vi.fn(async (cb: any) => {
  const tx = {
    get: async (_ref: any) => mockDocGet(),
    set: (_ref: any, payload: any, opts: any) => {
      mockDocSet(payload, opts);
    },
  };
  return cb(tx);
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mockDoc, runTransaction: mockRunTransaction }),
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

    // v0.107b F42: 기본 CAS 기대치는 default mockGetUser/mockDocGet 과 일치.
    const defaultData = {
      uid: 'uid-target-1',
      expectedAuthRole: 'admin',
      expectedFirestoreRole: 'teacher',
    };
    return {
      data: options.data !== undefined ? options.data : defaultData,
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
    const req = createRequest({
      data: {
        uid: 'uid-target-1',
        expectedAuthRole: 'null',
        expectedFirestoreRole: 'admin',
      },
    });
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

  it('rejects no-op (Auth == Firestore, 기대치도 같음)', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: { role: 'admin' },
    });
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin' }) });
    const req = createRequest({
      data: {
        uid: 'uid-target-1',
        expectedAuthRole: 'admin',
        expectedFirestoreRole: 'admin',
      },
    });
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
    mockDocSet.mockImplementationOnce(() => {
      throw new Error('firestore boom');
    });
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

  // v0.107b F42: CAS 검증.
  it('v0.107b F42: missing expectedAuthRole → invalid-argument', async () => {
    const req = createRequest({
      data: { uid: 'uid-target-1', expectedFirestoreRole: 'teacher' },
    });
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'expectedAuthRole_required',
    });
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('v0.107b F42: missing expectedFirestoreRole → invalid-argument', async () => {
    const req = createRequest({
      data: { uid: 'uid-target-1', expectedAuthRole: 'admin' },
    });
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'expectedFirestoreRole_required',
    });
  });

  it('v0.107b F42: Auth CAS 실패 (실제 Auth 가 기대치와 다름) → failed-precondition + write 안 함', async () => {
    // 실제 Auth = teacher, 기대치 = admin (예: 감지 후 usersUpdateRole 로 Auth 갱신됨).
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-target-1',
      email: 'target@cam.hs.kr',
      customClaims: { role: 'teacher' },
    });
    const req = createRequest();
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('auth_role_changed'),
    });
    expect(mockDocSet).not.toHaveBeenCalled();
    // transaction 아예 진입 안 함.
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('v0.107b F42: Firestore CAS 실패 (transaction 안 실제 Firestore 가 기대치와 다름) → failed-precondition + write 안 함', async () => {
    // Auth = admin (기대치와 일치), Firestore 실제 = super_admin (기대치 teacher 와 다름).
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'super_admin' }) });
    const req = createRequest();
    await expect(usersResolveRoleSplit.run(req)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('firestore_role_changed'),
    });
    expect(mockDocSet).not.toHaveBeenCalled();
    // transaction 진입은 함.
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it('v0.107b F42: transaction 안에서 set 이 호출되고 (경합 없을 때 normal path)', async () => {
    const req = createRequest();
    await usersResolveRoleSplit.run(req);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockDocSet).toHaveBeenCalledTimes(1);
  });
});
