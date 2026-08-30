import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

/**
 * HTTP 종단 시험용 Directory API stub 파일 경로.
 * Functions Emulator 는 별도 프로세스라 `vi.mock('googleapis')` 가 안 통한다.
 * 대신 `directoryClient.ts` 가 이 파일을 읽어 응답으로 삼는다 (env: EMULATOR_DIRECTORY_STUB_FILE).
 */
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

describe('usersList integration (Auth + Firestore + Functions Emulator)', () => {
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

  it('runs REST signUp -> promote to admin -> signIn -> call usersList -> writes ok audit_log to Firestore Emulator', async () => {
    const email = `admin-emu-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp -> blocking trigger sets teacher
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    // 2. Admin SDK sets custom claim { role: 'admin' }
    await auth.setCustomUserClaims(uid, { role: 'admin' });

    // 3. REST signInWithPassword returns updated idToken with admin claim
    const signInRes = await emulatorSignIn(email, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // Verify token claims by decoding or checking user record
    const userRec = await auth.getUser(uid);
    expect((userRec.customClaims as any)?.role).toBe('admin');

    // 4. Directory API stub — 파일에 응답을 써서 functions 프로세스가 읽게 한다.
    //    (Vitest 의 vi.mock 은 별도 프로세스에 안 전파되므로 파일 기반.)
    writeStub({
      data: {
        users: [
          {
            primaryEmail: 'user1@cam.hs.kr',
            name: { givenName: '철수', familyName: '김' },
            orgUnitPath: '/학생/1학년',
            isAdmin: false,
            suspended: false,
          },
          {
            primaryEmail: 'user2@cam.hs.kr',
            name: { givenName: '영희', familyName: '이' },
            orgUnitPath: '/교사',
            isAdmin: true,
            suspended: false,
          },
        ],
        nextPageToken: null,
      },
    });

    // 5. Call HTTP endpoint with admin idToken
    const requestId = `req-admin-http-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-google-access-token': 'fake-google-token',
        'x-google-scopes': 'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'x-request-id': requestId,
      },
      body: JSON.stringify({ data: {} }),
    });
    expect(res.status).toBe(200);
    const httpBody = await res.json();
    const result = httpBody.result ?? httpBody;

    // 6. Verify returned users
    expect(result).toEqual({
      users: [
        {
          email: 'user1@cam.hs.kr',
          firstName: '철수',
          lastName: '김',
          orgUnitPath: '/학생/1학년',
          isAdmin: false,
          isSuspended: false,
        },
        {
          email: 'user2@cam.hs.kr',
          firstName: '영희',
          lastName: '이',
          orgUnitPath: '/교사',
          isAdmin: true,
          isSuspended: false,
        },
      ],
    });

    // 7. Verify Firestore audit_log entry was persisted
    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(email);
    expect(auditDoc.role).toBe('admin');
    expect(auditDoc.action).toBe('users.read');
    expect(auditDoc.target).toBe('*');
    expect(auditDoc.result).toBe('ok');
    expect(auditDoc.message).toBe('listed 2 users');
  });

  it('rejects teacher via HTTP endpoint and writes denied audit_log', async () => {
    const email = `teacher-emu-${Date.now()}@cam.hs.kr`;
    const password = 'test-password-123';

    // 1. REST signUp -> default role is teacher
    const signUpRes = await emulatorSignUp(email, password);
    expect(signUpRes.ok).toBe(true);
    const uid = signUpRes.body.localId;
    createdUids.push(uid);

    const idToken = signUpRes.body.idToken;
    const requestId = `req-teacher-http-${Date.now()}`;

    // 2. Call HTTP endpoint with teacher's idToken
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersList`, {
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
    expect(auditDoc.role).toBe('teacher');
    expect(auditDoc.action).toBe('users.read');
    expect(auditDoc.result).toBe('denied');
  });
});
