import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesStudentsDelete = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    students: {
      delete: mockCoursesStudentsDelete,
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

import { classroomStudentsDelete } from '../src/callable/classroom/studentsDelete.js';

describe('classroomStudentsDelete unit tests', () => {
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
        : 'https://www.googleapis.com/auth/classroom.rosters';

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
      data:
        options.data !== undefined
          ? options.data
          : { courseId: 'c-101', userId: 'student1@cam.hs.kr' },
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
            uid: 'uid-admin-123',
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
    await expect(classroomStudentsDelete.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesStudentsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.students.delete',
        target: 'courses/c-101/students/student1@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.write 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'student@cam.hs.kr', role: 'teacher' });

    await expect(classroomStudentsDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.write',
    });

    expect(mockCoursesStudentsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'student@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.students.delete',
      target: 'courses/c-101/students/student1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'classroom.write',
    });
  });

  // 시나리오 3: 스코프 classroom.rosters 부족 -> denied
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(classroomStudentsDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesStudentsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.students.delete',
      target: 'courses/c-101/students/student1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.rosters',
    });
  });

  // 시나리오 4: courseId 형식 오류 -> invalid-argument
  it('rejects request with missing or invalid courseId format', async () => {
    const reqMissing = createRequest({ data: { userId: 'student1@cam.hs.kr' } });
    await expect(classroomStudentsDelete.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    const reqInvalid = createRequest({
      data: { courseId: 'bad id with spaces!', userId: 'student1@cam.hs.kr' },
    });
    await expect(classroomStudentsDelete.run(reqInvalid)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    expect(mockCoursesStudentsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.students.delete',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: userId 형식 오류 (빈 문자열 · 공백 포함) -> invalid-argument
  it('rejects request with missing, empty, or space-containing userId format', async () => {
    const reqMissing = createRequest({ data: { courseId: 'c-101' } });
    await expect(classroomStudentsDelete.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_user_id',
    });

    const reqEmpty = createRequest({ data: { courseId: 'c-101', userId: '' } });
    await expect(classroomStudentsDelete.run(reqEmpty)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_user_id',
    });

    const reqSpaces = createRequest({
      data: { courseId: 'c-101', userId: 'user name@cam.hs.kr' },
    });
    await expect(classroomStudentsDelete.run(reqSpaces)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_user_id',
    });

    expect(mockCoursesStudentsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.students.delete',
        result: 'error',
      }),
    );
  });

  // 시나리오 6: 정상 (mock students.delete) -> response ok: true · audit action 'classroom.students.delete'
  it('deletes student successfully and writes ok audit log', async () => {
    mockCoursesStudentsDelete.mockResolvedValueOnce({
      data: {},
    });

    const req = createRequest();
    const res = await classroomStudentsDelete.run(req);

    expect(res).toEqual({ ok: true });
    expect(mockCoursesStudentsDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'student1@cam.hs.kr',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.students.delete',
      target: 'courses/c-101/students/student1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'userId=student1@cam.hs.kr',
    });
  });

  // 시나리오 7: upstream 404 (존재하지 않음 등) -> HttpsError · audit error
  it('maps upstream 404 error to HttpsError and writes error audit log', async () => {
    const err: any = new Error('Student not found.');
    err.response = { status: 404 };
    mockCoursesStudentsDelete.mockRejectedValueOnce(err);

    const req = createRequest();
    await expect(classroomStudentsDelete.run(req)).rejects.toMatchObject({
      message: 'google_upstream_not_found: Student not found.',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.students.delete',
      target: 'courses/c-101/students/student1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'error',
      message: 'google_upstream_not_found: Student not found.',
    });
  });
});
