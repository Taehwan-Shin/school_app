import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const mockWriteAudit = vi.fn();
vi.mock("../src/audit/writeAudit.js", () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryUsersDelete = vi.fn();
const mockDirectoryUsersGet = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  users: {
    delete: mockDirectoryUsersDelete,
    get: mockDirectoryUsersGet,
  },
}));
vi.mock("../src/google/directoryClient.js", () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

// Firestore mock: app-role 조회 (users 컬렉션 where('email', '==', ...))
const mockFirestoreGet = vi.fn();
const mockFirestoreLimit = vi.fn(() => ({ get: mockFirestoreGet }));
const mockFirestoreWhere = vi.fn(() => ({ limit: mockFirestoreLimit }));
const mockFirestoreCollection = vi.fn(() => ({ where: mockFirestoreWhere }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: mockFirestoreCollection }),
}));

/** 대상 이메일의 앱 role 을 지정 (없으면 empty snapshot). */
function setTargetAppRole(role: string | null): void {
  if (role === null) {
    mockFirestoreGet.mockResolvedValueOnce({ empty: true, docs: [] });
  } else {
    mockFirestoreGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ role }) }],
    });
  }
}

import { usersDelete } from "../src/callable/users/delete.js";

describe("usersDelete unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  });

  function createRequest(options: {
    data?: any;
    email?: string;
    role?: any;
    googleAccessToken?: string | null;
    requestId?: string;
    auth?: boolean;
    scopes?: string;
  } = {}) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : "admin@cam.hs.kr";
    const role = "role" in options ? options.role : "admin";
    const googleAccessToken = "googleAccessToken" in options ? options.googleAccessToken : "valid-google-token";
    const requestId = options.requestId !== undefined ? options.requestId : "req-test-delete-123";
    const scopes = options.scopes !== undefined ? options.scopes : "https://www.googleapis.com/auth/admin.directory.user";

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers["x-google-access-token"] = googleAccessToken;
    }
    if (requestId) {
      headers["x-request-id"] = requestId;
    }
    if (scopes) {
      headers["x-google-scopes"] = scopes;
    }

    const defaultData = {
      primaryEmail: "targetstudent@cam.hs.kr",
    };

    return {
      data: options.data !== undefined ? options.data : defaultData,
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
            uid: "uid-admin-123",
          }
        : null,
      rawRequest: {
        headers,
      },
    } as any;
  }

  it("allows admin to delete regular user and writes ok audit log", async () => {
    setTargetAppRole(null); // 대상 사용자는 앱에 등록 안 됨 (Firestore 없음)
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "targetstudent@cam.hs.kr",
        isAdmin: false,
      },
    });
    mockDirectoryUsersDelete.mockResolvedValueOnce({ data: {} });

    const req = createRequest({ email: "admin@cam.hs.kr", role: "admin" });
    const result = await usersDelete.run(req);

    expect(result).toEqual({
      primaryEmail: "targetstudent@cam.hs.kr",
      deleted: true,
    });

    expect(mockDirectoryUsersGet).toHaveBeenCalledWith({ userKey: "targetstudent@cam.hs.kr" });
    expect(mockDirectoryUsersDelete).toHaveBeenCalledWith({ userKey: "targetstudent@cam.hs.kr" });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.delete",
      target: "targetstudent@cam.hs.kr",
      request_id: "req-test-delete-123",
      result: "ok",
      message: "deleted user",
    });
  });

  it("allows super_admin to delete any user (including admin) without target admin check blocking", async () => {
    mockDirectoryUsersDelete.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "super@cam.hs.kr",
      role: "super_admin",
      data: { primaryEmail: "otheradmin@cam.hs.kr" },
    });
    const result = await usersDelete.run(req);

    expect(result).toEqual({
      primaryEmail: "otheradmin@cam.hs.kr",
      deleted: true,
    });

    expect(mockDirectoryUsersDelete).toHaveBeenCalledWith({ userKey: "otheradmin@cam.hs.kr" });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "super@cam.hs.kr",
        role: "super_admin",
        action: "users.delete",
        target: "otheradmin@cam.hs.kr",
        result: "ok",
      }),
    );
  });

  it("blocks self-delete with cannot_delete_self and writes denied audit", async () => {
    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: { primaryEmail: "admin@cam.hs.kr" },
    });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "failed-precondition",
      message: "cannot_delete_self",
    });

    expect(mockDirectoryUsersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.delete",
      target: "admin@cam.hs.kr",
      request_id: "req-test-delete-123",
      result: "denied",
      message: "cannot_delete_self",
    });
  });

  it("blocks admin from deleting a Workspace admin (isAdmin=true) with admin_cannot_delete_admin", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "workspaceadmin@cam.hs.kr",
        isAdmin: true,
      },
    });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: { primaryEmail: "workspaceadmin@cam.hs.kr" },
    });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "permission-denied",
      message: "admin_cannot_delete_admin",
    });

    expect(mockDirectoryUsersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.delete",
      target: "workspaceadmin@cam.hs.kr",
      request_id: "req-test-delete-123",
      result: "denied",
      message: "admin_cannot_delete_admin",
    });
  });

  // 회귀 방지: 앱 super_admin (Firestore custom claim) 은 Workspace isAdmin 이 아닐 수 있다.
  // 이전엔 이 경우 무방비였음 — Codex 감사 0d8f4562f47c 지적.
  it("blocks admin from deleting an app super_admin (Firestore role) even when Workspace isAdmin=false", async () => {
    setTargetAppRole("super_admin"); // 앱은 super_admin, 워크스페이스는 일반
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "appsuperadmin@cam.hs.kr",
        isAdmin: false,
      },
    });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: { primaryEmail: "appsuperadmin@cam.hs.kr" },
    });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "permission-denied",
      message: "admin_cannot_delete_admin",
    });

    expect(mockDirectoryUsersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin@cam.hs.kr",
        role: "admin",
        target: "appsuperadmin@cam.hs.kr",
        result: "denied",
        message: "admin_cannot_delete_admin",
      }),
    );
  });

  // 앱에 없고 워크스페이스도 관리자 아니면 admin 이 삭제 가능
  it("allows admin to delete a user with app role=teacher and Workspace isAdmin=false", async () => {
    setTargetAppRole("teacher");
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "teacher1@cam.hs.kr",
        isAdmin: false,
      },
    });
    mockDirectoryUsersDelete.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: { primaryEmail: "teacher1@cam.hs.kr" },
    });

    await usersDelete.run(req);
    expect(mockDirectoryUsersDelete).toHaveBeenCalledWith({ userKey: "teacher1@cam.hs.kr" });
  });

  it("handles googleapis error and writes error audit log", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "targetstudent@cam.hs.kr",
        isAdmin: false,
      },
    });
    mockDirectoryUsersDelete.mockRejectedValueOnce(new Error("Google Directory 404 User not found"));

    const req = createRequest({ email: "admin@cam.hs.kr", role: "admin" });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "unknown",
      message: "Google Directory 404 User not found",
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.delete",
      target: "targetstudent@cam.hs.kr",
      request_id: "req-test-delete-123",
      result: "error",
      message: "Google Directory 404 User not found",
    });
  });

  it("rejects invalid email domain with invalid-argument", async () => {
    const req = createRequest({
      data: { primaryEmail: "user@otherdomain.com" },
    });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(mockDirectoryUsersDelete).not.toHaveBeenCalled();
  });

  it("rejects teacher role with permission-denied and writes denied audit", async () => {
    const req = createRequest({ email: "teacher@cam.hs.kr", role: "teacher" });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "teacher@cam.hs.kr",
      role: "teacher",
      action: "users.delete",
      target: "targetstudent@cam.hs.kr",
      request_id: "req-test-delete-123",
      result: "denied",
      message: "users.delete",
    });
  });

  it("rejects request with insufficient scope", async () => {
    const req = createRequest({
      scopes: "https://www.googleapis.com/auth/admin.directory.user.readonly",
    });

    await expect(usersDelete.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "denied",
      }),
    );
  });
});
