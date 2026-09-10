import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogUnresolvedRoleSplitsRequest {
  atMin?: number;
  scanLimit?: number;
}

export interface AuditLogUnresolvedRoleSplitsResponse {
  entries: AuditLogEntryRead[]; // target 별 최신 detected 이벤트 중 unresolved
  scannedDetected: number;
  scannedResolved: number;
  detectedHasMore: boolean;
  resolvedHasMore: boolean;
}

const DEFAULT_SCAN_LIMIT = 500;
const MAX_SCAN_LIMIT = 1000;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

// v0.107c F44: role_split 카드가 client 에서 detected/resolved 두 feed 를 각 50건씩 받아
// reconcile 하면 resolved 가 51번째 이하일 때 미해결로 잘못 표시되는 pagination 결함이
// 있었다. 여기선 server 에서 두 action 을 스캔하고 target 별 최신 상태로 집계해서 unresolved
// 만 반환한다.
//
// 「최신 상태 집계」 규칙:
// - detected: 각 target 의 가장 최근 이벤트만 남긴다 (오래된 재감지는 최신에 흡수).
// - 해소 신호: `system.role_split_resolved` (result=ok) + `users.update_role` (result=ok)
//   두 action 모두 인정. usersUpdateRole 은 Auth + Firestore 를 원자적으로 갱신하므로 성공은
//   자연스러운 해소 신호. denied/error 는 실패한 시도이므로 상태 전이 아님.
// - unresolved = detected.at > (latest 해소 신호.at ?? -Infinity).
//
// 결과에 detected/resolvedHasMore 를 실어서 스캔 window 를 초과했음을 클라이언트에 알린다
// (완벽한 대량 데이터 처리는 배치 endpoint 로 미래에 확장 가능).
export const auditLogUnresolvedRoleSplits = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<AuditLogUnresolvedRoleSplitsResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<AuditLogUnresolvedRoleSplitsRequest> | undefined;

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
        target: '*',
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
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const atMin =
        typeof data?.atMin === 'number' && Number.isFinite(data.atMin) ? data.atMin : undefined;
      const rawScan =
        typeof data?.scanLimit === 'number' && Number.isFinite(data.scanLimit)
          ? Math.floor(data.scanLimit)
          : DEFAULT_SCAN_LIMIT;
      const scanLimit = Math.max(1, Math.min(MAX_SCAN_LIMIT, rawScan));

      // v0.107d F46: 해소 신호는 role_split_resolved + users.update_role 둘 다 (result=ok).
      // updateRole 은 Auth + Firestore 원자적 갱신 → 성공은 자연스러운 해소.
      const [detectedRes, resolvedRes, updateRoleRes] = await Promise.all([
        readAuditEntries({
          limit: scanLimit,
          atMin,
          filterAction: 'system.role_split_detected',
        }),
        readAuditEntries({
          limit: scanLimit,
          atMin,
          filterAction: 'system.role_split_resolved',
          filterResult: 'ok',
        }),
        readAuditEntries({
          limit: scanLimit,
          atMin,
          filterAction: 'users.update_role',
          filterResult: 'ok',
        }),
      ]);

      const latestResolvedAtByTarget = new Map<string, number>();
      const bumpResolved = (target: string, at: number) => {
        const prev = latestResolvedAtByTarget.get(target) ?? -Infinity;
        if (at > prev) latestResolvedAtByTarget.set(target, at);
      };
      for (const e of resolvedRes.entries) bumpResolved(e.target, e.at);
      for (const e of updateRoleRes.entries) bumpResolved(e.target, e.at);

      // detected 를 target 별로 최신만 유지 (readAuditEntries 는 at DESC 반환이므로 첫 등장이 최신).
      const latestDetectedByTarget = new Map<string, AuditLogEntryRead>();
      for (const e of detectedRes.entries) {
        if (!latestDetectedByTarget.has(e.target)) {
          latestDetectedByTarget.set(e.target, e);
        }
      }

      const unresolved: AuditLogEntryRead[] = [];
      for (const e of latestDetectedByTarget.values()) {
        const resolvedAt = latestResolvedAtByTarget.get(e.target);
        if (resolvedAt === undefined || e.at > resolvedAt) {
          unresolved.push(e);
        }
      }
      unresolved.sort((a, b) => b.at - a.at);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'system.role_split_unresolved',
        request_id: requestId,
        result: 'ok',
        message: `unresolved=${unresolved.length} scannedDetected=${detectedRes.entries.length} scannedResolved=${resolvedRes.entries.length} scannedUpdateRole=${updateRoleRes.entries.length}`,
      });

      return {
        entries: unresolved,
        scannedDetected: detectedRes.entries.length,
        // v0.107d F46: resolvedHasMore 는 두 sync 신호 source 중 하나라도 초과했는지.
        scannedResolved: resolvedRes.entries.length + updateRoleRes.entries.length,
        detectedHasMore: detectedRes.nextCursor !== null,
        resolvedHasMore:
          resolvedRes.nextCursor !== null || updateRoleRes.nextCursor !== null,
      };
    } catch (err) {
      const mapped =
        err instanceof HttpsError
          ? err
          : new HttpsError('unknown', (err as Error).message ?? 'unknown');
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'system.role_split_unresolved',
        request_id: requestId,
        result: 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
