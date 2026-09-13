import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesPatch = vi.fn();
const mockCoursesTeachersGet = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    patch: mockCoursesPatch,
    teachers: {
      get: mockCoursesTeachersGet,
    },
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

import { classroomPatch } from '../src/callable/classroom/patch.js';

describe('classroomPatch unit tests', () => {
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
      data: options.data ?? { id: 'c-101', courseState: 'ARCHIVED' },
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
    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.write',
        target: 'courses/c-101',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.archive 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.archive',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.write',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'classroom.archive',
    });
  });

  // 시나리오 3: 스코프 부족 -> denied
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.write',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.courses',
    });
  });

  // 시나리오 4: id 형식 오류 -> invalid-argument
  it('rejects request with invalid course id format', async () => {
    const req = createRequest({
      data: { id: 'bad id with spaces!', courseState: 'ARCHIVED' },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.write',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: courseState 값 오류 -> invalid-argument
  it('rejects request with invalid courseState value', async () => {
    const req = createRequest({
      data: { id: 'c-101', courseState: 'FOO' },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_state',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.write',
        target: 'courses/c-101',
        result: 'error',
      }),
    );
  });

  // 시나리오 6: 정상 (mock patch) -> response.course.courseState === request.courseState
  it('successfully patches course courseState and writes ok audit log', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: {
        id: 'c-101',
        name: '1학년 1반 수학',
        section: '1학기',
        courseState: 'ARCHIVED',
        alternateLink: 'https://classroom.google.com/c/c-101',
      },
    });

    const req = createRequest({
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });

    const result = await classroomPatch.run(req);

    expect(result).toEqual({
      course: {
        id: 'c-101',
        name: '1학년 1반 수학',
        section: '1학기',
        courseState: 'ARCHIVED',
        alternateLink: 'https://classroom.google.com/c/c-101',
      },
    });

    expect(mockGetClassroomClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockCoursesPatch).toHaveBeenCalledWith({
      id: 'c-101',
      updateMask: 'courseState',
      requestBody: { courseState: 'ARCHIVED' },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.write',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'courseState=ARCHIVED',
    });
  });

  // 시나리오 7: upstream 403 -> HttpsError permission-denied · audit denied
  it('maps upstream 403 error to permission-denied and writes denied audit log', async () => {
    const err: any = new Error('insufficient permissions');
    err.response = { status: 403 };
    mockCoursesPatch.mockRejectedValueOnce(err);

    const req = createRequest({
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: insufficient permissions',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.write',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'google_upstream_denied: insufficient permissions',
    });
  });

  // v0.115b F72 시나리오 8: role=admin -> teachers.get 사전 검증 우회
  it('does not pre-check teacher membership for admin role', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });

    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });
    await classroomPatch.run(req);

    expect(mockCoursesTeachersGet).not.toHaveBeenCalled();
    expect(mockCoursesPatch).toHaveBeenCalledTimes(1);
  });

  // v0.115b F72 시나리오 9: role=teacher · teachers.get 성공 -> 정상 patch
  it('proceeds with patch when teacher is a member of the target course', async () => {
    mockCoursesTeachersGet.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'teacher@cam.hs.kr' },
    });
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });

    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });
    await classroomPatch.run(req);

    expect(mockCoursesTeachersGet).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'me',
    });
    expect(mockCoursesPatch).toHaveBeenCalledTimes(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'teacher',
        action: 'classroom.write',
        result: 'ok',
      }),
    );
  });

  // v0.115b F72 시나리오 10: role=teacher · teachers.get 404 -> permission-denied
  it('rejects teacher when not a member of the target course and writes denied audit', async () => {
    const notFoundErr: any = new Error('Requested entity was not found.');
    notFoundErr.response = { status: 404 };
    mockCoursesTeachersGet.mockRejectedValueOnce(notFoundErr);

    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { id: 'c-101', courseState: 'ARCHIVED' },
    });
    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'teacher_not_in_course',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.write',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'teacher_not_in_course',
    });
  });

  // v0.134 시나리오 11: 필드 하나도 없이 id 만 -> invalid-argument no_fields_to_update
  it('rejects request with no updatable fields', async () => {
    const req = createRequest({
      data: { id: 'c-101' },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'no_fields_to_update',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.write',
        target: 'courses/c-101',
        result: 'error',
      }),
    );
  });

  // v0.134 시나리오 12: name 만 정상 patch -> updateMask=name · audit message name=...
  it('successfully patches name only and writes ok audit log with quoted value', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: {
        id: 'c-101',
        name: '2026 1학년 1반',
        courseState: 'ACTIVE',
      },
    });

    const req = createRequest({
      data: { id: 'c-101', name: '2026 1학년 1반' },
    });

    const result = await classroomPatch.run(req);
    expect(result.course.name).toBe('2026 1학년 1반');

    expect(mockCoursesPatch).toHaveBeenCalledWith({
      id: 'c-101',
      updateMask: 'name',
      requestBody: { name: '2026 1학년 1반' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'name="2026 1학년 1반"',
      }),
    );
  });

  // v0.134 시나리오 13: name + courseState 동시 -> updateMask=courseState,name · audit 합성
  it('supports combined courseState + name update in one call', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: {
        id: 'c-101',
        name: '수학 심화',
        courseState: 'ARCHIVED',
      },
    });

    const req = createRequest({
      data: { id: 'c-101', courseState: 'ARCHIVED', name: '수학 심화' },
    });

    await classroomPatch.run(req);

    expect(mockCoursesPatch).toHaveBeenCalledWith({
      id: 'c-101',
      updateMask: 'courseState,name',
      requestBody: { courseState: 'ARCHIVED', name: '수학 심화' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'courseState=ARCHIVED;name="수학 심화"',
      }),
    );
  });

  // v0.134 시나리오 14: name 이 공백만 -> invalid-argument invalid_name
  it('rejects whitespace-only name', async () => {
    const req = createRequest({
      data: { id: 'c-101', name: '   ' },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_name',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
  });

  // v0.134b 시나리오 15: name 이 API 한도 750 초과 -> invalid-argument name_too_long
  it('rejects name longer than 750 chars (Classroom API 한도)', async () => {
    const req = createRequest({
      data: { id: 'c-101', name: 'a'.repeat(751) },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'name_too_long',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
  });

  // v0.134b 시나리오 15b: name 정확히 750 은 통과
  it('accepts name at exactly 750 chars (boundary)', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', name: 'a'.repeat(750) },
    });
    const req = createRequest({
      data: { id: 'c-101', name: 'a'.repeat(750) },
    });
    await classroomPatch.run(req);
    expect(mockCoursesPatch).toHaveBeenCalledWith(
      expect.objectContaining({ updateMask: 'name' }),
    );
  });

  // v0.134b 시나리오 15c: section 이 API 한도 2800 초과 -> invalid-argument section_too_long
  it('rejects section longer than 2800 chars (Classroom API 한도)', async () => {
    const req = createRequest({
      data: { id: 'c-101', section: 'a'.repeat(2801) },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'section_too_long',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
  });

  // v0.134 시나리오 16: name 이 문자열 아님 -> invalid-argument invalid_name
  it('rejects non-string name', async () => {
    const req = createRequest({
      data: { id: 'c-101', name: 123 as unknown as string },
    });

    await expect(classroomPatch.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_name',
    });

    expect(mockCoursesPatch).not.toHaveBeenCalled();
  });

  // v0.134 시나리오 17: section 만 정상 patch (빈 문자열 clear 허용) -> updateMask=section
  it('supports section-only patch including empty string to clear', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', section: '', name: '수학' },
    });

    const req = createRequest({
      data: { id: 'c-101', section: '' },
    });

    await classroomPatch.run(req);

    expect(mockCoursesPatch).toHaveBeenCalledWith({
      id: 'c-101',
      updateMask: 'section',
      requestBody: { section: '' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'section=""',
      }),
    );
  });

  // v0.134 시나리오 18: name 값의 앞뒤 공백은 서버가 trim 하여 저장
  it('trims leading/trailing whitespace in name', async () => {
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', name: '수학' },
    });

    const req = createRequest({
      data: { id: 'c-101', name: '  수학  ' },
    });

    await classroomPatch.run(req);

    expect(mockCoursesPatch).toHaveBeenCalledWith({
      id: 'c-101',
      updateMask: 'name',
      requestBody: { name: '수학' },
    });
  });

  // v0.134 시나리오 19: name-only 요청에서 archive cap 없어도 write cap 만으로 통과 가능해야 한다.
  // (teacher 는 두 cap 모두 있어서 실제 차단 시나리오는 안 되지만, 코드 경로가 write 만 assert 하는지 검증.)
  it('name-only request only asserts classroom.write cap (not classroom.archive)', async () => {
    // teacher role · assertTeacherInCourse mock 성공.
    mockCoursesTeachersGet.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'teacher@cam.hs.kr' },
    });
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', name: '새 이름' },
    });

    // userHasCap 을 spy 로 감싸 호출 인자만 검증.
    const spy = vi.mocked(userHasCap);
    spy.mockClear();

    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
      data: { id: 'c-101', name: '새 이름' },
    });
    await classroomPatch.run(req);

    // classroom.archive 는 호출되지 않아야 한다 (courseState 미포함).
    const calls = spy.mock.calls.map((c) => c[1]);
    expect(calls).toContain('classroom.write');
    expect(calls).not.toContain('classroom.archive');
  });
});
