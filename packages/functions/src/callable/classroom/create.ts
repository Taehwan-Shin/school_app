import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient, type ClassroomCourse } from '../../google/classroomClient.js';

export interface ClassroomCreateRequest {
  name: string;
  section?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  courseState?: 'PROVISIONED' | 'ACTIVE';
}

export interface ClassroomCreateResponse {
  course: ClassroomCourse;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

const NAME_RE = /^.{1,300}$/;
const OWNER_ID_RE = /^(me|[A-Za-z0-9._@+\-]+)$/;

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

export const classroomCreate = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ClassroomCreateResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ClassroomCreateRequest> | undefined;
    const target = '*';

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
        action: 'classroom.create',
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
        action: 'classroom.create',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (!data?.name || typeof data.name !== 'string') {
        throw new HttpsError('invalid-argument', 'invalid_name');
      }
      const name = data.name.trim();
      if (!NAME_RE.test(name)) {
        throw new HttpsError('invalid-argument', 'invalid_name');
      }

      const rawOwnerId = data.ownerId;
      const ownerId =
        rawOwnerId === undefined || rawOwnerId === null
          ? 'me'
          : (typeof rawOwnerId === 'string' ? rawOwnerId.trim() : '');
      if (!OWNER_ID_RE.test(ownerId)) {
        throw new HttpsError('invalid-argument', 'invalid_owner_id');
      }

      const courseState = data.courseState ?? 'PROVISIONED';
      if (courseState !== 'PROVISIONED' && courseState !== 'ACTIVE') {
        throw new HttpsError('invalid-argument', 'invalid_course_state');
      }

      const requestBody: {
        name: string;
        section?: string;
        description?: string;
        room?: string;
        ownerId: string;
        courseState?: string;
      } = {
        name,
        ownerId,
        courseState,
      };

      if (typeof data.section === 'string' && data.section.trim()) {
        requestBody.section = data.section.trim();
      }
      if (typeof data.description === 'string' && data.description.trim()) {
        requestBody.description = data.description.trim();
      }
      if (typeof data.room === 'string' && data.room.trim()) {
        requestBody.room = data.room.trim();
      }

      const classroom = getClassroomClient(user.googleAccessToken);
      const res = await classroom.courses.create({ requestBody });

      const createdId = res.data?.id;
      const successTarget = createdId ? `courses/${createdId}` : '*';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.create',
        target: successTarget,
        request_id: requestId,
        result: 'ok',
        message: `name=${name}`,
      });

      return { course: res.data };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.create',
        target,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
