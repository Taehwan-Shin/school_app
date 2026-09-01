import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeAudit } from '../src/audit/writeAudit.js';

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

describe('auditLogList integration (Auth + Firestore + Functions Emulator)', () => {
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
  });

  it('runs REST signUp -> promote to super_admin -> signIn -> seed 3 audit entries -> call auditLogList -> returns entries + writes ok audit_log', async () => {
    const email = `super-emu-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    // 2. Set custom claim { role: 'super_admin' }
    await auth.setCustomUserClaims(uid, { role: 'super_admin' });

    // 3. REST signIn
    const signInRes = await emulatorSignIn(email, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // 4. Seed 3 audit entries
    const seedPrefix = `seed-${Date.now()}`;
    await writeAudit({
      actor: 'teacher1@cam.hs.kr',
      role: 'teacher',
      action: 'classroom.read',
      target: 'class-1',
      request_id: `${seedPrefix}-1`,
      result: 'ok',
      message: 'viewed classroom',
    });
    await writeAudit({
      actor: 'admin1@cam.hs.kr',
      role: 'admin',
      action: 'users.write',
      target: 'student1@cam.hs.kr',
      request_id: `${seedPrefix}-2`,
      result: 'ok',
      message: 'updated student',
    });
    await writeAudit({
      actor: 'teacher2@cam.hs.kr',
      role: 'teacher',
      action: 'users.read',
      target: '*',
      request_id: `${seedPrefix}-3`,
      result: 'denied',
      message: 'permission-denied',
    });

    // 5. Call auditLogList HTTP endpoint with super_admin idToken
    const requestId = `req-super-audit-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/auditLogList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-google-access-token': 'fake-token',
        'x-request-id': requestId,
      },
      body: JSON.stringify({ data: { limit: 10 } }),
    });

    expect(res.status).toBe(200);
    const httpBody = await res.json();
    const result = httpBody.result ?? httpBody;

    // 6. Verify result entries include seeded data
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries.length).toBeGreaterThanOrEqual(3);
    const seedReqIds = result.entries.map((e: any) => e.request_id);
    expect(seedReqIds).toContain(`${seedPrefix}-1`);
    expect(seedReqIds).toContain(`${seedPrefix}-2`);
    expect(seedReqIds).toContain(`${seedPrefix}-3`);

    // 7. Verify Firestore audit_log has the self-auditing entry for auditLogList
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(email);
    expect(auditDoc.role).toBe('super_admin');
    expect(auditDoc.action).toBe('audit.read');
    expect(auditDoc.target).toBe('*');
    expect(auditDoc.result).toBe('ok');
    expect(auditDoc.message).toContain('read');
  });

  it('rejects admin via HTTP endpoint and writes denied audit_log', async () => {
    const email = `admin-emu-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp -> promote to admin
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    await auth.setCustomUserClaims(uid, { role: 'admin' });

    const signInRes = await emulatorSignIn(email, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    const requestId = `req-admin-audit-denied-${Date.now()}`;

    // 2. Call auditLogList HTTP endpoint with admin idToken
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/auditLogList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-google-access-token': 'fake-token',
        'x-request-id': requestId,
      },
      body: JSON.stringify({ data: {} }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // 3. Verify Firestore audit_log has denied entry
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(email);
    expect(auditDoc.role).toBe('admin');
    expect(auditDoc.action).toBe('audit.read');
    expect(auditDoc.result).toBe('denied');
  });

  it('rejects unauthenticated request via HTTP endpoint and writes denied audit_log with role=unknown', async () => {
    const requestId = `req-unauth-audit-denied-${Date.now()}`;

    // Call HTTP endpoint without auth header
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/auditLogList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-google-access-token': 'fake-token',
        'x-request-id': requestId,
      },
      body: JSON.stringify({ data: {} }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // Verify Firestore audit_log has denied entry with unknown actor and unknown role
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe('unknown');
    expect(auditDoc.role).toBe('unknown');
    expect(auditDoc.action).toBe('audit.read');
    expect(auditDoc.result).toBe('denied');
  });
});
