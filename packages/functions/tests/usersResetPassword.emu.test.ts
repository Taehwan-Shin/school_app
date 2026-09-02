import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const STUB_FILE = "./.stub-directory.json";

function writeStub(response: unknown): void {
  writeFileSync(STUB_FILE, JSON.stringify(response), "utf8");
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

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FUNCTIONS_HOST = "127.0.0.1:5001";
const PROJECT_ID = "demo-school";
const FAKE_API_KEY = "fake-api-key";

async function emulatorSignUp(email: string, password: string): Promise<{
  ok: boolean;
  status: number;
  body: any;
}> {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FAKE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

describe("usersResetPassword integration (Auth + Firestore + Functions Emulator)", () => {
  let db: FirebaseFirestore.Firestore;
  let auth: ReturnType<typeof getAuth>;
  const createdUids: string[] = [];

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
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

  // 1. allow (admin) — 200 + audit_log ok
  it("allows admin to reset password and writes ok audit_log without password in message", async () => {
    const adminEmail = `admin-reset-emu-${Date.now()}@cam.hs.kr`;
    const password = "test-password-123";

    // REST signUp
    const signUpRes = await emulatorSignUp(adminEmail, password);
    expect(signUpRes.ok).toBe(true);
    const adminUid = signUpRes.body.localId;
    createdUids.push(adminUid);

    // Promote to admin
    await auth.setCustomUserClaims(adminUid, { role: "admin" });

    // REST signIn
    const signInRes = await emulatorSignIn(adminEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // Directory stub
    const targetEmail = "targetstudent@cam.hs.kr";
    writeStub({
      data: {
        users: [
          {
            primaryEmail: targetEmail,
            isAdmin: false,
          },
        ],
        get: {
          primaryEmail: targetEmail,
          isAdmin: false,
        },
        patch: {
          primaryEmail: targetEmail,
        },
      },
    });

    const secretPassword = "newPasswordSecret123!";
    const requestId = `req-reset-emu-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersResetPassword`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "x-google-access-token": "fake-google-token",
        "x-google-scopes": "https://www.googleapis.com/auth/admin.directory.user.security",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        data: {
          primaryEmail: targetEmail,
          newPassword: secretPassword,
          changePasswordAtNextLogin: true,
        },
      }),
    });

    expect(res.status).toBe(200);
    const httpBody = await res.json();
    const result = httpBody.result ?? httpBody;

    expect(result).toEqual({
      primaryEmail: targetEmail,
      passwordReset: true,
    });

    // Verify Firestore audit_log entry
    const snapshot = await db.collection("audit_log").where("request_id", "==", requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(adminEmail);
    expect(auditDoc.role).toBe("admin");
    expect(auditDoc.action).toBe("users.reset_password");
    expect(auditDoc.target).toBe(targetEmail);
    expect(auditDoc.result).toBe("ok");
    expect(auditDoc.message).toBe("password reset (changeOnNextLogin: true)");
    expect(JSON.stringify(auditDoc)).not.toContain(secretPassword);
  });

  // 2. denied non-admin (teacher) — 403 + denied
  it("rejects non-admin teacher with permission-denied and writes denied audit_log", async () => {
    const teacherEmail = `teacher-reset-emu-${Date.now()}@cam.hs.kr`;
    const password = "test-password-123";

    // REST signUp (default teacher)
    const signUpRes = await emulatorSignUp(teacherEmail, password);
    expect(signUpRes.ok).toBe(true);
    const teacherUid = signUpRes.body.localId;
    createdUids.push(teacherUid);

    const signInRes = await emulatorSignIn(teacherEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    const targetEmail = "targetstudent@cam.hs.kr";
    const requestId = `req-reset-teacher-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersResetPassword`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "x-google-access-token": "fake-google-token",
        "x-google-scopes": "https://www.googleapis.com/auth/admin.directory.user.security",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        data: {
          primaryEmail: targetEmail,
          newPassword: "newpassword1234",
        },
      }),
    });

    expect(res.status).toBe(403);

    // Verify Firestore audit_log has denied entry
    const snapshot = await db.collection("audit_log").where("request_id", "==", requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(teacherEmail);
    expect(auditDoc.role).toBe("teacher");
    expect(auditDoc.action).toBe("users.reset_password");
    expect(auditDoc.result).toBe("denied");
  });

  // 3. denied scope 없음 — 403 + denied
  it("rejects request when required security scope is missing and writes denied audit_log", async () => {
    const adminEmail = `admin-noscope-emu-${Date.now()}@cam.hs.kr`;
    const password = "test-password-123";

    const signUpRes = await emulatorSignUp(adminEmail, password);
    expect(signUpRes.ok).toBe(true);
    const adminUid = signUpRes.body.localId;
    createdUids.push(adminUid);

    await auth.setCustomUserClaims(adminUid, { role: "admin" });

    const signInRes = await emulatorSignIn(adminEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    const targetEmail = "targetstudent@cam.hs.kr";
    const requestId = `req-reset-noscope-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersResetPassword`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "x-google-access-token": "fake-google-token",
        "x-google-scopes": "https://www.googleapis.com/auth/admin.directory.user",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        data: {
          primaryEmail: targetEmail,
          newPassword: "newpassword1234",
        },
      }),
    });

    expect(res.status).toBe(403);

    const snapshot = await db.collection("audit_log").where("request_id", "==", requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(adminEmail);
    expect(auditDoc.role).toBe("admin");
    expect(auditDoc.action).toBe("users.reset_password");
    expect(auditDoc.result).toBe("denied");
    expect(auditDoc.message).toContain("admin.directory.user.security");
  });
});
