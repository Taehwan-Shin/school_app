import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';

const mockSet = vi.fn();
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

import { basicDataSet } from '../src/callable/basicData/set.js';

describe('basicDataSet callable unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockSet.mockResolvedValue(undefined);
    mockDoc.mockReturnValue({ set: mockSet });
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-basic-set-123';
    const data =
      options.data !== undefined
        ? options.data
        : {
            year: 2026,
            grades: [
              { grade: 1, classes: ['1', '2'] },
              { grade: 2, classes: ['A', 'B'] },
            ],
          };

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
    const req = createRequest({ auth: false });

    await expect(basicDataSet.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'unknown',
      role: 'unknown',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'denied',
      message: expect.any(String),
    });
  });

  it('rejects caller without basic_data.write capability (teacher) and writes denied audit', async () => {
    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
    });

    await expect(basicDataSet.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'denied',
      message: 'basic_data.write',
    });
  });

  it('rejects request when year is missing or invalid with invalid-argument error and error audit', async () => {
    const reqMissing = createRequest({
      data: {
        grades: [{ grade: 1, classes: ['1'] }],
      },
    });

    await expect(basicDataSet.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_basic_data',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.write',
      target: 'basic_data/*',
      request_id: 'req-basic-set-123',
      result: 'error',
      message: 'invalid_basic_data',
    });

    const reqOutOfRange = createRequest({
      data: {
        year: 2300,
        grades: [],
      },
    });

    await expect(basicDataSet.run(reqOutOfRange)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_basic_data',
    });
  });

  it('rejects request when grades array format is invalid with invalid-argument error', async () => {
    const reqInvalidGrades = createRequest({
      data: {
        year: 2026,
        grades: 'not-an-array' as any,
      },
    });

    await expect(basicDataSet.run(reqInvalidGrades)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_basic_data',
    });

    const reqInvalidGradeType = createRequest({
      data: {
        year: 2026,
        grades: [{ grade: 'one' as any, classes: ['1'] }],
      },
    });

    await expect(basicDataSet.run(reqInvalidGradeType)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_basic_data',
    });
  });

  it('rejects request when classes contains empty string with invalid-argument error', async () => {
    const reqEmptyClass = createRequest({
      data: {
        year: 2026,
        grades: [{ grade: 1, classes: ['1', ''] }],
      },
    });

    await expect(basicDataSet.run(reqEmptyClass)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_basic_data',
    });
  });

  it('rejects request when departments contains invalid elements with invalid-argument error', async () => {
    const reqInvalidDept = createRequest({
      data: {
        year: 2026,
        grades: [{ grade: 1, classes: ['1'] }],
        departments: ['국어과', ''],
      },
    });

    await expect(basicDataSet.run(reqInvalidDept)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_basic_data',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'error',
      message: 'invalid_basic_data',
    });
  });

  it('successfully creates new basic data document with departments in Firestore and writes ok audit', async () => {
    const grades = [{ grade: 1, classes: ['1', '2'] }];
    const departments = ['국어과', '수학과'];
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {
        year: 2026,
        grades,
        departments,
      },
    });

    const res = await basicDataSet.run(req);
    expect(res.year).toBe(2026);

    expect(mockCollection).toHaveBeenCalledWith('basic_data');
    expect(mockDoc).toHaveBeenCalledWith('2026');
    expect(mockSet).toHaveBeenCalledWith(
      {
        year: 2026,
        grades,
        departments,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'super@cam.hs.kr',
      },
      { merge: false },
    );

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'ok',
      message: 'set basic_data for year 2026 with 1 grades',
    });
  });

  it('successfully creates new basic data document in Firestore and writes ok audit', async () => {
    const beforeTime = Date.now();
    const grades = [
      { grade: 1, classes: ['1', '2'] },
      { grade: 2, classes: ['A', 'B'] },
    ];
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {
        year: 2026,
        grades,
      },
    });

    const res = await basicDataSet.run(req);
    const afterTime = Date.now();

    expect(res.year).toBe(2026);
    expect(res.updatedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(res.updatedAt).toBeLessThanOrEqual(afterTime);

    expect(mockCollection).toHaveBeenCalledWith('basic_data');
    expect(mockDoc).toHaveBeenCalledWith('2026');
    expect(mockSet).toHaveBeenCalledWith(
      {
        year: 2026,
        grades,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'super@cam.hs.kr',
      },
      { merge: false },
    );

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'ok',
      message: 'set basic_data for year 2026 with 2 grades',
    });
  });

  it('successfully overwrites existing basic data document with merge: false', async () => {
    const grades = [{ grade: 3, classes: ['Special'] }];
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {
        year: 2026,
        grades,
      },
    });

    const res = await basicDataSet.run(req);
    expect(res.year).toBe(2026);

    expect(mockSet).toHaveBeenCalledWith(
      {
        year: 2026,
        grades,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'super@cam.hs.kr',
      },
      { merge: false },
    );

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'ok',
      message: 'set basic_data for year 2026 with 1 grades',
    });
  });

  it('allows admin role with basic_data.write to update basic data successfully', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      data: {
        year: 2026,
        grades: [],
      },
    });

    const res = await basicDataSet.run(req);
    expect(res.year).toBe(2026);

    expect(mockSet).toHaveBeenCalledWith(
      {
        year: 2026,
        grades: [],
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'admin@cam.hs.kr',
      },
      { merge: false },
    );

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'ok',
      message: 'set basic_data for year 2026 with 0 grades',
    });
  });

  it('handles Firestore error by writing error audit and throwing HttpsError unknown', async () => {
    mockSet.mockRejectedValueOnce(new Error('Firestore write failure'));

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {
        year: 2026,
        grades: [],
      },
    });

    await expect(basicDataSet.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Firestore write failure',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.write',
      target: 'basic_data/2026',
      request_id: 'req-basic-set-123',
      result: 'error',
      message: 'Firestore write failure',
    });
  });
});
