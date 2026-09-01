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

describe("usersUpdate integration (Auth + Firestore + Functions Emulator)", () => {
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

  // 1. allow — admin 계정 로그인 -> usersUpdate POST -> 200 응답 + audit_log 에 ok 항목
  it("runs REST signUp -> promote to admin -> signIn -> call usersUpdate on target user -> writes ok audit_log to Firestore Emulator", async () => {
    const adminEmail = `admin-update-emu-${Date.now()}@cam.hs.kr`;
    const password = "test-password-123";

    // 1. REST signUp -> default teacher
    const signUpRes = await emulatorSignUp(adminEmail, password);
    expect(signUpRes.ok).toBe(true);
    const adminUid = signUpRes.body.localId;
    createdUids.push(adminUid);

    // 2. Admin SDK sets custom claim { role: "admin" }
    await auth.setCustomUserClaims(adminUid, { role: "admin" });

    // 3. REST signInWithPassword returns updated idToken with admin claim
    const signInRes = await emulatorSignIn(adminEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // 4. Directory API stub
    const targetEmail = "targetstudent@cam.hs.kr";
    writeStub({
      data: {
        users: [
          {
            primaryEmail: targetEmail,
            isAdmin: false,
            name: { givenName: "Old", familyName: "Name" },
            orgUnitPath: "/",
          },
        ],
        get: {
          primaryEmail: targetEmail,
          isAdmin: false,
          name: { givenName: "Old", familyName: "Name" },
          orgUnitPath: "/",
        },
        patch: {
          primaryEmail: targetEmail,
          name: { givenName: "New", familyName: "Name" },
          orgUnitPath: "/교직원",
        },
      },
    });

    // 5. Call HTTP endpoint with admin idToken
    const requestId = `req-update-http-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersUpdate`, {
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
          firstName: "New",
          orgUnitPath: "/교직원",
        },
      }),
    });

    expect(res.status).toBe(200);
    const httpBody = await res.json();
    const result = httpBody.result ?? httpBody;

    expect(result).toEqual({
      primaryEmail: targetEmail,
      updatedFields: ["firstName", "orgUnitPath"],
    });

    // 6. Verify Firestore audit_log entry was persisted
    const snapshot = await db.collection("audit_log").where("request_id", "==", requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(adminEmail);
    expect(auditDoc.role).toBe("admin");
    expect(auditDoc.action).toBe("users.write");
    expect(auditDoc.target).toBe(targetEmail);
    expect(auditDoc.result).toBe("ok");
    expect(auditDoc.message).toContain("updated fields: firstName, orgUnitPath");
  });

  // 2. denied non-admin — teacher 계정 로그인 -> 403 응답 + audit_log 에 denied 항목
  it("rejects non-admin teacher with permission denied and writes denied audit_log", async () => {
    const teacherEmail = `teacher-update-emu-${Date.now()}@cam.hs.kr`;
    const password = "test-password-123";

    // 1. REST signUp (default claim is teacher)
    const signUpRes = await emulatorSignUp(teacherEmail, password);
    expect(signUpRes.ok).toBe(true);
    const teacherUid = signUpRes.body.localId;
    createdUids.push(teacherUid);

    // 2. REST signInWithPassword
    const signInRes = await emulatorSignIn(teacherEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    const requestId = `req-teacher-update-http-${Date.now()}`;
    const targetEmail = "targetstudent@cam.hs.kr";
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersUpdate`, {
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
          firstName: "New",
        },
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // Verify Firestore audit_log has denied entry
    const snapshot = await db.collection("audit_log").where("request_id", "==", requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(teacherEmail);
    expect(auditDoc.role).toBe("teacher");
    expect(auditDoc.action).toBe("users.write");
    expect(auditDoc.target).toBe(targetEmail);
    expect(auditDoc.result).toBe("denied");
  });

  // 3. admin_cannot_edit_admin — admin 이 다른 admin 편집 시도 -> 403 + audit_log 에 permission-denied 항목
  it("blocks admin from editing a workspace admin and writes denied audit_log", async () => {
    const adminEmail = `admin-editadmin-emu-${Date.now()}@cam.hs.kr`;
    const password = "test-password-123";

    // 1. REST signUp
    const signUpRes = await emulatorSignUp(adminEmail, password);
    expect(signUpRes.ok).toBe(true);
    const adminUid = signUpRes.body.localId;
    createdUids.push(adminUid);

    // 2. Claim role=admin
    await auth.setCustomUserClaims(adminUid, { role: "admin" });

    // 3. SignIn
    const signInRes = await emulatorSignIn(adminEmail, password);
    expect(signInRes.ok).toBe(true);
    const idToken = signInRes.body.idToken;

    // 4. Directory API stub where target is admin
    const targetAdminEmail = "workspaceadmin@cam.hs.kr";
    writeStub({
      data: {
        get: {
          primaryEmail: targetAdminEmail,
          isAdmin: true,
          name: { givenName: "Workspace", familyName: "Admin" },
          orgUnitPath: "/",
        },
      },
    });

    const requestId = `req-editadmin-http-${Date.now()}`;
    const res = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT_ID}/asia-northeast3/usersUpdate`, {
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
          primaryEmail: targetAdminEmail,
          firstName: "NewName",
        },
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // Verify Firestore audit_log has denied entry
    const snapshot = await db.collection("audit_log").where("request_id", "==", requestId).get();
    expect(snapshot.empty).toBe(false);
    const auditDoc = snapshot.docs[0].data();
    expect(auditDoc.actor).toBe(adminEmail);
    expect(auditDoc.role).toBe("admin");
    expect(auditDoc.action).toBe("users.write");
    expect(auditDoc.target).toBe(targetAdminEmail);
    expect(auditDoc.result).toBe("denied");
    expect(auditDoc.message).toBe("admin_cannot_edit_admin");
  });
});
