import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';

export interface UsersUpdateRoleRequest {
  primaryEmail: string;
  role: Role;
}

export interface UsersUpdateRoleResponse {
  primaryEmail: string;
  uid: string;
  role: Role;
}

const VALID_ROLES: readonly Role[] = ['super_admin', 'admin', 'teacher'];

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const usersUpdateRole = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<UsersUpdateRoleResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<UsersUpdateRoleRequest> | undefined;
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
        action: 'users.update_role',
        target: targetEmail,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      // `system.manage_roles` 는 super_admin 만 보유 (roleCapabilities.ts).
      // OAuth scope 는 필요 없다 — Firebase Admin SDK 가 runtime SA 자격으로 실행.
      assertHasCap(user, 'system.manage_roles');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.update_role',
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

      const newRole = data.role;
      if (typeof newRole !== 'string' || !VALID_ROLES.includes(newRole as Role)) {
        throw new HttpsError('invalid-argument', 'invalid_role');
      }

      // 본인 강등 방지 — super_admin 이 실수로 자기 role 을 낮추면 시스템 관리 능력이 사라진다.
      // 동일 role 로 재설정하는 no-op 은 허용.
      if (user.email.toLowerCase() === email.toLowerCase() && newRole !== 'super_admin') {
        throw new HttpsError('failed-precondition', 'cannot_demote_self');
      }

      const authUser = await getAuth().getUserByEmail(email);
      // F15: 기존 custom claims 를 그대로 보존하고 role 만 갱신 (setCustomUserClaims 는 전체 덮어씀).
      const existingClaims =
        (authUser.customClaims as Record<string, unknown> | undefined) ?? {};
      const previousRole =
        typeof existingClaims.role === 'string' ? (existingClaims.role as string) : undefined;

      // Auth 를 먼저 갱신 (실제 authz 소스는 ID token role claim). Firestore 는 UI display 겸.
      await getAuth().setCustomUserClaims(authUser.uid, {
        ...existingClaims,
        role: newRole,
      });

      // F16: Firestore 쓰기가 실패하면 Auth claim 을 이전 상태로 롤백해서 두 저장소 정합 유지.
      // F18: email 필드가 users/<uid> 문서 부재 시에도 존재하도록 병기 저장 — 다른 callable
      // (예: users/update.ts) 의 email 기반 조회 (`where('email', '==', ...)` 등) 를 깨지 않는다.
      try {
        await getFirestore()
          .doc(`users/${authUser.uid}`)
          .set(
            {
              role: newRole,
              email,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      } catch (firestoreErr) {
        try {
          await getAuth().setCustomUserClaims(authUser.uid, {
            ...existingClaims,
            ...(previousRole !== undefined ? { role: previousRole } : {}),
          });
        } catch (rollbackErr) {
          throw new HttpsError(
            'internal',
            `role_write_partial_failure: firestore=${(firestoreErr as Error).message} rollback=${(rollbackErr as Error).message}`,
          );
        }
        throw new HttpsError(
          'unavailable',
          `role_firestore_failed_rolled_back: ${(firestoreErr as Error).message}`,
        );
      }

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.update_role',
        target: `users/${authUser.uid}`,
        request_id: requestId,
        result: 'ok',
        message: `role=${newRole} email=${email}`,
      });

      return { primaryEmail: email, uid: authUser.uid, role: newRole };
    } catch (err) {
      const mapped =
        err instanceof HttpsError
          ? err
          : new HttpsError('unknown', (err as Error).message ?? 'unknown');
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.update_role',
        target: targetEmail,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
