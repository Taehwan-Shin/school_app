import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockGetUserByEmail = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ getUserByEmail: (...args: any[]) => mockGetUserByEmail(...args) }),
}));

const mockDocGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mockDoc }),
}));

import { usersGetRole } from '../src/callable/users/getRole.js';

describe('usersGetRole unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    mockGetUserByEmail.mockResolvedValue({
      uid: 'uid-target-1',
      customClaims: { role: 'admin' },
    });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'admin' }),
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
    const email = options.email !== undefined ? options.email : 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';

    return {
      data:
        options.data !== undefined ? options.data : { primaryEmail: 'target@cam.hs.kr' },
      auth: hasAuth ? { token: { email, role }, uid: 'uid-actor-1' } : null,
      rawRequest: {
        headers: {
          'x-google-access-token': 'v',
          'x-google-scopes': 'https://www.googleapis.com/auth/userinfo.email',
          'x-request-id': 'req-gr-1',
        },
      },
    } as any;
  }

  it('rejects unauthenticated request', async () => {
    const req = createRequest({ auth: false });
    await expect(usersGetRole.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects teacher (missing users.read cap)', async () => {
    const req = createRequest({ role: 'teacher' });
    await expect(usersGetRole.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'users.read',
    });
  });

  it('returns role from Auth custom claim when Firestore doc absent', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const req = createRequest();
    const res = await usersGetRole.run(req);
    expect(res).toEqual({
      primaryEmail: 'target@cam.hs.kr',
      uid: 'uid-target-1',
      role: 'admin',
    });
  });

  it('returns null when neither Auth claim nor Firestore has role', async () => {
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'uid-target-1', customClaims: {} });
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const req = createRequest();
    const res = await usersGetRole.run(req);
    expect(res.role).toBeNull();
  });

  it('records role_split audit when Auth and Firestore disagree', async () => {
    mockGetUserByEmail.mockResolvedValueOnce({
      uid: 'uid-target-1',
      customClaims: { role: 'admin' },
    });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'teacher' }),
    });
    const req = createRequest();
    await usersGetRole.run(req);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.read',
        result: 'error',
        message: expect.stringContaining('role_split'),
      }),
    );
  });

  it('rejects invalid email domain', async () => {
    const req = createRequest({ data: { primaryEmail: 'x@other.school' } });
    await expect(usersGetRole.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email_domain',
    });
  });
});
