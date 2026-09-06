import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCountGet = vi.fn();
const mockCount = vi.fn(() => ({ get: mockCountGet }));
const mockWhere = vi.fn();
const mockQuery: any = {
  where: mockWhere,
  count: mockCount,
};
const mockCollection = vi.fn(() => mockQuery);
const mockDb = { collection: mockCollection };

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return {
    ...actual,
    getFirestore: () => mockDb,
  };
});

import { auditLogCount } from '../src/callable/audit/count.js';

describe('auditLogCount callable unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockWhere.mockReturnValue(mockQuery);
    mockCount.mockReturnValue({ get: mockCountGet });
    mockCountGet.mockResolvedValue({ data: () => ({ count: 0 }) });
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      email?: string | null;
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-count-123';
    const data = options.data !== undefined ? options.data : {};

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    return {
      data,
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

  it('1. rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(auditLogCount.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'audit.read',
        target: '*',
        result: 'denied',
      }),
    );
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it('2. rejects teacher without capability and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });
    await expect(auditLogCount.run(req)).rejects.toMatchObject({ code: 'permission-denied' });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'audit.read',
      target: '*',
      request_id: 'req-count-123',
      result: 'denied',
      message: 'audit.read',
    });
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it('3. counts all entries when no filter is specified and writes ok audit log', async () => {
    mockCountGet.mockResolvedValueOnce({
      data: () => ({ count: 150 }),
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin', data: {} });
    const result = await auditLogCount.run(req);

    expect(result).toEqual({ count: 150 });
    expect(mockCollection).toHaveBeenCalledWith('audit_log');
    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'audit.read',
      target: '*',
      request_id: 'req-count-123',
      result: 'ok',
      message: 'counted 150 entries',
    });
  });

  it('4. applies atMin and atMax range filters and formats in audit message', async () => {
    mockCountGet.mockResolvedValueOnce({
      data: () => ({ count: 42 }),
    });

    const atMin = 1700000000000;
    const atMax = 1700000050000;
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { atMin, atMax },
    });
    const result = await auditLogCount.run(req);

    expect(result).toEqual({ count: 42 });
    expect(mockWhere).toHaveBeenCalledWith('at', '>=', Timestamp.fromMillis(atMin));
    expect(mockWhere).toHaveBeenCalledWith('at', '<=', Timestamp.fromMillis(atMax));
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: `counted 42 entries [atMin=${new Date(atMin).toISOString()}, atMax=${new Date(atMax).toISOString()}]`,
      }),
    );
  });

  it('5. applies actor and result combined filters', async () => {
    mockCountGet.mockResolvedValueOnce({
      data: () => ({ count: 5 }),
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {
        filterActor: 'admin@cam.hs.kr',
        filterResult: 'ok',
      },
    });
    const result = await auditLogCount.run(req);

    expect(result).toEqual({ count: 5 });
    expect(mockWhere).toHaveBeenCalledWith('actor', '==', 'admin@cam.hs.kr');
    expect(mockWhere).toHaveBeenCalledWith('result', '==', 'ok');
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'counted 5 entries [actor=admin@cam.hs.kr, result=ok]',
      }),
    );
  });

  it('6. returns exact count returned by Firestore count mock', async () => {
    mockCountGet.mockResolvedValueOnce({
      data: () => ({ count: 1024 }),
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { filterTarget: 'user@cam.hs.kr' },
    });
    const result = await auditLogCount.run(req);

    expect(result).toEqual({ count: 1024 });
    expect(mockWhere).toHaveBeenCalledWith('target', '==', 'user@cam.hs.kr');
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'counted 1024 entries [target=user@cam.hs.kr]',
      }),
    );
  });

  it('handles query count error by writing error audit log and throwing HttpsError', async () => {
    mockCountGet.mockRejectedValueOnce(new Error('Firestore count error'));

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    await expect(auditLogCount.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Firestore count error',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'audit.read',
      target: '*',
      request_id: 'req-count-123',
      result: 'error',
      message: 'Firestore count error',
    });
  });
});
