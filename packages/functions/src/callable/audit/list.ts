import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogListRequest {
  limit?: number;
  before?: number;
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

      const result = await readAuditEntries({ limit, before });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'ok',
        message: `read ${result.entries.length} entries (limit ${limit}${before ? `, before ${before}` : ''})`,
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
