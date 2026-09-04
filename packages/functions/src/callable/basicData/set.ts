import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Role, BasicDataGradeClass } from '@school-app/shared';
import { isValidBasicDataYear } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';

export interface BasicDataSetRequest {
  year: number;
  grades: BasicDataGradeClass[];
  departments?: string[];
}

export interface BasicDataSetResponse {
  year: number;
  updatedAt: number;
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const basicDataSet = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<BasicDataSetResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<BasicDataSetRequest> | undefined;

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
        action: 'basic_data.write',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'basic_data.write');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.write',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const basicData = {
        year: data?.year,
        grades: data?.grades,
        ...(data?.departments !== undefined ? { departments: data.departments } : {}),
      };

      if (!isValidBasicDataYear(basicData)) {
        throw new HttpsError('invalid-argument', 'invalid_basic_data');
      }

      const { year, grades, departments } = basicData;

      const db = getFirestore();
      await db
        .collection('basic_data')
        .doc(String(year))
        .set(
          {
            year,
            grades,
            ...(departments !== undefined ? { departments } : {}),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: user.email,
          },
          { merge: false },
        );

      const now = Date.now();

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.write',
        target,
        request_id: requestId,
        result: 'ok',
        message: `set basic_data for year ${year} with ${grades.length} grades`,
      });

      return {
        year,
        updatedAt: now,
      };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'basic_data.write',
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
