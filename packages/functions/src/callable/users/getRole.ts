import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';

export interface UsersGetRoleRequest {
  primaryEmail: string;
}

export interface UsersGetRoleResponse {
  primaryEmail: string;
  uid: string;
  role: Role | null;
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

// v0.100 F17 대응. EditUserRoleDialog 가 대상의 현재 app role 을 알아야 실수 강등을
// 방어할 수 있다. usersList 확장 대신 얇은 조회 callable 로 분리 — 대상 dialog 진입 시에만
// 호출.
export const usersGetRole = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<UsersGetRoleResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<UsersGetRoleRequest> | undefined;
    const targetEmail =
      typeof data?.primaryEmail === 'string' && data.primaryEmail.trim()
        ? data.primaryEmail.trim()
        : '*';

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
        action: 'users.read',
        target: targetEmail,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      // role 조회 자체는 users.read cap 으로 충분. update 는 별도 system.manage_roles.
      assertHasCap(user, 'users.read');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.read',
        target: targetEmail,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (
        !data?.primaryEmail ||
        typeof data.primaryEmail !== 'string' ||
        data.primaryEmail.trim().length === 0
      ) {
        throw new HttpsError('invalid-argument', 'email_required');
      }
      const email = data.primaryEmail.trim();
      const domain = email.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_email_domain');
      }

      const authUser = await getAuth().getUserByEmail(email);
      const claim = (authUser.customClaims as { role?: unknown } | undefined) ?? {};
      const authRole: Role | null =
        claim.role === 'super_admin' || claim.role === 'admin' || claim.role === 'teacher'
          ? (claim.role as Role)
          : null;

      const snap = await getFirestore().doc(`users/${authUser.uid}`).get();
      const docRawRole = snap.exists
        ? (snap.data() as { role?: unknown } | undefined)?.role
        : undefined;
      const docRole: Role | null =
        docRawRole === 'super_admin' || docRawRole === 'admin' || docRawRole === 'teacher'
          ? (docRawRole as Role)
          : null;

      // Auth 가 authz 의 진실. Firestore 는 display cache. 어느 쪽이든 다르면 split 로 기록.
      // v0.100b F19: null 쪽 vs role 쪽도 split — 이전엔 role !== null 만 검사해 놓쳤음.
      if (authRole !== docRole) {
        await writeAudit({
          actor: user.email,
          role: user.role,
          action: 'users.read',
          target: `users/${authUser.uid}`,
          request_id: requestId,
          result: 'error',
          message: `role_split: auth=${authRole ?? 'null'} firestore=${docRole ?? 'null'}`,
        });
      }

      return { primaryEmail: email, uid: authUser.uid, role: authRole };
    } catch (err) {
      const mapped =
        err instanceof HttpsError
          ? err
          : new HttpsError('unknown', (err as Error).message ?? 'unknown');
      throw mapped;
    }
  },
);
