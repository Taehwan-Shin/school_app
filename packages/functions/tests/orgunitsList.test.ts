import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockOrgunitsList = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  orgunits: {
    list: mockOrgunitsList,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

vi.mock('@school-app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@school-app/shared')>();
  return {
    ...actual,
    userHasCap: vi.fn((role: any, cap: any) => actual.userHasCap(role, cap)),
  };
});

import { orgunitsList } from '../src/callable/users/orgunitsList.js';

describe('orgunitsList unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(options: {
    email?: string;
    role?: any;
    auth?: boolean;
    scopes?: string | null;
  } = {}) {
    const hasAuth = options.auth !== false;
    const email = options.email ?? 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly';

    const headers: Record<string, string> = {
      'x-google-access-token': 'valid-google-token',
      'x-request-id': 'req-ou-test',
    };
    if (scopes !== null && scopes !== undefined) headers['x-google-scopes'] = scopes;

    return {
      data: {},
      auth: hasAuth ? { token: { email, role }, uid: 'uid-1' } : null,
      rawRequest: { headers },
    } as any;
  }

  it('미인증 → unauthenticated + denied 감사', async () => {
    const req = createRequest({ auth: false });
    await expect(orgunitsList.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockOrgunitsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.read',
        target: 'orgunits',
        result: 'denied',
      }),
    );
  });

  it('teacher → users.write cap 부족으로 permission-denied', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });
    await expect(orgunitsList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'users.write',
    });
    expect(mockOrgunitsList).not.toHaveBeenCalled();
  });

  it('스코프 부족 → permission-denied + insufficient_scope', async () => {
    const req = createRequest({ scopes: 'https://www.googleapis.com/auth/other' });
    await expect(orgunitsList.run(req)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
        message: expect.stringContaining('insufficient_scope:'),
      }),
    );
  });

  it('정상 → Directory API 결과를 { orgUnits } 로 매핑', async () => {
    mockOrgunitsList.mockResolvedValueOnce({
      data: {
        organizationUnits: [
          {
            orgUnitPath: '/학생/1학년',
            name: '1학년',
            description: '1학년 학생',
            parentOrgUnitPath: '/학생',
          },
          { orgUnitPath: '/학생/2학년', name: '2학년' },
          // orgUnitPath 없는 항목은 제외 (defensive).
          { name: 'no-path' } as any,
        ],
      },
    });
    const res = await orgunitsList.run(createRequest());
    expect(res.orgUnits).toEqual([
      {
        orgUnitPath: '/학생/1학년',
        name: '1학년',
        description: '1학년 학생',
        parentOrgUnitPath: '/학생',
      },
      { orgUnitPath: '/학생/2학년', name: '2학년', description: undefined, parentOrgUnitPath: undefined },
    ]);
    expect(mockOrgunitsList).toHaveBeenCalledWith({
      customerId: 'my_customer',
      type: 'all',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.read',
        target: 'orgunits',
        result: 'ok',
        message: 'listed 2 orgunits',
      }),
    );
  });

  it('빈 결과 → orgUnits: []', async () => {
    mockOrgunitsList.mockResolvedValueOnce({ data: { organizationUnits: [] } });
    const res = await orgunitsList.run(createRequest());
    expect(res.orgUnits).toEqual([]);
  });

  it('upstream 403 → permission-denied + denied 감사', async () => {
    const err: any = new Error('insufficient permissions');
    err.response = { status: 403 };
    mockOrgunitsList.mockRejectedValueOnce(err);
    await expect(orgunitsList.run(createRequest())).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
        message: expect.stringContaining('google_upstream_denied'),
      }),
    );
  });

  it('upstream 5xx → unavailable + error 감사', async () => {
    const err: any = new Error('server error');
    err.response = { status: 502 };
    mockOrgunitsList.mockRejectedValueOnce(err);
    await expect(orgunitsList.run(createRequest())).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        message: expect.stringContaining('google_upstream_unavailable'),
      }),
    );
  });
});
