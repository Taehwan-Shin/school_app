import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListDocuments = vi.fn();
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

import { basicDataListYears } from '../src/callable/basicData/listYears.js';

describe('basicDataListYears callable unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockCollection.mockReturnValue({ listDocuments: mockListDocuments });
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-basic-list-years-123';
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

  it('rejects unauthenticated caller with unauthenticated error and writes denied audit', async () => {
    const req = createRequest({ auth: false });

    await expect(basicDataListYears.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'unknown',
      role: 'unknown',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-list-years-123',
      result: 'denied',
      message: expect.any(String),
    });
  });

  it('rejects caller without basic_data.read capability (teacher) and writes denied audit', async () => {
    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
    });

    await expect(basicDataListYears.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-list-years-123',
      result: 'denied',
      message: 'basic_data.read',
    });
  });

  it('returns empty years array and writes ok audit when collection is empty', async () => {
    mockListDocuments.mockResolvedValueOnce([]);

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
    });

    const response = await basicDataListYears.run(req);

    expect(mockCollection).toHaveBeenCalledWith('basic_data');
    expect(mockListDocuments).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ years: [] });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-list-years-123',
      result: 'ok',
      message: 'listed 0 years',
    });
  });

  it('returns sorted years in descending order and writes ok audit when documents exist', async () => {
    mockListDocuments.mockResolvedValueOnce([
      { id: '2024' },
      { id: '2026' },
      { id: '2025' },
    ]);

    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
    });

    const response = await basicDataListYears.run(req);

    expect(response).toEqual({
      years: [2026, 2025, 2024],
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-list-years-123',
      result: 'ok',
      message: 'listed 3 years',
    });
  });

  it('ignores invalid doc ids and returns only valid year numbers', async () => {
    mockListDocuments.mockResolvedValueOnce([
      { id: 'invalid_year_str' },
      { id: '2025' },
      { id: 'backup_2026' },
      { id: '2026' },
      { id: '2024abc' },
    ]);

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
    });

    const response = await basicDataListYears.run(req);

    expect(response).toEqual({
      years: [2026, 2025],
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-list-years-123',
      result: 'ok',
      message: 'listed 2 years',
    });
  });

  it('handles Firestore listDocuments error by logging error audit and throwing HttpsError unknown', async () => {
    mockListDocuments.mockRejectedValueOnce(new Error('Firestore list failed'));

    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
    });

    await expect(basicDataListYears.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Firestore list failed',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'basic_data.read',
      target: 'basic_data/*',
      request_id: 'req-basic-list-years-123',
      result: 'error',
      message: 'Firestore list failed',
    });
  });
});
