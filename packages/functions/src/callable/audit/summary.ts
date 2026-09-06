import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, countAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogSummaryRequest {
  atMin?: number;
  atMax?: number;
}

export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  countedAt: number; // ms since epoch, snapshot boundary
}

const PREVIEW_LIMIT = 5;

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

      const countedAt = Date.now();
      const effectiveAtMax = clientAtMax !== undefined ? Math.min(clientAtMax, countedAt) : countedAt;

      const [count, listResult] = await Promise.all([
        countAuditEntries({ atMin, atMax: effectiveAtMax }),
        readAuditEntries({ limit: PREVIEW_LIMIT, atMin, atMax: effectiveAtMax }),
      ]);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'ok',
        message: `summarized ${count} entries [snapshot=${new Date(countedAt).toISOString()}]`,
      });

      return {
        count,
        entries: listResult.entries,
        countedAt,
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
