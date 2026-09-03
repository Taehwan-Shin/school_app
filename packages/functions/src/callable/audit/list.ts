import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogListRequest {
  limit?: number;
  before?: number;
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}

export interface AuditLogListResponse {
  entries: AuditLogEntryRead[];
  nextCursor: number | null;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const auditLogList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<AuditLogListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<AuditLogListRequest> | undefined;

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
      const rawLimit =
        typeof data?.limit === 'number' && Number.isFinite(data.limit)
          ? data.limit
          : DEFAULT_LIMIT;
      const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)));
      const before =
        typeof data?.before === 'number' && Number.isFinite(data.before) && data.before > 0
          ? data.before
          : undefined;
      const atMin =
        typeof data?.atMin === 'number' && Number.isFinite(data.atMin) && data.atMin > 0
          ? data.atMin
          : undefined;
      const atMax =
        typeof data?.atMax === 'number' && Number.isFinite(data.atMax) && data.atMax > 0
          ? data.atMax
          : undefined;

      const filterActor =
        typeof data?.filterActor === 'string' && data.filterActor.length > 0
          ? data.filterActor
          : undefined;
      const filterTarget =
        typeof data?.filterTarget === 'string' && data.filterTarget.length > 0
          ? data.filterTarget
          : undefined;
      const filterResult =
        data?.filterResult === 'ok' || data?.filterResult === 'error' || data?.filterResult === 'denied'
          ? data.filterResult
          : undefined;

      const result = await readAuditEntries({
        limit,
        before,
        atMin,
        atMax,
        filterActor,
        filterTarget,
        filterResult,
      });

      const filters = [];
      if (filterActor) filters.push(`actor=${filterActor}`);
      if (filterTarget) filters.push(`target=${filterTarget}`);
      if (filterResult) filters.push(`result=${filterResult}`);
      if (atMin) filters.push(`atMin=${new Date(atMin).toISOString()}`);
      if (atMax) filters.push(`atMax=${new Date(atMax).toISOString()}`);
      const filterStr = filters.length > 0 ? ` [${filters.join(', ')}]` : '';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'ok',
        message: `read ${result.entries.length} entries (limit ${limit}${before ? `, before ${before}` : ''})${filterStr}`,
      });

      return result;
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'error',
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
