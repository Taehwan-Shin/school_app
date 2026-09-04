import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';

export interface BasicDataListYearsResponse {
  years: number[];
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const basicDataListYears = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<BasicDataListYearsResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const target = 'basic_data/*';

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
        action: 'basic_data.read',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'basic_data.read');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.read',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const db = getFirestore();
      const docRefs = await db.collection('basic_data').listDocuments();
      const years: number[] = [];

      for (const ref of docRefs) {
        const parsed = Number.parseInt(ref.id, 10);
        if (Number.isInteger(parsed) && String(parsed) === ref.id) {
          years.push(parsed);
        }
      }

      years.sort((a, b) => b - a);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.read',
        target,
        request_id: requestId,
        result: 'ok',
        message: `listed ${years.length} years`,
      });

      return { years };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.read',
        target,
        request_id: requestId,
        result: 'error',
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
