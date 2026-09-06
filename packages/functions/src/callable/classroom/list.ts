import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient, type ClassroomCourse } from '../../google/classroomClient.js';

export interface ClassroomListRequest {}

export interface ClassroomListResponse {
  courses: ClassroomCourse[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

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

export const classroomList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ClassroomListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();

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
        action: 'classroom.read',
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'classroom.read');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.read',
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const classroom = getClassroomClient(user.googleAccessToken);
      const results: ClassroomCourse[] = [];
      let pageToken: string | undefined;
      do {
        const res = await classroom.courses.list({ pageSize: 100, pageToken });
        results.push(...(res.data.courses ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.read',
        target: '*',
        request_id: requestId,
        result: 'ok',
        message: `listed ${results.length} classroom courses`,
      });

      return { courses: results };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.read',
        target: '*',
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
