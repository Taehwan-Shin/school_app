import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesPatch = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    patch: mockCoursesPatch,
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
});
