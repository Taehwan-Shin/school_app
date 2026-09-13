import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { assertTeacherInCourseIfTeacherRole } from '../../authz/classroomTeacherMembership.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient, type ClassroomCourse } from '../../google/classroomClient.js';

export interface ClassroomPatchRequest {
  id: string;
  courseState?: 'ACTIVE' | 'ARCHIVED';
  name?: string;
  section?: string;
}

export interface ClassroomPatchResponse {
  course: ClassroomCourse;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

const COURSE_ID_RE = /^[A-Za-z0-9_-]+$/;
// v0.134: Google Classroom Courses.name/section 은 255자 상한 (Directory Course
// 스키마 참조). trim 후 검증.
const NAME_MAX = 255;
const SECTION_MAX = 255;

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
      // v0.134: courseState 변경은 archive cap 유지 (기존 계약). name/section 만
      // 변경하는 요청도 최소한 write cap 은 필요. courseState 요청이 오면 archive
      // cap 을 우선 assert 하여 기존 error message ('classroom.archive') 를 보존.
      if (data?.courseState !== undefined) {
        assertHasCap(user, 'classroom.archive');
      }
      if (data?.name !== undefined || data?.section !== undefined) {
        assertHasCap(user, 'classroom.write');
      }
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

      // v0.134: 요청에 실제 변경 필드가 하나라도 있어야 한다. courseState/name/section
      // 각각 optional 이며 조합 가능. 하나도 없으면 400.
      const hasCourseState = data?.courseState !== undefined;
      const hasName = data?.name !== undefined;
      const hasSection = data?.section !== undefined;
      if (!hasCourseState && !hasName && !hasSection) {
        throw new HttpsError('invalid-argument', 'no_fields_to_update');
      }

      if (hasCourseState) {
        if (data.courseState !== 'ACTIVE' && data.courseState !== 'ARCHIVED') {
          throw new HttpsError('invalid-argument', 'invalid_course_state');
        }
      }

      let trimmedName: string | undefined;
      if (hasName) {
        if (typeof data.name !== 'string') {
          throw new HttpsError('invalid-argument', 'invalid_name');
        }
        trimmedName = data.name.trim();
        if (trimmedName.length === 0) {
          throw new HttpsError('invalid-argument', 'invalid_name');
        }
        if (trimmedName.length > NAME_MAX) {
          throw new HttpsError('invalid-argument', 'name_too_long');
        }
      }

      let trimmedSection: string | undefined;
      if (hasSection) {
        if (typeof data.section !== 'string') {
          throw new HttpsError('invalid-argument', 'invalid_section');
        }
        trimmedSection = data.section.trim();
        if (trimmedSection.length > SECTION_MAX) {
          throw new HttpsError('invalid-argument', 'section_too_long');
        }
      }

      const id = data.id.trim();

      const classroom = getClassroomClient(user.googleAccessToken);
      // v0.115b F72: app-role teacher 는 본인 담당 코스만 아카이브/복구/이름 변경 가능.
      // Google Workspace 관리자이면서 app-role 만 teacher 로 매핑된 계정이
      // 담당 외 코스를 조작하는 경로를 앱 층에서 차단.
      await assertTeacherInCourseIfTeacherRole(classroom, user.role, id);

      const requestBody: {
        courseState?: 'ACTIVE' | 'ARCHIVED';
        name?: string;
        section?: string;
      } = {};
      const maskParts: string[] = [];
      const auditParts: string[] = [];

      if (hasCourseState) {
        requestBody.courseState = data.courseState as 'ACTIVE' | 'ARCHIVED';
        maskParts.push('courseState');
        auditParts.push(`courseState=${data.courseState}`);
      }
      if (hasName && trimmedName !== undefined) {
        requestBody.name = trimmedName;
        maskParts.push('name');
        auditParts.push(`name=${JSON.stringify(trimmedName)}`);
      }
      if (hasSection && trimmedSection !== undefined) {
        requestBody.section = trimmedSection;
        maskParts.push('section');
        auditParts.push(`section=${JSON.stringify(trimmedSection)}`);
      }

      const res = await classroom.courses.patch({
        id,
        updateMask: maskParts.join(','),
        requestBody,
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'classroom.write',
        target: `courses/${id}`,
        request_id: requestId,
        result: 'ok',
        message: auditParts.join(';'),
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
