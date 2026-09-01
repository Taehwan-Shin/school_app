import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

const STUB_FILE = './.stub-directory.json';

function writeStub(response: unknown): void {
  writeFileSync(STUB_FILE, JSON.stringify(response), 'utf8');
}

function clearStub(): void {
  if (existsSync(STUB_FILE)) {
    try {
      unlinkSync(STUB_FILE);
    } catch {
      // ignore
    }
  }
}

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FUNCTIONS_HOST = '127.0.0.1:5001';
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

async function emulatorSignIn(email: string, password: string): Promise<{
  ok: boolean;
  status: number;
  body: any;
}> {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

describe('groupsMembersInsert integration (Auth + Firestore + Functions Emulator)', () => {
  let db: FirebaseFirestore.Firestore;
  let auth: ReturnType<typeof getAuth>;
  const createdUids: string[] = [];

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

  afterEach(async () => {
    for (const uid of createdUids) {
      try {
        await auth.deleteUser(uid);
      } catch {
        // ignore
      }
    }
    createdUids.length = 0;
    clearStub();
  });

  it('runs REST signUp -> promote to admin -> signIn -> call groupsMembersInsert -> writes ok audit_log to Firestore Emulator', async () => {
    const email = `admin-emu-members-insert-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    // 2. Admin SDK sets custom claim { role: 'admin' }
    await auth.setCustomUserClaims(uid, { role: 'admin' });

    // 3. REST signIn
    const signInRes = await emulatorSignIn(email, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // 4. Directory API stub
    writeStub({
      data: {
        memberInsert: {
          id: 'member-insert-id-123',
          email: 'newbie@cam.hs.kr',
          role: 'MEMBER',
        },
      },
    });

    // 5. Call HTTP endpoint with admin idToken
    const requestId = `req-admin-members-insert-http-${Date.now()}`;
    const res = await fetch(
      `http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/groupsMembersInsert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-google-access-token': 'fake-google-token',
          'x-google-scopes': 'https://www.googleapis.com/auth/admin.directory.group.member',
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          data: {
            groupEmail: 'team-a@cam.hs.kr',
            memberEmail: 'newbie@cam.hs.kr',
            role: 'MEMBER',
          },
        }),
      },
    );

    expect(res.status).toBe(200);
    const httpBody = await res.json();
    const result = httpBody.result ?? httpBody;

    expect(result).toEqual({
      groupEmail: 'team-a@cam.hs.kr',
      memberEmail: 'newbie@cam.hs.kr',
      role: 'MEMBER',
    });

    // 6. Verify Firestore audit_log entry was persisted
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(email);
    expect(auditDoc.role).toBe('admin');
    expect(auditDoc.action).toBe('groups.write');
    expect(auditDoc.target).toBe('team-a@cam.hs.kr');
    expect(auditDoc.result).toBe('ok');
    expect(auditDoc.message).toBe('added newbie@cam.hs.kr to group team-a@cam.hs.kr as MEMBER');
  });

  it('rejects non-admin (teacher) via HTTP endpoint and writes denied audit_log', async () => {
    const email = `teacher-emu-members-insert-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp -> default teacher
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    const idToken = signUpRes.body.idToken;
    const requestId = `req-teacher-members-insert-http-${Date.now()}`;

    // 2. Call HTTP endpoint with teacher's idToken
    const res = await fetch(
      `http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/groupsMembersInsert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-google-access-token': 'fake-token',
          'x-google-scopes': 'https://www.googleapis.com/auth/admin.directory.group.member',
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          data: {
            groupEmail: 'team-a@cam.hs.kr',
            memberEmail: 'newbie@cam.hs.kr',
          },
        }),
      },
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    // 3. Verify Firestore audit_log has denied entry
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(email);
    expect(auditDoc.role).toBe('teacher');
    expect(auditDoc.action).toBe('groups.write');
    expect(auditDoc.result).toBe('denied');
  });

  it('rejects admin with missing group.member scope and writes denied audit_log', async () => {
    const email = `admin-noscope-members-insert-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    // 2. Promote to admin
    await auth.setCustomUserClaims(uid, { role: 'admin' });

    // 3. Sign in
    const signInRes = await emulatorSignIn(email, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    const requestId = `req-noscope-members-insert-http-${Date.now()}`;

    // 4. Call HTTP endpoint with only readonly scope
    const res = await fetch(
      `http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/groupsMembersInsert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-google-access-token': 'fake-token',
          'x-google-scopes':
            'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          data: {
            groupEmail: 'team-a@cam.hs.kr',
            memberEmail: 'newbie@cam.hs.kr',
          },
        }),
      },
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    // 5. Verify Firestore audit_log has denied entry
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(email);
    expect(auditDoc.role).toBe('admin');
    expect(auditDoc.action).toBe('groups.write');
    expect(auditDoc.result).toBe('denied');
  });
});
