import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockOrgunitsInsert = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  orgunits: {
    insert: mockOrgunitsInsert,
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

import { orgunitsCreate } from '../src/callable/users/orgunitsCreate.js';

describe('orgunitsCreate unit tests', () => {
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
    data?: any;
  } = {}) {
    const hasAuth = options.auth !== false;
    const email = options.email ?? 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/admin.directory.orgunit';

    const headers: Record<string, string> = {
      'x-google-access-token': 'valid-google-token',
      'x-request-id': 'req-ou-create',
    };
    if (scopes !== null && scopes !== undefined) headers['x-google-scopes'] = scopes;

    return {
      data: options.data ?? { name: '3학년', parentOrgUnitPath: '/학생' },
      auth: hasAuth ? { token: { email, role }, uid: 'uid-1' } : null,
      rawRequest: { headers },
    } as any;
  }

  it('미인증 → unauthenticated + denied 감사', async () => {
    const req = createRequest({ auth: false });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockOrgunitsInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.write',
        target: 'orgunits/학생/3학년',
        result: 'denied',
      }),
    );
  });

  it('teacher → users.write cap 부족으로 permission-denied', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'users.write',
    });
    expect(mockOrgunitsInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'denied' }),
    );
  });

  it('스코프 부족 → permission-denied + insufficient_scope', async () => {
    const req = createRequest({ scopes: 'https://www.googleapis.com/auth/other' });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
        message: expect.stringContaining('insufficient_scope:'),
      }),
    );
  });

  it('name 누락 → invalid-argument', async () => {
    const req = createRequest({ data: { name: '   ', parentOrgUnitPath: '/학생' } });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'name_required',
    });
    expect(mockOrgunitsInsert).not.toHaveBeenCalled();
  });

  it('name 길이 초과 → invalid-argument', async () => {
    const longName = 'a'.repeat(101);
    const req = createRequest({ data: { name: longName, parentOrgUnitPath: '/학생' } });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('name_too_long'),
    });
  });

  it('name 에 슬래시 포함 → invalid-argument', async () => {
    const req = createRequest({ data: { name: '3학년/1반', parentOrgUnitPath: '/학생' } });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'name_invalid_chars',
    });
  });

  it('parentOrgUnitPath 잘못됨 → invalid-argument', async () => {
    const req = createRequest({ data: { name: '3학년', parentOrgUnitPath: '학생' } });
    await expect(orgunitsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_parent_path',
    });
  });

  it('정상 생성 → orgUnitPath 반환 + ok 감사', async () => {
    mockOrgunitsInsert.mockResolvedValueOnce({
      data: {
        orgUnitPath: '/학생/3학년',
        name: '3학년',
        description: '3학년 학생',
        parentOrgUnitPath: '/학생',
      },
    });
    const req = createRequest({
      data: { name: '3학년', parentOrgUnitPath: '/학생', description: '3학년 학생' },
    });
    const res = await orgunitsCreate.run(req);
    expect(res).toEqual({
      orgUnitPath: '/학생/3학년',
      name: '3학년',
      description: '3학년 학생',
      parentOrgUnitPath: '/학생',
    });
    expect(mockOrgunitsInsert).toHaveBeenCalledWith({
      customerId: 'my_customer',
      requestBody: {
        name: '3학년',
        parentOrgUnitPath: '/학생',
        description: '3학년 학생',
      },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.write',
        target: 'orgunits/학생/3학년',
        result: 'ok',
        message: expect.stringContaining('created orgunit'),
      }),
    );
  });

  it('blockInheritance 전달 → requestBody 에 포함', async () => {
    mockOrgunitsInsert.mockResolvedValueOnce({
      data: { orgUnitPath: '/학생/3학년', name: '3학년', parentOrgUnitPath: '/학생' },
    });
    const req = createRequest({
      data: { name: '3학년', parentOrgUnitPath: '/학생', blockInheritance: true },
    });
    await orgunitsCreate.run(req);
    expect(mockOrgunitsInsert).toHaveBeenCalledWith({
      customerId: 'my_customer',
      requestBody: {
        name: '3학년',
        parentOrgUnitPath: '/학생',
        blockInheritance: true,
      },
    });
  });

  it('upstream 409 → already-exists + denied? no, error 감사', async () => {
    const err: any = new Error('duplicate');
    err.response = { status: 409 };
    mockOrgunitsInsert.mockRejectedValueOnce(err);
    await expect(orgunitsCreate.run(createRequest())).rejects.toMatchObject({
      code: 'already-exists',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        message: expect.stringContaining('orgunit_already_exists'),
      }),
    );
  });

  it('upstream 403 → permission-denied + denied 감사', async () => {
    const err: any = new Error('insufficient permissions');
    err.response = { status: 403 };
    mockOrgunitsInsert.mockRejectedValueOnce(err);
    await expect(orgunitsCreate.run(createRequest())).rejects.toMatchObject({
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
    mockOrgunitsInsert.mockRejectedValueOnce(err);
    await expect(orgunitsCreate.run(createRequest())).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        message: expect.stringContaining('google_upstream_unavailable'),
      }),
    );
  });

  // v0.121b F98: Google OU 생성은 성공했으나 감사 쓰기가 실패해도 callable
  // 은 성공 응답을 반환해야 한다 (재시도 시 409 중복 방지). Cloud Logging
  // fallback 은 console.error 로 남는다.
  it('F98: insert 성공 후 writeAudit 실패 → 성공 응답 반환 · Cloud Logging fallback', async () => {
    mockOrgunitsInsert.mockResolvedValueOnce({
      data: {
        orgUnitPath: '/학생/3학년',
        name: '3학년',
        parentOrgUnitPath: '/학생',
      },
    });
    // ok 감사 3회 재시도 모두 실패.
    mockWriteAudit.mockRejectedValue(new Error('firestore_unavailable'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await orgunitsCreate.run(
      createRequest({ data: { name: '3학년', parentOrgUnitPath: '/학생' } }),
    );
    expect(res).toEqual({
      orgUnitPath: '/학생/3학년',
      name: '3학년',
      description: undefined,
      parentOrgUnitPath: '/학생',
    });
    // ok 감사가 3회 시도됐어야.
    const okCalls = mockWriteAudit.mock.calls.filter(
      (c: any[]) => c[0]?.result === 'ok',
    );
    expect(okCalls.length).toBe(3);
    // Cloud Logging fallback (structured JSON, severity=ERROR).
    const logged = errSpy.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('orgunits_create_audit_write_failed'),
    );
    expect(logged).toBeDefined();
    errSpy.mockRestore();
  });

  it('F98: insert 성공 후 writeAudit 1회 실패 · 2회차 성공 → 정상 반환 (Cloud Logging 없음)', async () => {
    mockOrgunitsInsert.mockResolvedValueOnce({
      data: { orgUnitPath: '/학생/3학년', name: '3학년', parentOrgUnitPath: '/학생' },
    });
    mockWriteAudit
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await orgunitsCreate.run(createRequest());
    expect(res.orgUnitPath).toBe('/학생/3학년');
    const logged = errSpy.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('orgunits_create_audit_write_failed'),
    );
    expect(logged).toBeUndefined();
    errSpy.mockRestore();
  });
});
