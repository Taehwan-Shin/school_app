import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';

export interface UsersRecheckRoleSplitRequest {
  uid: string;
}

export interface UsersRecheckRoleSplitResponse {
  primaryEmail: string;
  uid: string;
  authRole: Role | null;
  firestoreRole: Role | null;
  isSplit: boolean;
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

// v0.107f F51: role_split 상태 재확인. 아무것도 갱신하지 않고 Auth + Firestore 만 읽어서
// 현재 상태를 감사 log 에 기록. 용도:
//  - resolveRoleSplit F48 (post-write auth 재조회 실패) 로 남은 `auth=unknown` detected row
//    가 client parser 로 「복구 불가」 상태에 고착되지 않도록, 새 detected (parsable role 값)
//    또는 resolved (실제 sync 상태) 이벤트로 대체.
//  - 다른 super_admin 도구에서 「현재 상태 확인」 트리거로 활용 가능.
export const usersRecheckRoleSplit = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<UsersRecheckRoleSplitResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<UsersRecheckRoleSplitRequest> | undefined;
    const targetUid =
      typeof data?.uid === 'string' && data.uid.trim() ? data.uid.trim() : '*';

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
        target: `users/${targetUid}`,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      // recheck 는 상태 확인이지 mutation 아님. 하지만 detected/resolved 감사 를 남기므로
      // 신중한 cap 요구. system.manage_roles (super_admin only) 로 맞춤 — resolveRoleSplit
      // 과 동일한 audience.
      assertHasCap(user, 'system.manage_roles');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.read',
        target: `users/${targetUid}`,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (
        !data?.uid ||
        typeof data.uid !== 'string' ||
        data.uid.trim().length === 0
      ) {
        throw new HttpsError('invalid-argument', 'uid_required');
      }
      const uid = data.uid.trim();

      const authUser = await getAuth().getUser(uid);
      const email = authUser.email ?? '';
      const claim = (authUser.customClaims as { role?: unknown } | undefined) ?? {};
      const authRole: Role | null =
        claim.role === 'super_admin' || claim.role === 'admin' || claim.role === 'teacher'
          ? (claim.role as Role)
          : null;

      const snap = await getFirestore().doc(`users/${authUser.uid}`).get();
      const docRawRole = snap.exists
        ? (snap.data() as { role?: unknown } | undefined)?.role
        : undefined;
      const firestoreRole: Role | null =
        docRawRole === 'super_admin' || docRawRole === 'admin' || docRawRole === 'teacher'
          ? (docRawRole as Role)
          : null;

      const isSplit = authRole !== firestoreRole;

      if (isSplit) {
        await writeAudit({
          actor: user.email,
          role: user.role,
          action: 'system.role_split_detected',
          target: `users/${authUser.uid}`,
          request_id: requestId,
          result: 'error',
          message: `role_split: auth=${authRole ?? 'null'} firestore=${firestoreRole ?? 'null'} (rechecked)`,
        });
      } else {
        await writeAudit({
          actor: user.email,
          role: user.role,
          action: 'system.role_split_resolved',
          target: `users/${authUser.uid}`,
          request_id: requestId,
          result: 'ok',
          message: `resolved_by_recheck: auth=${authRole ?? 'null'} firestore=${firestoreRole ?? 'null'} (실제 동기 상태 확인)`,
        });
      }

      return { primaryEmail: email, uid: authUser.uid, authRole, firestoreRole, isSplit };
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
        action: 'users.read',
        target: `users/${targetUid}`,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
