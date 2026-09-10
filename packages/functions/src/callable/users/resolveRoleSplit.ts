import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';

export interface UsersResolveRoleSplitRequest {
  uid: string;
}

export interface UsersResolveRoleSplitResponse {
  primaryEmail: string;
  uid: string;
  authRole: Role | null;
  previousFirestoreRole: Role | null;
  newFirestoreRole: Role | null;
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

// v0.107: role_split 자동 복구. usersGetRole 이 감지한 「Auth claim ≠ Firestore role」 상태
// 를 super_admin 이 한 클릭으로 Firestore = Auth 로 동기화. Auth 가 authz 소스 (updateRole,
// getRole 도 Auth 를 진실로 취급). Firestore 는 UI display cache 이므로 Auth 쪽으로 맞추는
// 방향만 지원. 반대 방향 (Auth = Firestore) 은 super_admin 이 EditUserRoleDialog 로 명시적
// 처리 (usersUpdateRole 이 이미 Auth + Firestore 원자적 갱신 + 롤백 처리).
//
// 안전 장치:
// - system.manage_roles cap (super_admin only) 요구.
// - 이미 동기 상태면 failed-precondition 반환 (no-op 감사 오염 방지).
// - Auth role 이 null 이면 Firestore doc.role 을 FieldValue.delete() 로 제거.
// - Firestore 실패 시 이 callable 은 write 만 하므로 롤백 불필요 (Auth 는 손대지 않음).
export const usersResolveRoleSplit = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<UsersResolveRoleSplitResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<UsersResolveRoleSplitRequest> | undefined;
    // audit target 은 uid 만 알 뿐 email 을 모른다. audit 감사 log 초기 시점엔 uid 만 알아서
    // 감사 target 을 임시로 uid 로 두고, 성공 시 email 을 서버 조회 후 message 에 병기.
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
        action: 'system.role_split_resolved',
        target: `users/${targetUid}`,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'system.manage_roles');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'system.role_split_resolved',
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

      // uid → Auth user → email. email 도메인 확인은 여기서 (audit 카드가 non-allowed 도메인
      // 사용자를 감지했을 수도 있지만 role 은 allowed 도메인 계정만 대상).
      const authUser = await getAuth().getUser(uid);
      const email = authUser.email ?? '';
      const domain = email.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_email_domain');
      }
      const claim = (authUser.customClaims as { role?: unknown } | undefined) ?? {};
      const authRole: Role | null =
        claim.role === 'super_admin' || claim.role === 'admin' || claim.role === 'teacher'
          ? (claim.role as Role)
          : null;

      const snap = await getFirestore().doc(`users/${authUser.uid}`).get();
      const docRawRole = snap.exists
        ? (snap.data() as { role?: unknown } | undefined)?.role
        : undefined;
      const previousFirestoreRole: Role | null =
        docRawRole === 'super_admin' || docRawRole === 'admin' || docRawRole === 'teacher'
          ? (docRawRole as Role)
          : null;

      if (authRole === previousFirestoreRole) {
        throw new HttpsError(
          'failed-precondition',
          `no_split: auth=${authRole ?? 'null'} firestore=${previousFirestoreRole ?? 'null'} 이미 동기 상태`,
        );
      }

      // authRole 이 null 이면 Firestore role 필드 삭제, 아니면 setCustomUserClaims 값으로 갱신.
      // email 필드는 병기 (users/update.ts 등 email 조회 callable 이 doc 부재 시에도 살아있게).
      const writePayload: Record<string, unknown> = {
        email,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (authRole === null) {
        writePayload.role = FieldValue.delete();
      } else {
        writePayload.role = authRole;
      }
      await getFirestore().doc(`users/${authUser.uid}`).set(writePayload, { merge: true });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'system.role_split_resolved',
        target: `users/${authUser.uid}`,
        request_id: requestId,
        result: 'ok',
        message: `resolved: firestore ${previousFirestoreRole ?? 'null'} → ${authRole ?? 'null'} (auth 원본)`,
      });

      return {
        primaryEmail: email,
        uid: authUser.uid,
        authRole,
        previousFirestoreRole,
        newFirestoreRole: authRole,
      };
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
        action: 'system.role_split_resolved',
        target: `users/${targetUid}`,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
