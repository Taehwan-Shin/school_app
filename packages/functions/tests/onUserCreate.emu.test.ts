import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleUserCreate } from '../src/auth/onUserCreate.js';

/**
 * (A) 순수 handler + Firestore Emulator — handleUserCreate 로직·Firestore write 확인
 * (B) 실 Auth Emulator REST signUp + 배선된 blocking trigger — 배선까지 종단 검증
 *
 * **왜 Admin SDK 가 아니라 REST signUp 인가**:
 *   Firebase Admin SDK 의 `auth.createUser()` 는 **blocking trigger 를 발동하지 않는다**.
 *   Blocking trigger 는 클라이언트 signUp/signIn 경로에서만 발동한다.
 *   따라서 배선 시험은 Emulator 의 REST `accounts:signUp` 엔드포인트를 직접 호출해야 한다.
 */

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PROJECT_ID = 'demo-school';
const FAKE_API_KEY = 'fake-api-key';

async function emulatorSignUp(email: string, password: string): Promise<{
  ok: boolean;
  status: number;
  body: any;
}> {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

describe('beforeUserCreated integration (Firestore + Auth Emulator)', () => {
  let db: FirebaseFirestore.Firestore;
  let auth: ReturnType<typeof getAuth>;

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    }
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
    }
    process.env.GCLOUD_PROJECT = PROJECT_ID;

    const app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
  });

  // ---------- (A) 순수 handler + Firestore Emulator ----------

  describe('(A) handleUserCreate against real Firestore emulator', () => {
    it('creates users/{uid} for @cam.hs.kr user', async () => {
      const uid = 'emu-teacher-' + Date.now();
      const result = await handleUserCreate({
        uid,
        email: 'teacher1@cam.hs.kr',
        displayName: '홍길동',
      });

      expect(result).toEqual({
        action: 'created',
        role: 'teacher',
        customClaims: { role: 'teacher' },
      });

      const docSnap = await db.collection('users').doc(uid).get();
      expect(docSnap.exists).toBe(true);
      const data = docSnap.data();
      expect(data?.email).toBe('teacher1@cam.hs.kr');
      expect(data?.displayName).toBe('홍길동');
      expect(data?.role).toBe('teacher');
      expect(data?.createdAt).toBeDefined();
      expect(data?.lastSeenAt).toBeDefined();
    });

    it('throws HttpsError(permission-denied) and does NOT write for outside domain', async () => {
      const uid = 'emu-intruder-' + Date.now();
      await expect(
        handleUserCreate({ uid, email: 'intruder@example.com', displayName: '외부인' }),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      const docSnap = await db.collection('users').doc(uid).get();
      expect(docSnap.exists).toBe(false);
    });

    it('throws HttpsError(permission-denied) and does NOT write for missing email', async () => {
      const uid = 'emu-no-email-' + Date.now();
      await expect(
        handleUserCreate({ uid, email: null, displayName: null }),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      const docSnap = await db.collection('users').doc(uid).get();
      expect(docSnap.exists).toBe(false);
    });
  });

  // ---------- (B) REST signUp + 배선된 blocking trigger ----------

  describe('(B) Auth Emulator REST signUp fires the wired beforeUserCreated', () => {
    const createdUids: string[] = [];

    afterEach(async () => {
      for (const uid of createdUids) {
        try {
          await auth.deleteUser(uid);
        } catch {
          // ignore
        }
      }
      createdUids.length = 0;
    });

    it('signUp with @cam.hs.kr → trigger sets role=teacher claim and writes users/{uid}', async () => {
      const email = `wired-teacher-${Date.now()}@cam.hs.kr`;
      const { ok, status, body } = await emulatorSignUp(email, 'password');

      expect(ok, `signUp failed with ${status}: ${JSON.stringify(body)}`).toBe(true);
      expect(typeof body.localId).toBe('string');
      const uid: string = body.localId;
      createdUids.push(uid);

      // Blocking trigger 가 심은 custom claim 확인
      const fetched = await auth.getUser(uid);
      expect((fetched.customClaims as Record<string, unknown> | undefined)?.role).toBe('teacher');

      // Blocking trigger 가 만든 Firestore 문서 확인
      const docSnap = await db.collection('users').doc(uid).get();
      expect(docSnap.exists).toBe(true);
      expect(docSnap.data()?.email).toBe(email);
      expect(docSnap.data()?.role).toBe('teacher');
    });

    it('signUp with outside domain → blocking trigger blocks creation (no user, no doc)', async () => {
      const email = `wired-intruder-${Date.now()}@example.com`;
      const { ok, status, body } = await emulatorSignUp(email, 'password');

      // REST 이 400 계열로 실패해야 함 (trigger 가 permission-denied throw)
      expect(ok, `expected signUp to be rejected but got ${status}: ${JSON.stringify(body)}`).toBe(
        false,
      );

      // Auth 사용자가 존재하지 않아야
      await expect(auth.getUserByEmail(email)).rejects.toBeDefined();

      // Firestore 문서도 없어야
      const snap = await db.collection('users').where('email', '==', email).get();
      expect(snap.empty).toBe(true);
    });
  });
});
