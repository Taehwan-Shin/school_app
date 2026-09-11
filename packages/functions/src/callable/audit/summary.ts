import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { AUDIT_ACTIONS } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, countAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogSummaryRequest {
  atMin?: number;
  atMax?: number;
  // v0.126: sample-scope breakdown (기본) 대신 각 action 을 Firestore
  // `count()` aggregation 으로 정확히 세어 전체 count 를 반환. AUDIT_ACTIONS
  // 28 개를 parallel 조회 → 최대 28 reads. 클라이언트는 sampleTruncated=true
  // 일 때만 toggle 로 요청 (평상시 breakdown 은 sample 로 충분히 빠름).
  exact?: boolean;
}

export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  snapshotAt: number; // query 상한 (effectiveAtMax)
  generatedAt: number; // callable 실행 시각 (Date.now())
  // v0.120: 대시보드 위젯 — 지정 window 내 action 별 카운트. sampleTruncated=true
  // 이면 sampleSize (=SAMPLE_LIMIT) 만 대상. count > sampleSize 인 경우 breakdown
  // 은 최신 sampleSize 건 기준이며 전체와 다를 수 있음. sample 순서는 at DESC.
  actionCounts: Record<string, number>;
  sampleSize: number;
  sampleTruncated: boolean;
  // v0.126: `exact=true` 요청 시 AUDIT_ACTIONS 각각을 count() 로 조회한 정확
  // 값. 0 인 action 은 제외 (렌더 시 sample-scope 와 동일한 정렬 · 표시).
  // 미요청 시 undefined — 클라이언트는 exactActionCounts ?? actionCounts 로
  // 우선순위 렌더 + truncated 배너 숨김.
  exactActionCounts?: Record<string, number>;
}

const PREVIEW_LIMIT = 5;
// v0.120: action breakdown sample 상한. `countAuditEntries` 는 정확 count 를
// 돌려주지만 breakdown 은 개별 doc 을 fetch 해서 in-memory grouping 이라 상한 필요.
const SAMPLE_LIMIT = 500;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const auditLogSummary = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<AuditLogSummaryResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<AuditLogSummaryRequest> | undefined;

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
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'audit.read');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const atMin =
        typeof data?.atMin === 'number' && Number.isFinite(data.atMin) && data.atMin > 0
          ? data.atMin
          : undefined;
      const clientAtMax =
        typeof data?.atMax === 'number' && Number.isFinite(data.atMax) && data.atMax > 0
          ? data.atMax
          : undefined;
      const exact = data?.exact === true;

      const generatedAt = Date.now();
      const effectiveAtMax = clientAtMax !== undefined ? Math.min(clientAtMax, generatedAt) : generatedAt;
      const snapshotAt = effectiveAtMax;

      // v0.120: preview + count + sample (breakdown 용) 을 동시에 조회.
      // v0.126: exact=true 이면 각 AUDIT_ACTIONS 를 count() 로 추가 병렬 조회.
      const [count, listResult, sampleResult, exactCountsList] = await Promise.all([
        countAuditEntries({ atMin, atMax: effectiveAtMax }),
        readAuditEntries({ limit: PREVIEW_LIMIT, atMin, atMax: effectiveAtMax }),
        readAuditEntries({ limit: SAMPLE_LIMIT, atMin, atMax: effectiveAtMax }),
        exact
          ? Promise.all(
              AUDIT_ACTIONS.map(async (action) => ({
                action,
                count: await countAuditEntries({
                  atMin,
                  atMax: effectiveAtMax,
                  filterAction: action,
                }),
              })),
            )
          : Promise.resolve(null),
      ]);

      // sample 에서 action 별 카운트 계산. sample 은 at DESC 로 최신 SAMPLE_LIMIT 건.
      const actionCounts: Record<string, number> = {};
      for (const entry of sampleResult.entries) {
        actionCounts[entry.action] = (actionCounts[entry.action] ?? 0) + 1;
      }
      const sampleSize = sampleResult.entries.length;
      // sampleTruncated = true 이면 전체 count 가 sample 크기를 넘어서 breakdown
      // 이 최신 sampleSize 만 대상. 정확 count 는 별도 `count` 필드.
      const sampleTruncated = count > sampleSize;

      // v0.126: exactCountsList → { action: count } 로 변환. 0 인 action 제외.
      let exactActionCounts: Record<string, number> | undefined;
      if (exactCountsList) {
        exactActionCounts = {};
        for (const { action, count: c } of exactCountsList) {
          if (c > 0) exactActionCounts[action] = c;
        }
      }

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'ok',
        message: `summarized ${count} entries (sample=${sampleSize}, truncated=${sampleTruncated}${exact ? ', exact=on' : ''}) [snapshot=${new Date(snapshotAt).toISOString()}, generated=${new Date(generatedAt).toISOString()}]`,
      });

      return {
        count,
        entries: listResult.entries,
        snapshotAt,
        generatedAt,
        actionCounts,
        sampleSize,
        sampleTruncated,
        ...(exactActionCounts !== undefined ? { exactActionCounts } : {}),
      };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'error',
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
