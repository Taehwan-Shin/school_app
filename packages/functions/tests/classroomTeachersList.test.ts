import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesTeachersList = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    teachers: {
      list: mockCoursesTeachersList,
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

import { classroomTeachersList } from '../src/callable/classroom/teachersList.js';

describe('classroomTeachersList unit tests', () => {
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
      data: options.data !== undefined ? options.data : { courseId: 'c-101' },
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
    await expect(classroomTeachersList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesTeachersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.read',
        target: 'courses/c-101/teachers',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.read 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomTeachersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.read',
    });

    expect(mockCoursesTeachersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.read',
      target: 'courses/c-101/teachers',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'classroom.read',
    });
  });

  // 시나리오 3: 스코프 classroom.rosters 부족 -> denied
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(classroomTeachersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesTeachersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: 'courses/c-101/teachers',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.rosters',
    });
  });

  // 시나리오 4: courseId 형식 오류 -> invalid-argument
  it('rejects request with missing or invalid courseId format', async () => {
    const reqMissing = createRequest({ data: {} });
    await expect(classroomTeachersList.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    const reqInvalid = createRequest({ data: { courseId: 'bad id with spaces!' } });
    await expect(classroomTeachersList.run(reqInvalid)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    expect(mockCoursesTeachersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.read',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: 정상 (mock teachers.list) -> response.teachers.length 정확
  it('lists teachers successfully and writes ok audit log', async () => {
    mockCoursesTeachersList.mockResolvedValueOnce({
      data: {
        teachers: [
          {
            courseId: 'c-101',
            userId: 'teacher-1',
            profile: {
              name: { fullName: '김교사' },
              emailAddress: 'teacher1@cam.hs.kr',
            },
          },
          {
            courseId: 'c-101',
            userId: 'teacher-2',
            profile: {
              name: { fullName: '이교사' },
              emailAddress: 'teacher2@cam.hs.kr',
            },
          },
        ],
      },
    });

    const req = createRequest();
    const res = await classroomTeachersList.run(req);

    expect(res.teachers).toHaveLength(2);
    expect(res.teachers[0].userId).toBe('teacher-1');
    expect(res.teachers[0].profile?.name?.fullName).toBe('김교사');
    expect(res.teachers[0].profile?.emailAddress).toBe('teacher1@cam.hs.kr');
    expect(mockCoursesTeachersList).toHaveBeenCalledWith({
      courseId: 'c-101',
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: 'courses/c-101/teachers',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 2 teachers for course c-101',
    });
  });

  // 시나리오 6: pagination 2 페이지 -> 모두 반환
  it('paginates across multiple pages and returns all teachers', async () => {
    mockCoursesTeachersList
      .mockResolvedValueOnce({
        data: {
          teachers: [{ courseId: 'c-101', userId: 't-1' }],
          nextPageToken: 'page-token-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          teachers: [{ courseId: 'c-101', userId: 't-2' }],
          nextPageToken: undefined,
        },
      });

    const req = createRequest();
    const res = await classroomTeachersList.run(req);

    expect(res.teachers).toHaveLength(2);
    expect(res.teachers[0].userId).toBe('t-1');
    expect(res.teachers[1].userId).toBe('t-2');
    expect(mockCoursesTeachersList).toHaveBeenCalledTimes(2);
    expect(mockCoursesTeachersList).toHaveBeenNthCalledWith(1, {
      courseId: 'c-101',
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockCoursesTeachersList).toHaveBeenNthCalledWith(2, {
      courseId: 'c-101',
      pageSize: 100,
      pageToken: 'page-token-2',
    });
  });

  // 시나리오 7: upstream 403 -> HttpsError permission-denied · audit denied
  it('maps upstream 403 to permission-denied and writes denied audit log', async () => {
    const error: any = new Error('The caller does not have permission');
    error.response = { status: 403 };
    mockCoursesTeachersList.mockRejectedValueOnce(error);

    const req = createRequest();
    await expect(classroomTeachersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: The caller does not have permission',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: 'courses/c-101/teachers',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'google_upstream_denied: The caller does not have permission',
    });
  });
});
