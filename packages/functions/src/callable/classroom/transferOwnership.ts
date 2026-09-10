import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient, type ClassroomCourse } from '../../google/classroomClient.js';

export interface ClassroomTransferOwnershipRequest {
  courseId: string;
  newOwnerEmail: string;
}

export interface ClassroomTransferOwnershipResponse {
  course: ClassroomCourse;
  addedAsTeacher: boolean;
}

// v0.116: patch(ownerId) 는 반드시 새 owner 가 course teacher 여야 하므로
// rosters 스코프도 함께 요구 (사전 teachers.create fallback 대비).
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.rosters',
] as const;

const COURSE_ID_RE = /^[A-Za-z0-9_-]+$/;
// 원본 Apps Script 가 newOwnerEmail 을 sheet 셀에서 받는 것을 그대로 이관.
// Google Workspace 이메일 형식 (@domain 필수) — Directory API 가 최종 판정.
const EMAIL_RE = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  const status: number | undefined =
    (err as any)?.response?.status ??
    (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
  const msg = (err as Error).message ?? 'unknown';
  if (status === 401 || status === 403) {
    return new HttpsError('permission-denied', `google_upstream_denied: ${msg}`);
  }
  if (status === 404) {
    return new HttpsError('not-found', `google_upstream_not_found: ${msg}`);
  }
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
  }
  return new HttpsError('unknown', msg);
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const classroomTransferOwnership = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ClassroomTransferOwnershipResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ClassroomTransferOwnershipRequest> | undefined;

    const courseIdPart =
      typeof data?.courseId === 'string' && data.courseId.trim() ? data.courseId.trim() : '*';
    const target = courseIdPart === '*' ? '*' : `courses/${courseIdPart}`;

    let user;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      const actorEmail = (request.auth?.token?.email as string | undefined) ?? 'unknown';
      const claimRole = request.auth?.token?.role;
      const actorRole: Role | 'unknown' =
        claimRole === 'super_admin' || claimRole === 'admin' || claimRole === 'teacher'
          ? (claimRole as Role)
          : 'unknown';
      await writeAudit({
        actor: actorEmail,
        role: actorRole,
        action: 'classroom.transfer_owner',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      // super_admin/admin 만 통과. teacher role 은 이 캡을 갖지 않음
      // (roleCapabilities.ts 에서 super_admin/admin 전용).
      assertHasCap(user, 'classroom.transfer_owner');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.transfer_owner',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (
        !data?.courseId ||
        typeof data.courseId !== 'string' ||
        !COURSE_ID_RE.test(data.courseId.trim())
      ) {
        throw new HttpsError('invalid-argument', 'invalid_course_id');
      }
      if (
        !data?.newOwnerEmail ||
        typeof data.newOwnerEmail !== 'string' ||
        !EMAIL_RE.test(data.newOwnerEmail.trim())
      ) {
        throw new HttpsError('invalid-argument', 'invalid_new_owner_email');
      }

      const courseId = data.courseId.trim();
      const newOwnerEmail = data.newOwnerEmail.trim();

      const classroom = getClassroomClient(user.googleAccessToken);

      // Google Classroom API 는 새 owner 가 이미 course teacher 여야 patch 허용.
      // 원본 Apps Script 도 미가입 시 teacher 로 먼저 추가. teachers.get 404 →
      // teachers.create 로 fallback.
      let addedAsTeacher = false;
      try {
        await classroom.courses.teachers.get({ courseId, userId: newOwnerEmail });
      } catch (err) {
        const status: number | undefined =
          (err as { response?: { status?: number }; code?: number })?.response?.status ??
          (typeof (err as { code?: number })?.code === 'number'
            ? (err as { code: number }).code
            : undefined);
        if (status !== 404) throw err;
        // 아직 teacher 아님 → 사전 추가. 이 단계 실패는 permission-denied/not-found 로 매핑
        // (mapUpstreamError). audit 은 catch 블록에서 통합 기록.
        await classroom.courses.teachers.create({
          courseId,
          requestBody: { userId: newOwnerEmail },
        });
        addedAsTeacher = true;
      }

      const res = await classroom.courses.patch({
        id: courseId,
        updateMask: 'ownerId',
        requestBody: { ownerId: newOwnerEmail },
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.transfer_owner',
        target: `courses/${courseId}`,
        request_id: requestId,
        result: 'ok',
        message: `newOwner=${newOwnerEmail} addedAsTeacher=${addedAsTeacher}`,
      });

      return { course: res.data, addedAsTeacher };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.transfer_owner',
        target,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
