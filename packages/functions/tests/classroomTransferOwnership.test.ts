import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasCap } from '@school-app/shared';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCoursesPatch = vi.fn();
const mockCoursesTeachersGet = vi.fn();
const mockCoursesTeachersCreate = vi.fn();
const mockCoursesTeachersDelete = vi.fn();
const mockGetClassroomClient = vi.fn(() => ({
  courses: {
    patch: mockCoursesPatch,
    teachers: {
      get: mockCoursesTeachersGet,
      create: mockCoursesTeachersCreate,
      delete: mockCoursesTeachersDelete,
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

import { classroomTransferOwnership } from '../src/callable/classroom/transferOwnership.js';

describe('classroomTransferOwnership unit tests', () => {
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
        : 'https://www.googleapis.com/auth/classroom.courses https://www.googleapis.com/auth/classroom.rosters';

    const headers: Record<string, string> = {};
    if (googleAccessToken) headers['x-google-access-token'] = googleAccessToken;
    if (requestId) headers['x-request-id'] = requestId;
    if (scopes !== null && scopes !== undefined) headers['x-google-scopes'] = scopes;

    return {
      data: options.data ?? { courseId: 'c-101', newOwnerEmail: 'newowner@cam.hs.kr' },
      auth: hasAuth
        ? { token: { email, role }, uid: 'uid-123' }
        : null,
      rawRequest: { headers },
    } as any;
  }

  // 시나리오 1: 미인증 -> denied
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(classroomTransferOwnership.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'classroom.transfer_owner',
        target: 'courses/c-101',
        result: 'denied',
      }),
    );
  });

  // 시나리오 2: teacher role -> classroom.transfer_owner cap 없음 → denied
  it('rejects teacher role (no classroom.transfer_owner cap) and writes denied audit', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });
    await expect(classroomTransferOwnership.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'classroom.transfer_owner',
    });
    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.transfer_owner',
      target: 'courses/c-101',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'classroom.transfer_owner',
    });
  });

  // 시나리오 3: 스코프 부족 -> denied
  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });
    await expect(classroomTransferOwnership.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
        message: expect.stringContaining('insufficient_scope:'),
      }),
    );
  });

  // 시나리오 4: courseId 형식 오류
  it('rejects invalid course id format', async () => {
    const req = createRequest({
      data: { courseId: 'bad id!', newOwnerEmail: 'x@cam.hs.kr' },
    });
    await expect(classroomTransferOwnership.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_course_id',
    });
    expect(mockCoursesPatch).not.toHaveBeenCalled();
  });

  // 시나리오 5: newOwnerEmail 형식 오류
  it('rejects invalid new owner email format', async () => {
    const req = createRequest({
      data: { courseId: 'c-101', newOwnerEmail: 'not-an-email' },
    });
    await expect(classroomTransferOwnership.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_new_owner_email',
    });
    expect(mockCoursesPatch).not.toHaveBeenCalled();
  });

  // 시나리오 6: 정상 (newOwner 이미 teacher) → teachers.create 미호출 · patch(ownerId) · ok
  it('transfers ownership when new owner already teacher (no add)', async () => {
    mockCoursesTeachersGet.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    mockCoursesPatch.mockResolvedValueOnce({
      data: {
        id: 'c-101',
        name: '1학년 1반 수학',
        ownerId: 'newowner@cam.hs.kr',
        courseState: 'ACTIVE',
      },
    });

    const result = await classroomTransferOwnership.run(createRequest());
    expect(result.addedAsTeacher).toBe(false);
    expect(result.course.ownerId).toBe('newowner@cam.hs.kr');
    expect(mockCoursesTeachersGet).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'newowner@cam.hs.kr',
    });
    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockCoursesPatch).toHaveBeenCalledWith({
      id: 'c-101',
      updateMask: 'ownerId',
      requestBody: { ownerId: 'newowner@cam.hs.kr' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'classroom.transfer_owner',
        target: 'courses/c-101',
        result: 'ok',
        message: 'newOwner=newowner@cam.hs.kr addedAsTeacher=false',
      }),
    );
  });

  // 시나리오 7: 정상 (newOwner teacher 아님 → 사전 추가 → patch)
  it('adds new owner as teacher first when teachers.get 404, then transfers', async () => {
    const notFound: any = new Error('Not found');
    notFound.response = { status: 404 };
    mockCoursesTeachersGet.mockRejectedValueOnce(notFound);
    mockCoursesTeachersCreate.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', ownerId: 'newowner@cam.hs.kr', courseState: 'ACTIVE' },
    });

    const result = await classroomTransferOwnership.run(createRequest());
    expect(result.addedAsTeacher).toBe(true);
    expect(mockCoursesTeachersCreate).toHaveBeenCalledWith({
      courseId: 'c-101',
      requestBody: { userId: 'newowner@cam.hs.kr' },
    });
    expect(mockCoursesPatch).toHaveBeenCalledTimes(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'newOwner=newowner@cam.hs.kr addedAsTeacher=true',
      }),
    );
  });

  // 시나리오 8: patch 403 → permission-denied · denied 감사 · teacher fallback 은 완료됐어도 audit 은 denied
  it('maps patch 403 to permission-denied and writes denied audit', async () => {
    mockCoursesTeachersGet.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    const err: any = new Error('insufficient permissions');
    err.response = { status: 403 };
    mockCoursesPatch.mockRejectedValueOnce(err);

    await expect(classroomTransferOwnership.run(createRequest())).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'google_upstream_denied: insufficient permissions',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'classroom.transfer_owner',
        target: 'courses/c-101',
        result: 'denied',
        message: 'google_upstream_denied: insufficient permissions',
      }),
    );
  });

  // 시나리오 9: teachers.get 500 (non-404) → error 매핑 · teachers.create 미시도
  it('propagates teachers.get 500 without teacher create fallback', async () => {
    const err: any = new Error('server error');
    err.response = { status: 500 };
    mockCoursesTeachersGet.mockRejectedValueOnce(err);

    await expect(classroomTransferOwnership.run(createRequest())).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'classroom.transfer_owner',
        result: 'error',
      }),
    );
  });

  // v0.116b F74 시나리오 10: ALLOWED_DOMAIN 이외 이메일 → invalid_new_owner_domain
  it('rejects new owner email outside ALLOWED_DOMAIN before any API call', async () => {
    const req = createRequest({
      data: { courseId: 'c-101', newOwnerEmail: 'newowner@example.com' },
    });
    await expect(classroomTransferOwnership.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_new_owner_domain',
    });
    expect(mockCoursesTeachersGet).not.toHaveBeenCalled();
    expect(mockCoursesTeachersCreate).not.toHaveBeenCalled();
    expect(mockCoursesPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'classroom.transfer_owner',
        target: 'courses/c-101',
        message: 'invalid_new_owner_domain',
      }),
    );
  });

  // v0.116b F75 시나리오 11: 사전 teachers.create 후 patch 400 → 보상 teachers.delete +
  // partial audit (added_teacher_but_patch_failed rollback=ok) 기록 · 중복 audit 없음.
  it('rolls back added teacher when patch fails with confirmed 4xx', async () => {
    const notFound: any = new Error('teacher not in course');
    notFound.response = { status: 404 };
    mockCoursesTeachersGet.mockRejectedValueOnce(notFound);
    mockCoursesTeachersCreate.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    const patchErr: any = new Error('bad request');
    patchErr.response = { status: 400 };
    mockCoursesPatch.mockRejectedValueOnce(patchErr);
    mockCoursesTeachersDelete.mockResolvedValueOnce({ data: {} });

    await expect(classroomTransferOwnership.run(createRequest())).rejects.toMatchObject({
      code: 'unknown',
    });
    expect(mockCoursesTeachersCreate).toHaveBeenCalledTimes(1);
    expect(mockCoursesTeachersDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'newowner@cam.hs.kr',
    });
    // partial audit 1 회만 기록 (외곽 catch 는 skip).
    const transferAudits = mockWriteAudit.mock.calls.filter(
      (call) => call[0]?.action === 'classroom.transfer_owner',
    );
    expect(transferAudits).toHaveLength(1);
    expect(transferAudits[0][0]).toMatchObject({
      result: 'error',
      message: expect.stringMatching(
        /^added_teacher_but_patch_failed:.*rollback=ok$/,
      ),
    });
  });

  // v0.116b F75 시나리오 12: teachers.create 후 patch 5xx → 보상 skip · rollback=skipped
  it('skips rollback when patch fails with 5xx (state uncertain)', async () => {
    const notFound: any = new Error('teacher not in course');
    notFound.response = { status: 404 };
    mockCoursesTeachersGet.mockRejectedValueOnce(notFound);
    mockCoursesTeachersCreate.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    const patchErr: any = new Error('upstream unavailable');
    patchErr.response = { status: 503 };
    mockCoursesPatch.mockRejectedValueOnce(patchErr);

    await expect(classroomTransferOwnership.run(createRequest())).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(mockCoursesTeachersDelete).not.toHaveBeenCalled();
    const transferAudits = mockWriteAudit.mock.calls.filter(
      (call) => call[0]?.action === 'classroom.transfer_owner',
    );
    expect(transferAudits).toHaveLength(1);
    expect(transferAudits[0][0]).toMatchObject({
      result: 'error',
      message: expect.stringMatching(
        /^added_teacher_but_patch_failed:.*rollback=skipped$/,
      ),
    });
  });

  // v0.116b F75 시나리오 13: teachers.create 후 patch 400 + 보상 teachers.delete 실패
  // → rollback=failed 로 기록 (에러 자체는 원래 patch 매핑 그대로 throw).
  it('records rollback=failed when compensating teachers.delete also fails', async () => {
    const notFound: any = new Error('teacher not in course');
    notFound.response = { status: 404 };
    mockCoursesTeachersGet.mockRejectedValueOnce(notFound);
    mockCoursesTeachersCreate.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    const patchErr: any = new Error('bad request');
    patchErr.response = { status: 400 };
    mockCoursesPatch.mockRejectedValueOnce(patchErr);
    mockCoursesTeachersDelete.mockRejectedValueOnce(new Error('delete also fails'));

    await expect(classroomTransferOwnership.run(createRequest())).rejects.toMatchObject({
      code: 'unknown',
    });
    expect(mockCoursesTeachersDelete).toHaveBeenCalledTimes(1);
    const transferAudits = mockWriteAudit.mock.calls.filter(
      (call) => call[0]?.action === 'classroom.transfer_owner',
    );
    expect(transferAudits).toHaveLength(1);
    expect(transferAudits[0][0].message).toMatch(/rollback=failed$/);
  });

  // v0.116c F76 시나리오 14: patch 성공 후 audit write 실패 시, patch 성공을
  // partial-fail 로 오분류하지 않는다 · 결과는 성공으로 반환 · teachers.delete 미시도.
  it('returns success even when audit write fails after successful patch', async () => {
    mockCoursesTeachersGet.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    mockCoursesPatch.mockResolvedValueOnce({
      data: { id: 'c-101', ownerId: 'newowner@cam.hs.kr', courseState: 'ACTIVE' },
    });
    // audit write 는 실패시킨다. 절대 partial 경로로 흘러가면 안 됨.
    mockWriteAudit.mockRejectedValueOnce(new Error('firestore audit write timeout'));

    const result = await classroomTransferOwnership.run(createRequest());

    expect(result.course.ownerId).toBe('newowner@cam.hs.kr');
    expect(result.addedAsTeacher).toBe(false);
    // teachers.delete (보상) 는 절대 호출되면 안 됨.
    expect(mockCoursesTeachersDelete).not.toHaveBeenCalled();
    // partial audit message 는 남지 않아야 함.
    const partialAudits = mockWriteAudit.mock.calls.filter(
      (call) =>
        call[0]?.action === 'classroom.transfer_owner' &&
        typeof call[0]?.message === 'string' &&
        call[0].message.includes('added_teacher_but_patch_failed'),
    );
    expect(partialAudits).toHaveLength(0);
  });

  // v0.116c F77 시나리오 15: partial 경로가 HttpsError.details 에 rollback 상태를
  // 실어 던진다 → client 는 details 로 「교사가 남아 있을 수 있음」 을 구분 가능.
  it('throws HttpsError with partial details (rollback status) on add-then-patch-fail', async () => {
    const notFound: any = new Error('teacher not in course');
    notFound.response = { status: 404 };
    mockCoursesTeachersGet.mockRejectedValueOnce(notFound);
    mockCoursesTeachersCreate.mockResolvedValueOnce({
      data: { courseId: 'c-101', userId: 'newowner@cam.hs.kr' },
    });
    const patchErr: any = new Error('upstream unavailable');
    patchErr.response = { status: 503 };
    mockCoursesPatch.mockRejectedValueOnce(patchErr);

    try {
      await classroomTransferOwnership.run(createRequest());
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.code).toBe('unavailable');
      expect(err.details).toMatchObject({
        addedTeacherButPatchFailed: true,
        rollback: 'skipped',
        newOwnerEmail: 'newowner@cam.hs.kr',
      });
      expect(err.details.underlying).toContain('upstream unavailable');
    }
  });
});
