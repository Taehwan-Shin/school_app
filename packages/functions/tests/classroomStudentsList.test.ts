import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesStudentsList = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    students: {
      list: mockCoursesStudentsList,
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

import { classroomStudentsList } from '../src/callable/classroom/studentsList.js';

describe('classroomStudentsList unit tests', () => {
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
    await expect(classroomStudentsList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesStudentsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.read',
        target: 'courses/c-101/students',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.read 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomStudentsList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.read',
    });

    expect(mockCoursesStudentsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.read',
      target: 'courses/c-101/students',
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

    await expect(classroomStudentsList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesStudentsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: 'courses/c-101/students',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.rosters',
    });
  });

  // 시나리오 4: courseId 형식 오류 -> invalid-argument
  it('rejects request with missing or invalid courseId format', async () => {
    const reqMissing = createRequest({ data: {} });
    await expect(classroomStudentsList.run(reqMissing)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    const reqInvalid = createRequest({ data: { courseId: 'bad id with spaces!' } });
    await expect(classroomStudentsList.run(reqInvalid)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    expect(mockCoursesStudentsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.read',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: 정상 (mock students.list) -> response.students.length 정확
  it('lists students successfully and writes ok audit log', async () => {
    mockCoursesStudentsList.mockResolvedValueOnce({
      data: {
        students: [
          {
            courseId: 'c-101',
            userId: 'student-1',
            profile: {
              name: { fullName: '김학생' },
              emailAddress: 'student1@cam.hs.kr',
            },
          },
          {
            courseId: 'c-101',
            userId: 'student-2',
            profile: {
              name: { fullName: '이학생' },
              emailAddress: 'student2@cam.hs.kr',
            },
          },
        ],
      },
    });

    const req = createRequest();
    const res = await classroomStudentsList.run(req);

    expect(res.students).toHaveLength(2);
    expect(res.students[0].userId).toBe('student-1');
    expect(res.students[0].profile?.name?.fullName).toBe('김학생');
    expect(res.students[0].profile?.emailAddress).toBe('student1@cam.hs.kr');
    expect(mockCoursesStudentsList).toHaveBeenCalledWith({
      courseId: 'c-101',
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: 'courses/c-101/students',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 2 students for course c-101',
    });
  });

  // 시나리오 6: pagination 2 페이지 -> 모두 반환
  it('paginates across multiple pages and returns all students', async () => {
    mockCoursesStudentsList
      .mockResolvedValueOnce({
        data: {
          students: [{ courseId: 'c-101', userId: 's-1' }],
          nextPageToken: 'page-token-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          students: [{ courseId: 'c-101', userId: 's-2' }],
          nextPageToken: undefined,
        },
      });

    const req = createRequest();
    const res = await classroomStudentsList.run(req);

    expect(res.students).toHaveLength(2);
    expect(res.students[0].userId).toBe('s-1');
    expect(res.students[1].userId).toBe('s-2');
    expect(mockCoursesStudentsList).toHaveBeenCalledTimes(2);
    expect(mockCoursesStudentsList).toHaveBeenNthCalledWith(1, {
      courseId: 'c-101',
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockCoursesStudentsList).toHaveBeenNthCalledWith(2, {
      courseId: 'c-101',
      pageSize: 100,
      pageToken: 'page-token-2',
    });
  });

  // 시나리오 7: upstream 403 -> HttpsError permission-denied · audit denied
  it('maps upstream 403 to permission-denied and writes denied audit log', async () => {
    const error: any = new Error('The caller does not have permission');
    error.response = { status: 403 };
    mockCoursesStudentsList.mockRejectedValueOnce(error);

    const req = createRequest();
    await expect(classroomStudentsList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: The caller does not have permission',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: 'courses/c-101/students',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'google_upstream_denied: The caller does not have permission',
    });
  });
});
