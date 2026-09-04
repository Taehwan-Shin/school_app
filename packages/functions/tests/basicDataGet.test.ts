import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

const mockGet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockDb = { collection: mockCollection };

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return {
    ...actual,
    getFirestore: () => mockDb,
  };
});

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

import { basicDataGet } from '../src/callable/basicData/get.js';

describe('basicDataGet callable unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockDoc.mockReturnValue({ get: mockGet });
    mockCollection.mockReturnValue({ doc: mockDoc });
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-basic-get-123';
    const data = options.data !== undefined ? options.data : { year: 2026 };

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

  it('rejects unauthenticated caller with unauthenticated error and writes denied audit', async () => {
    const req = createRequest({ auth: false, data: { year: 2026 } });

    await expect(basicDataGet.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'unknown',
      role: 'unknown',
      action: 'basic_data.read',
      target: 'basic_data/2026',
      request_id: 'req-basic-get-123',
      result: 'denied',
      message: expect.any(String),
    });
  });

  it('rejects caller without basic_data.read capability (teacher) and writes denied audit', async () => {
    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { year: 2026 },
    });

    await expect(basicDataGet.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'basic_data.read',
      target: 'basic_data/2026',
      request_id: 'req-basic-get-123',
      result: 'denied',
      message: 'basic_data.read',
    });
  });

  it('rejects invalid year (string or out of range) with invalid-argument and writes error audit', async () => {
    const reqStr = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      data: { year: '2026' as any },
    });

    await expect(basicDataGet.run(reqStr)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_year',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-get-123',
      result: 'error',
      message: 'invalid_year',
    });

    const reqOutOfRange = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      data: { year: 1899 },
    });

    await expect(basicDataGet.run(reqOutOfRange)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_year',
    });
  });

  it('returns document data and writes ok audit when document exists in Firestore', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        year: 2026,
        grades: [
          { grade: 1, classes: ['1', '2', '3'] },
          { grade: 2, classes: ['A', 'B'] },
        ],
        updatedAt: Timestamp.fromMillis(1700000000000),
        updatedBy: 'super@cam.hs.kr',
      }),
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { year: 2026 },
    });

    const response = await basicDataGet.run(req);

    expect(mockCollection).toHaveBeenCalledWith('basic_data');
    expect(mockDoc).toHaveBeenCalledWith('2026');
    expect(response).toEqual({
      data: {
        year: 2026,
        grades: [
          { grade: 1, classes: ['1', '2', '3'] },
          { grade: 2, classes: ['A', 'B'] },
        ],
        updatedAt: 1700000000000,
        updatedBy: 'super@cam.hs.kr',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.read',
      target: 'basic_data/2026',
      request_id: 'req-basic-get-123',
      result: 'ok',
      message: 'read basic_data for year 2026 (exists)',
    });
  });

  it('returns document data with rosters when rosters exists in Firestore', async () => {
    const rosters = {
      '1': {
        '1': ['s1@cam.hs.kr', 's2@cam.hs.kr'],
        '2': [],
      },
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        year: 2026,
        grades: [{ grade: 1, classes: ['1', '2'] }],
        rosters,
        updatedAt: Timestamp.fromMillis(1700000000000),
        updatedBy: 'super@cam.hs.kr',
      }),
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { year: 2026 },
    });

    const response = await basicDataGet.run(req);

    expect(mockCollection).toHaveBeenCalledWith('basic_data');
    expect(mockDoc).toHaveBeenCalledWith('2026');
    expect(response).toEqual({
      data: {
        year: 2026,
        grades: [{ grade: 1, classes: ['1', '2'] }],
        rosters,
        updatedAt: 1700000000000,
        updatedBy: 'super@cam.hs.kr',
      },
    });
  });

  it('returns data null and writes ok audit when document does not exist in Firestore', async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { year: 2027 },
    });

    const response = await basicDataGet.run(req);

    expect(mockCollection).toHaveBeenCalledWith('basic_data');
    expect(mockDoc).toHaveBeenCalledWith('2027');
    expect(response).toEqual({
      data: null,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.read',
      target: 'basic_data/2027',
      request_id: 'req-basic-get-123',
      result: 'ok',
      message: 'read basic_data for year 2027 (not found)',
    });
  });

  it('allows admin role with basic_data.read to retrieve basic data', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        year: 2026,
        grades: [{ grade: 1, classes: ['1'] }],
      }),
    });

    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      data: { year: 2026 },
    });

    const response = await basicDataGet.run(req);

    expect(response).toEqual({
      data: {
        year: 2026,
        grades: [{ grade: 1, classes: ['1'] }],
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'basic_data.read',
      target: 'basic_data/2026',
      request_id: 'req-basic-get-123',
      result: 'ok',
      message: 'read basic_data for year 2026 (exists)',
    });
  });

  it('handles Firestore error by logging error audit and throwing HttpsError unknown', async () => {
    mockGet.mockRejectedValueOnce(new Error('Firestore read failure'));

    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      data: { year: 2026 },
    });

    await expect(basicDataGet.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Firestore read failure',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'basic_data.read',
      target: 'basic_data/2026',
      request_id: 'req-basic-get-123',
      result: 'error',
      message: 'Firestore read failure',
    });
  });
});
