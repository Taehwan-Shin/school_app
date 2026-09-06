import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient } from '../../google/classroomClient.js';

export interface ClassroomTeachersDeleteRequest {
  courseId: string;
  userId: string;
}

export interface ClassroomTeachersDeleteResponse {
  ok: true;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.rosters',
] as const;

const COURSE_ID_RE = /^[A-Za-z0-9_-]+$/;
const USER_ID_RE = /^[A-Za-z0-9._@+\-]+$/;

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

export const classroomTeachersDelete = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ClassroomTeachersDeleteResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ClassroomTeachersDeleteRequest> | undefined;

    const courseIdPart =
      typeof data?.courseId === 'string' && data.courseId.trim() ? data.courseId.trim() : '*';
    const userIdPart =
      typeof data?.userId === 'string' && data.userId.trim() ? data.userId.trim() : '*';
    const target =
      courseIdPart === '*' && userIdPart === '*'
        ? '*'
        : `courses/${courseIdPart}/teachers/${userIdPart}`;

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
        action: 'classroom.teachers.delete',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'classroom.write');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.teachers.delete',
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
        !data?.userId ||
        typeof data.userId !== 'string' ||
        !USER_ID_RE.test(data.userId.trim())
      ) {
        throw new HttpsError('invalid-argument', 'invalid_user_id');
      }

      const courseId = data.courseId.trim();
      const userId = data.userId.trim();

      const classroom = getClassroomClient(user.googleAccessToken);
      await classroom.courses.teachers.delete({
        courseId,
        userId,
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.teachers.delete',
        target: `courses/${courseId}/teachers/${userId}`,
        request_id: requestId,
        result: 'ok',
        message: `userId=${userId}`,
      });

      return { ok: true };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.teachers.delete',
        target,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });

      throw mapped;
    }
  },
);
