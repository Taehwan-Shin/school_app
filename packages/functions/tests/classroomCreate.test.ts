import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesCreate = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    create: mockCoursesCreate,
  },
}));
vi.mock('../src/google/classroomClient.js', () => ({
  getClassroomClient: (...args: any[]) => mockGetClassroomClient(...args),
}));

vi.mock('@school-app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@school-app/shared')>();
  return {
    ...actual,
    userHasCap: vi.fn((role: any, cap: any) => actual.userHasCap(role, cap)),
  };
});

import { classroomCreate } from '../src/callable/classroom/create.js';

describe('classroomCreate unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      email?: string;
      role?: any;
      googleAccessToken?: string | null;
      requestId?: string;
      auth?: boolean;
      scopes?: string | null;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const googleAccessToken =
      'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/classroom.courses';

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }
    if (requestId) {
      headers['x-request-id'] = requestId;
    }
    if (scopes !== null && scopes !== undefined) {
      headers['x-google-scopes'] = scopes;
    }

    return {
      data: options.data ?? { name: '기본 코스' },
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

  // 시나리오 1: 미인증 -> denied
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.create',
        target: '*',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.write 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.write',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.create',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'classroom.write',
    });
  });

  // 시나리오 3: 스코프 부족 -> denied
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.create',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.courses',
    });
  });

  // 시나리오 4: name 형식 오류 (빈 문자열 · 301자 이상) -> invalid-argument
  it('rejects request with invalid name format (empty or exceeding 300 chars)', async () => {
    const reqEmpty = createRequest({ data: { name: '   ' } });
    await expect(classroomCreate.run(reqEmpty)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_name',
    });

    const reqTooLong = createRequest({ data: { name: 'a'.repeat(301) } });
    await expect(classroomCreate.run(reqTooLong)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_name',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.create',
        target: '*',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: ownerId 형식 오류 -> invalid-argument
  it('rejects request with invalid ownerId format', async () => {
    const req = createRequest({
      data: { name: '코스명', ownerId: 'invalid owner with spaces!' },
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_owner_id',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.create',
        target: '*',
        result: 'error',
      }),
    );
  });

  // 시나리오 6: 정상 (mock create · 응답에 id=abc) -> response.course.id === 'abc' · audit action 'classroom.create' · target 'courses/abc'
  it('successfully creates course and writes ok audit log', async () => {
    mockCoursesCreate.mockResolvedValueOnce({
      data: {
        id: 'abc',
        name: '수학 101',
        section: '1학기',
        description: '설명',
        room: '101호',
        ownerId: 'me',
        courseState: 'PROVISIONED',
      },
    });

    const req = createRequest({
      data: {
        name: '수학 101',
        section: '1학기',
        description: '설명',
        room: '101호',
      },
    });

    const result = await classroomCreate.run(req);

    expect(result).toEqual({
      course: {
        id: 'abc',
        name: '수학 101',
        section: '1학기',
        description: '설명',
        room: '101호',
        ownerId: 'me',
        courseState: 'PROVISIONED',
      },
    });

    expect(mockGetClassroomClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockCoursesCreate).toHaveBeenCalledWith({
      requestBody: {
        name: '수학 101',
        section: '1학기',
        description: '설명',
        room: '101호',
        ownerId: 'me',
        courseState: 'PROVISIONED',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.create',
      target: 'courses/abc',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'name=수학 101',
    });
  });

  // 시나리오 7: upstream 403 -> HttpsError permission-denied · audit denied
  it('maps upstream 403 error to permission-denied and writes denied audit log', async () => {
    const err: any = new Error('insufficient permissions');
    err.response = { status: 403 };
    mockCoursesCreate.mockRejectedValueOnce(err);

    const req = createRequest({
      data: { name: '과학 코스' },
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: insufficient permissions',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.create',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'google_upstream_denied: insufficient permissions',
    });
  });

  // 시나리오 8: role=teacher · ownerId=me -> 정상 create
  it('allows teacher to create course with ownerId=me', async () => {
    mockCoursesCreate.mockResolvedValueOnce({
      data: { id: 'c-201', name: '수학 101', ownerId: 'teacher@cam.hs.kr' },
    });

    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { name: '수학 101', ownerId: 'me' },
    });
    const res = await classroomCreate.run(req);

    expect(res.course.id).toBe('c-201');
    expect(mockCoursesCreate).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({ ownerId: 'me' }),
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'teacher', result: 'ok' }),
    );
  });

  // 시나리오 9: role=teacher · ownerId=me 생략 (기본 'me') -> 정상 create
  it('allows teacher to create course when ownerId is omitted (defaults to me)', async () => {
    mockCoursesCreate.mockResolvedValueOnce({
      data: { id: 'c-202', name: '수학 102' },
    });

    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { name: '수학 102' },
    });
    await classroomCreate.run(req);

    expect(mockCoursesCreate).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({ ownerId: 'me' }),
    });
  });

  // 시나리오 10: role=teacher · ownerId != me -> permission-denied 'teacher_cannot_set_owner'
  it('rejects teacher setting ownerId other than me and writes denied audit', async () => {
    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { name: '수학 103', ownerId: 'other@cam.hs.kr' },
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'teacher_cannot_set_owner',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.create',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'teacher_cannot_set_owner',
    });
  });

  // 시나리오 11: role=admin · ownerId != me -> 정상 (관리자는 위임 owner 허용)
  it('allows admin to create course with ownerId other than me', async () => {
    mockCoursesCreate.mockResolvedValueOnce({
      data: { id: 'c-301', name: 'delegated course' },
    });

    const req = createRequest({
      role: 'admin',
      data: { name: 'delegated course', ownerId: 'teacher@cam.hs.kr' },
    });
    await classroomCreate.run(req);

    expect(mockCoursesCreate).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({ ownerId: 'teacher@cam.hs.kr' }),
    });
  });

  // 시나리오 12: id valid pass -> requestBody.id 에 전달
  it('allows valid domain-scoped alias id and passes it to requestBody', async () => {
    mockCoursesCreate.mockResolvedValueOnce({
      data: { id: 'c-401', name: '알리아스 코스' },
    });

    const req = createRequest({
      role: 'admin',
      data: { name: '알리아스 코스', id: 'd:2026-1-1' },
    });
    await classroomCreate.run(req);

    expect(mockCoursesCreate).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({
        id: 'd:2026-1-1',
        name: '알리아스 코스',
      }),
    });
  });

  // 시나리오 13: id invalid prefix reject -> invalid-argument invalid_id
  it('rejects id without d: prefix and throws invalid-argument invalid_id', async () => {
    const req = createRequest({
      role: 'admin',
      data: { name: '무효 알리아스 코스', id: '2026-1-1' },
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_id',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'classroom.create',
        result: 'error',
        message: 'invalid_id',
      }),
    );
  });

  // 시나리오 14: id non-string reject -> invalid-argument invalid_id
  it('rejects non-string id and throws invalid-argument invalid_id', async () => {
    const req = createRequest({
      role: 'admin',
      data: { name: '무효 타입 코스', id: 12345 },
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_id',
    });

    expect(mockCoursesCreate).not.toHaveBeenCalled();
  });

  // 시나리오 15: id 중복 (upstream 409 ALREADY_EXISTS mapping)
  it('maps upstream 409 ALREADY_EXISTS error to unknown and writes error audit log', async () => {
    const upstreamError = new Error('@ProjectPermissionDenied The course alias already exists.');
    (upstreamError as any).response = { status: 409 };
    mockCoursesCreate.mockRejectedValueOnce(upstreamError);

    const req = createRequest({
      role: 'admin',
      data: { name: '중복 코스', id: 'd:2026-1-1' },
    });

    await expect(classroomCreate.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: '@ProjectPermissionDenied The course alias already exists.',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.create',
      target: '*',
      request_id: 'req-test-123',
      result: 'error',
      message: '@ProjectPermissionDenied The course alias already exists.',
    });
  });
});
