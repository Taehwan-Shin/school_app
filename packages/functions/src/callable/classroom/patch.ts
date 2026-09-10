import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { assertTeacherInCourseIfTeacherRole } from '../../authz/classroomTeacherMembership.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient, type ClassroomCourse } from '../../google/classroomClient.js';

export interface ClassroomPatchRequest {
  id: string;
  courseState: 'ACTIVE' | 'ARCHIVED';
}

export interface ClassroomPatchResponse {
  course: ClassroomCourse;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

const COURSE_ID_RE = /^[A-Za-z0-9_-]+$/;

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

export const classroomPatch = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ClassroomPatchResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ClassroomPatchRequest> | undefined;
    const targetId =
      typeof data?.id === 'string' && data.id.trim() ? data.id.trim() : '*';
    const target = targetId === '*' ? '*' : `courses/${targetId}`;

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
        action: 'classroom.write',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'classroom.archive');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.write',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (!data?.id || typeof data.id !== 'string' || !COURSE_ID_RE.test(data.id.trim())) {
        throw new HttpsError('invalid-argument', 'invalid_course_id');
      }
      if (
        !data?.courseState ||
        (data.courseState !== 'ACTIVE' && data.courseState !== 'ARCHIVED')
      ) {
        throw new HttpsError('invalid-argument', 'invalid_course_state');
      }

      const id = data.id.trim();
      const courseState = data.courseState;

      const classroom = getClassroomClient(user.googleAccessToken);
      // v0.115b F72: app-role teacher 는 본인 담당 코스만 아카이브/복구 가능.
      // Google Workspace 관리자이면서 app-role 만 teacher 로 매핑된 계정이
      // 담당 외 코스를 조작하는 경로를 앱 층에서 차단.
      await assertTeacherInCourseIfTeacherRole(classroom, user.role, id);
      const res = await classroom.courses.patch({
        id,
        updateMask: 'courseState',
        requestBody: { courseState },
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.write',
        target: `courses/${id}`,
        request_id: requestId,
        result: 'ok',
        message: `courseState=${courseState}`,
      });

      return { course: res.data };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.write',
        target,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
