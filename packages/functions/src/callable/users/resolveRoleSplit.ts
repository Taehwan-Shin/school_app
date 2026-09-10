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
  // v0.107b F42: CAS 를 위한 기대치. detected 이벤트 message 에서 client 가 파싱해 전달.
  // Auth 는 실제 read 와 대조, Firestore 는 Firestore transaction 안에서 대조.
  // undefined 면 skip 하지 않고 명시적 'null' 문자열 또는 role 값 만 허용 — race 감지 강제.
  expectedAuthRole: Role | 'null';
  expectedFirestoreRole: Role | 'null';
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
// - v0.107b F42: CAS. client 는 detected 이벤트에서 본 `expectedAuthRole`·
//   `expectedFirestoreRole` 을 전달. 서버는 실제 Auth read 후 expectedAuthRole 과 대조하고,
//   Firestore 는 transaction 안에서 read → compare → write 로 동시 update 경쟁 차단.
//   기대치와 실제가 다르면 `failed-precondition` (예: 다른 세션에서 usersUpdateRole 이
//   Firestore·Auth 를 최신 값으로 이미 동기화한 상태에서 옛 Auth read 로 덮어쓸 위험 방지).
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

      // v0.107b F42: CAS 기대치 필수. client 는 detected 이벤트 message 에서 파싱해 전달.
      const validExpected = (v: unknown): v is Role | 'null' =>
        v === 'super_admin' || v === 'admin' || v === 'teacher' || v === 'null';
      if (!validExpected(data?.expectedAuthRole)) {
        throw new HttpsError('invalid-argument', 'expectedAuthRole_required');
      }
      if (!validExpected(data?.expectedFirestoreRole)) {
        throw new HttpsError('invalid-argument', 'expectedFirestoreRole_required');
      }
      const expectedAuthRole = data.expectedAuthRole as Role | 'null';
      const expectedFirestoreRole = data.expectedFirestoreRole as Role | 'null';

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

      // v0.107b F42: Auth CAS. 기대치와 다르면 감지 이후 다른 세션이 Auth 를 갱신한 것.
      const authRoleAsExpected = authRole ?? 'null';
      if (authRoleAsExpected !== expectedAuthRole) {
        throw new HttpsError(
          'failed-precondition',
          `auth_role_changed: expected=${expectedAuthRole} actual=${authRoleAsExpected} — 감지 후 Auth 가 변경되어 오래된 값 덮어씀 방지`,
        );
      }

      // v0.107b F42: Firestore CAS 를 transaction 안에서 read → compare → write.
      // Auth 는 transaction 밖 이므로 위 authRoleAsExpected 대조로 대체. transaction 내에서
      // Firestore 가 기대치와 같을 때만 write, 아니면 인터리브된 update 로 판단.
      let previousFirestoreRole: Role | null = null;
      await getFirestore().runTransaction(async (tx) => {
        const snap = await tx.get(getFirestore().doc(`users/${authUser.uid}`));
        const docRawRole = snap.exists
          ? (snap.data() as { role?: unknown } | undefined)?.role
          : undefined;
        previousFirestoreRole =
          docRawRole === 'super_admin' || docRawRole === 'admin' || docRawRole === 'teacher'
            ? (docRawRole as Role)
            : null;
        const previousAsExpected = previousFirestoreRole ?? 'null';
        if (previousAsExpected !== expectedFirestoreRole) {
          throw new HttpsError(
            'failed-precondition',
            `firestore_role_changed: expected=${expectedFirestoreRole} actual=${previousAsExpected} — 감지 후 Firestore 가 변경되어 stale write 방지`,
          );
        }
        if (authRole === previousFirestoreRole) {
          throw new HttpsError(
            'failed-precondition',
            `no_split: auth=${authRole ?? 'null'} firestore=${previousFirestoreRole ?? 'null'} 이미 동기 상태`,
          );
        }
        // authRole 이 null 이면 Firestore role 필드 삭제, 아니면 값으로 갱신.
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
        tx.set(getFirestore().doc(`users/${authUser.uid}`), writePayload, { merge: true });
      });

      // v0.107c F45 · v0.107d F47: post-write Auth 재검증 + 상태 재조회.
      // transaction 밖에서 Auth 와 Firestore 를 다시 읽는다:
      //  (a) Auth 가 pre-write 와 같음 → 성공. resolved 감사.
      //  (b) Auth 가 달라졌지만 Firestore == Auth → 우연히 수렴. resolved 감사 (converged 표시).
      //  (c) Auth 가 달라지고 Firestore != Auth → 우리가 새 split 을 만들었음. 새 detected 감사
      //      + aborted 예외. 클라이언트가 다음 감지 사이클에서 재해결.
      const authUserAfter = await getAuth().getUser(uid);
      const claimAfter =
        (authUserAfter.customClaims as { role?: unknown } | undefined) ?? {};
      const authRoleAfter: Role | null =
        claimAfter.role === 'super_admin' || claimAfter.role === 'admin' || claimAfter.role === 'teacher'
          ? (claimAfter.role as Role)
          : null;
      const authRoleAfterAsExpected = authRoleAfter ?? 'null';

      if (authRoleAfterAsExpected === authRoleAsExpected) {
        // (a) 정상.
        await writeAudit({
          actor: user.email,
          role: user.role,
          action: 'system.role_split_resolved',
          target: `users/${authUser.uid}`,
          request_id: requestId,
          result: 'ok',
          message: `resolved: firestore ${previousFirestoreRole ?? 'null'} → ${authRole ?? 'null'} (auth 원본)`,
        });
      } else {
        // Auth 가 write 사이에 바뀜 → Firestore 다시 read 해서 실제 상태 판정.
        const snapAfter = await getFirestore().doc(`users/${authUser.uid}`).get();
        const docRawAfter = snapAfter.exists
          ? (snapAfter.data() as { role?: unknown } | undefined)?.role
          : undefined;
        const firestoreRoleAfter: Role | null =
          docRawAfter === 'super_admin' || docRawAfter === 'admin' || docRawAfter === 'teacher'
            ? (docRawAfter as Role)
            : null;
        if (authRoleAfter === firestoreRoleAfter) {
          // (b) 우연히 수렴. 실제 sync 됐으므로 resolved 로 인정.
          await writeAudit({
            actor: user.email,
            role: user.role,
            action: 'system.role_split_resolved',
            target: `users/${authUser.uid}`,
            request_id: requestId,
            result: 'ok',
            message: `resolved_by_convergence: auth pre=${authRoleAsExpected} post=${authRoleAfterAsExpected}, firestore=${firestoreRoleAfter ?? 'null'} (경쟁 update 후 우연히 동기)`,
          });
        } else {
          // (c) 새 split. 감사에 detected 로 기록하고 aborted 로 예외.
          await writeAudit({
            actor: user.email,
            role: user.role,
            action: 'system.role_split_detected',
            target: `users/${authUser.uid}`,
            request_id: requestId,
            result: 'error',
            message: `role_split: auth=${authRoleAfter ?? 'null'} firestore=${firestoreRoleAfter ?? 'null'} (post_write_race)`,
          });
          throw new HttpsError(
            'aborted',
            `auth_role_changed_during_write: before=${authRoleAsExpected} after=${authRoleAfterAsExpected} firestore=${firestoreRoleAfter ?? 'null'} — 새 split 감사에 기록됨. 클라이언트 재감지 후 재시도.`,
          );
        }
      }

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
