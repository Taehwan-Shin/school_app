import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesList = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    list: mockCoursesList,
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

import { classroomList } from '../src/callable/classroom/list.js';

describe('classroomList unit tests', () => {
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
      data: options.data ?? {},
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

  // 시나리오 1: 미인증 -> denied audit
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(classroomList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockCoursesList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.read',
        target: '*',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: 캡 부족 -> denied audit
  it('rejects request with missing cap and writes denied audit log', async () => {
    vi.mocked(userHasCap).mockReturnValueOnce(false);
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(classroomList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.read',
    });

    expect(mockCoursesList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'classroom.read',
    });
  });

  // 시나리오 3: 스코프 부족 (classroom.courses) -> denied audit
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(classroomList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockCoursesList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/classroom.courses',
    });
  });

  // 시나리오 4: 정상 (mock classroom.courses.list) -> response.courses.length 정확
  it('allows admin with required scopes to list courses and writes ok audit log', async () => {
    mockCoursesList.mockResolvedValueOnce({
      data: {
        courses: [
          {
            id: 'c-101',
            name: '1학년 1반 수학',
            section: '1학기',
            courseState: 'ACTIVE',
            alternateLink: 'https://classroom.google.com/c/c-101',
          },
          {
            id: 'c-102',
            name: '1학년 2반 영어',
            section: '1학기',
            courseState: 'ARCHIVED',
            alternateLink: 'https://classroom.google.com/c/c-102',
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await classroomList.run(req);

    expect(result).toEqual({
      courses: [
        {
          id: 'c-101',
          name: '1학년 1반 수학',
          section: '1학기',
          courseState: 'ACTIVE',
          alternateLink: 'https://classroom.google.com/c/c-101',
        },
        {
          id: 'c-102',
          name: '1학년 2반 영어',
          section: '1학기',
          courseState: 'ARCHIVED',
          alternateLink: 'https://classroom.google.com/c/c-102',
        },
      ],
    });

    expect(mockGetClassroomClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockCoursesList).toHaveBeenCalledWith({
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 2 classroom courses',
    });
  });

  // 시나리오 5: pagination 2 페이지 -> 모두 반환
  it('supports pagination over multiple pages and returns all courses', async () => {
    mockCoursesList
      .mockResolvedValueOnce({
        data: {
          courses: [
            { id: 'c-1', name: 'Course 1', courseState: 'ACTIVE' },
            { id: 'c-2', name: 'Course 2', courseState: 'ACTIVE' },
          ],
          nextPageToken: 'page-token-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          courses: [
            { id: 'c-3', name: 'Course 3', courseState: 'ARCHIVED' },
          ],
          nextPageToken: null,
        },
      });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await classroomList.run(req);

    expect(result.courses).toHaveLength(3);
    expect(result.courses[0].id).toBe('c-1');
    expect(result.courses[1].id).toBe('c-2');
    expect(result.courses[2].id).toBe('c-3');
    expect(mockCoursesList).toHaveBeenCalledTimes(2);
    expect(mockCoursesList).toHaveBeenNthCalledWith(1, {
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockCoursesList).toHaveBeenNthCalledWith(2, {
      pageSize: 100,
      pageToken: 'page-token-2',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 3 classroom courses',
    });
  });

  // 시나리오 6: Google upstream 401 -> HttpsError permission-denied · audit denied
  it('maps Google upstream 401 error to permission-denied and writes denied audit log', async () => {
    const err: any = new Error('invalid credentials');
    err.response = { status: 401 };
    mockCoursesList.mockRejectedValueOnce(err);

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(classroomList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: invalid credentials',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'google_upstream_denied: invalid credentials',
    });
  });

  // 시나리오 7: Google upstream 429 -> HttpsError unavailable · audit error
  it('maps Google upstream 429 error to unavailable and writes error audit log', async () => {
    const err: any = new Error('quota exceeded');
    err.response = { status: 429 };
    mockCoursesList.mockRejectedValueOnce(err);

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(classroomList.run(req)).rejects.toMatchObject({
      code: 'unavailable',
      message: 'google_upstream_unavailable: quota exceeded',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'classroom.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'error',
      message: 'google_upstream_unavailable: quota exceeded',
    });
  });
});
