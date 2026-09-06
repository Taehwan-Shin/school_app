import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesTeachersCreate = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    teachers: {
      create: mockCoursesTeachersCreate,
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

import { classroomTeachersAdd } from '../src/callable/classroom/teachersAdd.js';

describe('classroomTeachersAdd unit tests', () => {
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
          : { courseId: 'c-101', userId: 'teacher1@cam.hs.kr' },
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
    await expect(classroomTeachersAdd.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.teachers.add',
        target: 'courses/c-101/teachers/teacher1@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.write 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomTeachersAdd.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.write',
    });

    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.teachers.add',
      target: 'courses/c-101/teachers/teacher1@cam.hs.kr',
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

    await expect(classroomTeachersAdd.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.teachers.add',
      target: 'courses/c-101/teachers/teacher1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.rosters',
    });
  });

  // 시나리오 4: courseId 형식 오류 -> invalid-argument
  it('rejects request with missing or invalid courseId format', async () => {
    const reqMissing = createRequest({ data: { userId: 'teacher1@cam.hs.kr' } });
    await expect(classroomTeachersAdd.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    const reqInvalid = createRequest({
      data: { courseId: 'bad id with spaces!', userId: 'teacher1@cam.hs.kr' },
    });
    await expect(classroomTeachersAdd.run(reqInvalid)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.teachers.add',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: userId 형식 오류 (빈 문자열 · 공백 포함) -> invalid-argument
  it('rejects request with missing, empty, or space-containing userId format', async () => {
    const reqMissing = createRequest({ data: { courseId: 'c-101' } });
    await expect(classroomTeachersAdd.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_user_id',
    });

    const reqEmpty = createRequest({ data: { courseId: 'c-101', userId: '' } });
    await expect(classroomTeachersAdd.run(reqEmpty)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_user_id',
    });

    const reqSpaces = createRequest({
      data: { courseId: 'c-101', userId: 'user name@cam.hs.kr' },
    });
    await expect(classroomTeachersAdd.run(reqSpaces)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_user_id',
    });

    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.teachers.add',
        result: 'error',
      }),
    );
  });

  // 시나리오 6: 정상 (mock teachers.create) -> response.teacher.userId · audit action 'classroom.teachers.add'
  it('adds teacher successfully and writes ok audit log', async () => {
    const mockTeacher = {
      courseId: 'c-101',
      userId: 'teacher1@cam.hs.kr',
      profile: {
        id: '10987654321',
        name: { fullName: '김교사', givenName: '교사', familyName: '김' },
        emailAddress: 'teacher1@cam.hs.kr',
      },
    };
    mockCoursesTeachersCreate.mockResolvedValueOnce({
      data: mockTeacher,
    });

    const req = createRequest();
    const res = await classroomTeachersAdd.run(req);

    expect(res.teacher).toBeDefined();
    expect(res.teacher.userId).toBe('teacher1@cam.hs.kr');
    expect(res.teacher.profile?.name?.fullName).toBe('김교사');
    expect(mockCoursesTeachersCreate).toHaveBeenCalledWith({
      courseId: 'c-101',
      requestBody: { userId: 'teacher1@cam.hs.kr' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.teachers.add',
      target: 'courses/c-101/teachers/teacher1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'userId=teacher1@cam.hs.kr',
    });
  });

  // 시나리오 7: upstream 409 (이미 존재 등) -> HttpsError · audit error · message 유지
  it('maps upstream 409 error to HttpsError and writes error audit log while preserving message', async () => {
    const err: any = new Error('The user is already a teacher of this course.');
    err.response = { status: 409 };
    mockCoursesTeachersCreate.mockRejectedValueOnce(err);

    const req = createRequest();
    await expect(classroomTeachersAdd.run(req)).rejects.toMatchObject({
      message: 'The user is already a teacher of this course.',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.teachers.add',
      target: 'courses/c-101/teachers/teacher1@cam.hs.kr',
      request_id: 'req-test-123',
      result: 'error',
      message: 'The user is already a teacher of this course.',
    });
  });
});
