import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleUserCreate } from '../src/auth/onUserCreate.js';

/**
 * 통합 시험은 두 층을 본다:
 * (A) 순수 handler + Firestore Emulator — handleUserCreate 로직이 실 Firestore 를 어떻게 건드리나
 * (B) 실 Auth Emulator + 배선된 blocking trigger — admin.auth().createUser 가 실제로 트리거를 부르나
 *     blocking trigger 의 결과 (custom claim · users/{uid} 문서) 를 종단으로 확인
 *
 * (B) 를 반드시 넣는 이유 — 헤드(순수) 호출만 시험하면 「트리거가 실제로 배선됐는가」를 못 잡는다.
 */

describe('beforeUserCreated integration (Firestore + Auth Emulator)', () => {
  let db: FirebaseFirestore.Firestore;
  let auth: ReturnType<typeof getAuth>;

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    }
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    }
    process.env.GCLOUD_PROJECT = 'demo-school';

    const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-school' }) : getApps()[0];
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

  // ---------- (B) 실 Auth Emulator + 배선된 trigger ----------

  describe('(B) admin.auth().createUser fires the wired beforeUserCreated', () => {
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

    it('creates Auth user + sets role=teacher custom claim + writes users/{uid} doc', async () => {
      const email = `wired-teacher-${Date.now()}@cam.hs.kr`;

      const record = await auth.createUser({ email, password: 'password', displayName: '배선시험' });
      createdUids.push(record.uid);

      // Blocking trigger 가 반환한 customClaims 가 Auth 사용자에 반영됐는지
      const fetched = await auth.getUser(record.uid);
      expect((fetched.customClaims as Record<string, unknown> | undefined)?.role).toBe('teacher');

      // Blocking trigger 가 Firestore users/{uid} 를 만들었는지
      const docSnap = await db.collection('users').doc(record.uid).get();
      expect(docSnap.exists).toBe(true);
      expect(docSnap.data()?.email).toBe(email);
      expect(docSnap.data()?.role).toBe('teacher');
    });

    it('blocking trigger rejects createUser for outside domain and no Firestore doc written', async () => {
      const email = `wired-intruder-${Date.now()}@example.com`;

      await expect(
        auth.createUser({ email, password: 'password', displayName: '외부' }),
      ).rejects.toThrow();

      // 위 실패 후에도 흔적이 남지 않는지: 같은 이메일로 조회했을 때 없어야
      await expect(auth.getUserByEmail(email)).rejects.toBeDefined();
    });
  });
});
