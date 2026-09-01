import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

const STUB_FILE = './.stub-directory.json';

function writeStub(response: unknown): void {
  const content = JSON.stringify(response);
  writeFileSync(STUB_FILE, content, 'utf8');
  if (existsSync('./deploy')) {
    writeFileSync('./deploy/.stub-directory.json', content, 'utf8');
  }
}

function clearStub(): void {
  for (const f of [STUB_FILE, './deploy/.stub-directory.json']) {
    if (existsSync(f)) {
      try {
        unlinkSync(f);
      } catch {
        // ignore
      }
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

describe('groupsDelete integration (Auth + Firestore + Functions Emulator)', () => {
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

  // 1. allow (admin) — 200 + audit_log
  it('runs REST signUp -> promote to admin -> signIn -> call groupsDelete -> writes ok audit_log to Firestore Emulator', async () => {
    const adminEmail = `admin-delete-group-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp -> default teacher
    const signUpRes = await emulatorSignUp(adminEmail, password);
    expect(signUpRes.ok).toBe(true);
    const adminUid = signUpRes.body.localId;
    createdUids.push(adminUid);

    // 2. Admin SDK sets custom claim { role: 'admin' }
    await auth.setCustomUserClaims(adminUid, { role: 'admin' });

    // 3. REST signIn returns idToken with admin claim
    const signInRes = await emulatorSignIn(adminEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // 4. Directory API stub
    const targetGroupEmail = 'delete-target-team@cam.hs.kr';
    writeStub({
      data: {
        groupDelete: {},
      },
    });

    // 5. Call HTTP endpoint with admin idToken
    const requestId = `req-delete-group-http-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/groupsDelete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-google-access-token': 'fake-google-token',
        'x-google-scopes': 'https://www.googleapis.com/auth/admin.directory.group',
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        data: {
          email: targetGroupEmail,
        },
      }),
    });

    expect(res.status).toBe(200);
    const httpBody = await res.json();
    const result = httpBody.result ?? httpBody;

    expect(result).toEqual({
      email: targetGroupEmail,
      deleted: true,
    });

    // 6. Verify Firestore audit_log entry was persisted
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(adminEmail);
    expect(auditDoc.role).toBe('admin');
    expect(auditDoc.action).toBe('groups.delete');
    expect(auditDoc.target).toBe(targetGroupEmail);
    expect(auditDoc.result).toBe('ok');
    expect(auditDoc.message).toBe('deleted group');
  });

  // 2. denied non-admin (teacher) — 403
  it('rejects non-admin (teacher) via HTTP endpoint and writes denied audit_log', async () => {
    const teacherEmail = `teacher-delete-group-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp -> default role is teacher
    const signUpRes = await emulatorSignUp(teacherEmail, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    const idToken = signUpRes.body.idToken;
    const targetEmail = 'delete-target-team@cam.hs.kr';
    const requestId = `req-teacher-delete-group-http-${Date.now()}`;

    // 2. Call HTTP endpoint with teacher idToken
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/groupsDelete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-google-access-token': 'fake-token',
        'x-google-scopes': 'https://www.googleapis.com/auth/admin.directory.group',
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        data: {
          email: targetEmail,
        },
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // 3. Verify Firestore audit_log has denied entry
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(teacherEmail);
    expect(auditDoc.role).toBe('teacher');
    expect(auditDoc.action).toBe('groups.delete');
    expect(auditDoc.target).toBe(targetEmail);
    expect(auditDoc.result).toBe('denied');
  });

  // 3. denied scope 없음 — 403
  it('rejects admin with missing group write scope and writes denied audit_log', async () => {
    const adminEmail = `admin-noscope-delete-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp
    const signUpRes = await emulatorSignUp(adminEmail, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    // 2. Promote to admin
    await auth.setCustomUserClaims(uid, { role: 'admin' });

    // 3. Sign in
    const signInRes = await emulatorSignIn(adminEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    const targetEmail = 'delete-target-team@cam.hs.kr';
    const requestId = `req-noscope-delete-group-http-${Date.now()}`;

    // 4. Call HTTP endpoint without write scope (only readonly scope)
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/groupsDelete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-google-access-token': 'fake-token',
        'x-google-scopes': 'https://www.googleapis.com/auth/admin.directory.group.readonly',
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        data: {
          email: targetEmail,
        },
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // 5. Verify Firestore audit_log has denied entry
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(adminEmail);
    expect(auditDoc.role).toBe('admin');
    expect(auditDoc.action).toBe('groups.delete');
    expect(auditDoc.target).toBe(targetEmail);
    expect(auditDoc.result).toBe('denied');
  });
});
