import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';
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

// v0.116b F75: partial-fail 경로가 이미 감사를 기록했음을 외곽 catch 에 신호.
const ALREADY_AUDITED = Symbol('transfer_owner_already_audited');
type AuditedHttpsError = HttpsError & { [ALREADY_AUDITED]?: true };

// v0.116d F78: audit_log 저장은 accountability 규율상 반드시 durable 이어야
// 하지만 Firestore 쓰기는 드물게 실패 (network glitch · quota · outage). 재시도
// 3 회 (지수 백오프) → 최종 실패 시 Cloud Logging 에 severity=ERROR + 감사 payload
// 를 그대로 남긴다. Cloud Logging 은 로그 라우팅 sink 로 BigQuery/GCS 로 영구
// 보관 가능하므로, 향후 request_id 기반 intent/outbox 로 마이그레이션 시에도
// 재구성 가능. 이 helper 는 throw 하지 않는다 — 호출자가 patch 결과나 partial
// throw 로 흐름을 결정하도록.
type AuditEntry = Parameters<typeof writeAudit>[0];
async function writeAuditWithBackup(entry: AuditEntry, requestId: string): Promise<void> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await writeAudit(entry);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }
  // Cloud Logging 구조 로그 (Cloud Functions 자동 수집).
  console.error(
    JSON.stringify({
      severity: 'ERROR',
      message: 'classroom_transfer_owner_audit_write_failed',
      request_id: requestId,
      audit_entry: entry,
      final_error: (lastErr as Error)?.message ?? String(lastErr),
    }),
  );
}

function extractStatus(err: unknown): number | undefined {
  return (
    (err as { response?: { status?: number }; code?: number })?.response?.status ??
    (typeof (err as { code?: number })?.code === 'number'
      ? (err as { code: number }).code
      : undefined)
  );
}

function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  const status = extractStatus(err);
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

      // v0.116b F74: Google Classroom Courses.patch(ownerId) 는 새 owner 가 같은
      // Workspace 도메인 사용자여야 성공. 서버 층에서 앱의 ALLOWED_DOMAIN 을 미리
      // 강제해 upstream 실패를 사전 컷 + 감사 로그를 깨끗하게.
      const domain = newOwnerEmail.split('@')[1]?.toLowerCase() ?? '';
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_new_owner_domain');
      }

      const classroom = getClassroomClient(user.googleAccessToken);

      // Google Classroom API 는 새 owner 가 이미 course teacher 여야 patch 허용.
      // 원본 Apps Script 도 미가입 시 teacher 로 먼저 추가. teachers.get 404 →
      // teachers.create 로 fallback.
      let addedAsTeacher = false;
      try {
        await classroom.courses.teachers.get({ courseId, userId: newOwnerEmail });
      } catch (err) {
        if (extractStatus(err) !== 404) throw err;
        // 아직 teacher 아님 → 사전 추가. 이 단계 실패는 mapUpstreamError 로 매핑
        // (외곽 catch). audit 은 catch 블록에서 통합 기록.
        await classroom.courses.teachers.create({
          courseId,
          requestBody: { userId: newOwnerEmail },
        });
        addedAsTeacher = true;
      }

      // v0.116b F75 / v0.116c F76: patch 호출만 좁게 try 로 감싸서 orphan teacher
      // 를 처리한다. 성공 감사와 반환은 try 밖으로 빼내, `patch 성공 → writeAudit
      // 실패` 가 partial 경로로 오분류되는 것을 막는다.
      // - 확정 client-error (4xx, 429 제외): 보상 teachers.delete 시도.
      // - 429/5xx/timeout: 실 상태 불확실 → 보상 skip, 감사에 명시.
      let patchRes: { data: ClassroomCourse };
      try {
        patchRes = await classroom.courses.patch({
          id: courseId,
          updateMask: 'ownerId',
          requestBody: { ownerId: newOwnerEmail },
        });
      } catch (patchErr) {
        if (!addedAsTeacher) throw patchErr;

        const patchStatus = extractStatus(patchErr);
        const mapped = mapUpstreamError(patchErr);
        const isDenied =
          mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';

        let rollback: 'ok' | 'failed' | 'skipped' = 'skipped';
        // 확정 client error 만 보상 삭제. 429 는 실 상태가 5xx 와 같이 불확실.
        if (
          typeof patchStatus === 'number' &&
          patchStatus >= 400 &&
          patchStatus < 500 &&
          patchStatus !== 429
        ) {
          try {
            await classroom.courses.teachers.delete({ courseId, userId: newOwnerEmail });
            rollback = 'ok';
          } catch {
            rollback = 'failed';
          }
        }

        // v0.116d F79: partial HttpsError 를 audit 호출 앞에 미리 구성한다.
        // 이 순서로 audit 실패가 던져진 error 를 대체하지 않고 details 를 온전히
        // 보존한다.
        const partial = new HttpsError(
          mapped.code,
          `added_teacher_but_patch_failed:${mapped.message}`,
          {
            addedTeacherButPatchFailed: true,
            rollback,
            newOwnerEmail,
            underlying: mapped.message,
          },
        ) as AuditedHttpsError;
        partial[ALREADY_AUDITED] = true;

        // F78/F79: durable audit (retry + Cloud Logging fallback). helper 는 절대
        // throw 하지 않아, audit 결과와 무관하게 details 를 담은 partial 만 propagate.
        await writeAuditWithBackup(
          {
            actor: user.email,
            role: user.role,
            action: 'classroom.transfer_owner',
            target: `courses/${courseId}`,
            request_id: requestId,
            result: isDenied ? 'denied' : 'error',
            message: `added_teacher_but_patch_failed:${mapped.message} rollback=${rollback}`,
          },
          requestId,
        );
        throw partial;
      }

      // v0.116c F76 / v0.116d F78: patch 는 이미 성공. audit 은 helper 가 3 회
      // 재시도 후 실패 시 Cloud Logging fallback — 어느 경우든 patch 결과를 그대로
      // 반환한다. audit 실패로 UI 를 뒤집으면 재시도 → double transfer 위험.
      await writeAuditWithBackup(
        {
          actor: user.email,
          role: user.role,
          action: 'classroom.transfer_owner',
          target: `courses/${courseId}`,
          request_id: requestId,
          result: 'ok',
          message: `newOwner=${newOwnerEmail} addedAsTeacher=${addedAsTeacher}`,
        },
        requestId,
      );

      return { course: patchRes.data, addedAsTeacher };
    } catch (err) {
      // F75: partial-fail 경로가 이미 상세 감사를 기록했으면 외곽에서 중복 기록 안 함.
      if ((err as AuditedHttpsError)?.[ALREADY_AUDITED]) {
        throw err;
      }
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      // v0.116d F78: 실패 경로도 audit 을 놓치지 않도록 retry + Cloud Logging.
      await writeAuditWithBackup(
        {
          actor: user.email,
          role: user.role,
          action: 'classroom.transfer_owner',
          target,
          request_id: requestId,
          result: isDenied ? 'denied' : 'error',
          message: mapped.message,
        },
        requestId,
      );
      throw mapped;
    }
  },
);
