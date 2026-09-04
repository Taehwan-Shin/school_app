import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role, BasicDataYear } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';

export interface BasicDataGetRequest {
  year: number;
}

export interface BasicDataGetResponse {
  data: BasicDataYear | null;
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const basicDataGet = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<BasicDataGetResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<BasicDataGetRequest> | undefined;

    const target =
      typeof data?.year === 'number' && Number.isFinite(data.year)
        ? `basic_data/${data.year}`
        : 'basic_data/*';

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
      const rawYear = data?.year;
      if (
        typeof rawYear !== 'number' ||
        !Number.isInteger(rawYear) ||
        rawYear < 1900 ||
        rawYear > 2200
      ) {
        throw new HttpsError('invalid-argument', 'invalid_year');
      }
      const year = rawYear;

      const db = getFirestore();
      const docSnap = await db.collection('basic_data').doc(String(year)).get();

      if (!docSnap.exists) {
        await writeAudit({
          actor: user.email,
          role: user.role,
          action: 'basic_data.read',
          target,
          request_id: requestId,
          result: 'ok',
          message: `read basic_data for year ${year} (not found)`,
        });
        return { data: null };
      }

      const docData = docSnap.data();
      let updatedAt: number | undefined;
      if (docData?.updatedAt) {
        if (typeof docData.updatedAt.toMillis === 'function') {
          updatedAt = docData.updatedAt.toMillis();
        } else if (typeof docData.updatedAt === 'number') {
          updatedAt = docData.updatedAt;
        } else if (docData.updatedAt instanceof Date) {
          updatedAt = docData.updatedAt.getTime();
        }
      }

      const basicData: BasicDataYear = {
        year: typeof docData?.year === 'number' ? docData.year : year,
        grades: Array.isArray(docData?.grades) ? docData.grades : [],
        ...(updatedAt !== undefined ? { updatedAt } : {}),
        ...(typeof docData?.updatedBy === 'string' ? { updatedBy: docData.updatedBy } : {}),
      };

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.read',
        target,
        request_id: requestId,
        result: 'ok',
        message: `read basic_data for year ${year} (exists)`,
      });

      return { data: basicData };
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
