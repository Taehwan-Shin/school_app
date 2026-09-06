import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesDelete = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    delete: mockCoursesDelete,
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

import { classroomDelete } from '../src/callable/classroom/delete.js';

describe('classroomDelete unit tests', () => {
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
      data: options.data ?? { id: 'c-101' },
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
    await expect(classroomDelete.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.delete',
        target: 'courses/c-101',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 classroom.write 부족 -> denied
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.write',
    });

    expect(mockCoursesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.delete',
      target: 'courses/c-101',
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

    await expect(classroomDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.delete',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.courses',
    });
  });

  // 시나리오 4: id 형식 오류 -> invalid-argument
  it('rejects request with invalid course id format', async () => {
    const req = createRequest({
      data: { id: 'invalid id with spaces!' },
    });

    await expect(classroomDelete.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });

    expect(mockCoursesDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'classroom.delete',
        result: 'error',
      }),
    );
  });

  // 시나리오 5: 정상 (mock delete) -> response.ok === true · audit action classroom.delete
  it('successfully deletes course and writes ok audit log with action classroom.delete', async () => {
    mockCoursesDelete.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      data: { id: 'c-101' },
    });

    const result = await classroomDelete.run(req);

    expect(result).toEqual({ ok: true });
    expect(mockGetClassroomClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockCoursesDelete).toHaveBeenCalledWith({ id: 'c-101' });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.delete',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'deleted classroom course c-101',
    });
  });

  // 시나리오 6: upstream 403 -> HttpsError permission-denied · audit denied
  it('maps upstream 403 error to permission-denied and writes denied audit log', async () => {
    const err: any = new Error('insufficient permissions');
    err.response = { status: 403 };
    mockCoursesDelete.mockRejectedValueOnce(err);

    const req = createRequest({
      data: { id: 'c-101' },
    });

    await expect(classroomDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: insufficient permissions',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.delete',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'google_upstream_denied: insufficient permissions',
    });
  });

  // 시나리오 7: upstream 404 -> HttpsError not-found · audit error
  it('maps upstream 404 error to not-found and writes error audit log', async () => {
    const err: any = new Error('course not found');
    err.response = { status: 404 };
    mockCoursesDelete.mockRejectedValueOnce(err);

    const req = createRequest({
      data: { id: 'c-101' },
    });

    await expect(classroomDelete.run(req)).rejects.toMatchObject({
      code: 'not-found',
      message: 'google_upstream_not_found: course not found',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.delete',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'error',
      message: 'google_upstream_not_found: course not found',
    });
  });
});
