import { describe, it, expect, beforeAll } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleUserCreate } from '../src/auth/onUserCreate.js';

describe('beforeUserCreated trigger (Firestore Emulator Integration)', () => {
  let db: FirebaseFirestore.Firestore;

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
  });

  it('creates users/{uid} in real Firestore emulator for @cam-t.kr user', async () => {
    const uid = 'emu-teacher-' + Date.now();
    const result = await handleUserCreate({
      uid,
      email: 'teacher1@cam-t.kr',
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
    expect(data?.email).toBe('teacher1@cam-t.kr');
    expect(data?.displayName).toBe('홍길동');
    expect(data?.role).toBe('teacher');
    expect(data?.createdAt).toBeDefined();
    expect(data?.lastSeenAt).toBeDefined();
  });

  it('throws HttpsError(permission-denied) and does NOT create document for outside domain', async () => {
    const uid = 'emu-intruder-' + Date.now();

    await expect(
      handleUserCreate({
        uid,
        email: 'intruder@example.com',
        displayName: '외부인',
      }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });

    const docSnap = await db.collection('users').doc(uid).get();
    expect(docSnap.exists).toBe(false);
  });

  it('throws HttpsError(permission-denied) and does NOT create document for missing email', async () => {
    const uid = 'emu-no-email-' + Date.now();

    await expect(
      handleUserCreate({
        uid,
        email: null,
        displayName: null,
      }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });

    const docSnap = await db.collection('users').doc(uid).get();
    expect(docSnap.exists).toBe(false);
  });
});
