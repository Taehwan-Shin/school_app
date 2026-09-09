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
      let role: Role | null =
        claim.role === 'super_admin' || claim.role === 'admin' || claim.role === 'teacher'
          ? (claim.role as Role)
          : null;

      // Firestore 문서가 있으면 그 값을 우선. Auth claim 과 다르면 Auth 를 신뢰 (감사에 노출).
      const snap = await getFirestore().doc(`users/${authUser.uid}`).get();
      if (snap.exists) {
        const docRole = (snap.data() as { role?: unknown } | undefined)?.role;
        if (docRole === 'super_admin' || docRole === 'admin' || docRole === 'teacher') {
          if (role !== null && role !== docRole) {
            // 두 저장소 불일치를 감사 로그로 노출 — F16 실패 이후 잔재 감지.
            await writeAudit({
              actor: user.email,
              role: user.role,
              action: 'users.read',
              target: `users/${authUser.uid}`,
              request_id: requestId,
              result: 'error',
              message: `role_split: auth=${role} firestore=${docRole}`,
            });
          }
          if (role === null) {
            role = docRole as Role;
          }
        }
      }

      return { primaryEmail: email, uid: authUser.uid, role };
    } catch (err) {
      const mapped =
        err instanceof HttpsError
          ? err
          : new HttpsError('unknown', (err as Error).message ?? 'unknown');
      throw mapped;
    }
  },
);
