import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const mockWriteAudit = vi.fn();
vi.mock("../src/audit/writeAudit.js", () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryUsersPatch = vi.fn();
const mockDirectoryUsersGet = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  users: {
    patch: mockDirectoryUsersPatch,
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

import { usersUpdate } from "../src/callable/users/update.js";

describe("usersUpdate unit tests", () => {
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
    const googleAccessToken =
      "googleAccessToken" in options ? options.googleAccessToken : "valid-google-token";
    const requestId =
      options.requestId !== undefined ? options.requestId : "req-test-update-123";
    const scopes =
      options.scopes !== undefined
        ? options.scopes
        : "https://www.googleapis.com/auth/admin.directory.user";

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
      firstName: "길동",
      lastName: "홍",
      orgUnitPath: "/학생/1학년",
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

  // 1. 인증 실패 -> denied audit + throw
  it("rejects unauthenticated request and writes denied audit", async () => {
    const req = createRequest({ auth: false, email: "unknown", role: "unknown" });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "unknown",
        role: "unknown",
        action: "users.write",
        target: "targetstudent@cam.hs.kr",
        result: "denied",
      }),
    );
  });

  // 2. cap 없음 (teacher) -> denied audit + throw
  it("rejects teacher role with permission-denied and writes denied audit", async () => {
    const req = createRequest({ email: "teacher@cam.hs.kr", role: "teacher" });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "teacher@cam.hs.kr",
      role: "teacher",
      action: "users.write",
      target: "targetstudent@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "denied",
      message: "users.write",
    });
  });

  // 3. scopes 없음 -> denied audit + throw
  it("rejects request with insufficient scope", async () => {
    const req = createRequest({
      scopes: "https://www.googleapis.com/auth/admin.directory.user.readonly",
    });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "denied",
      }),
    );
  });

  // 4. 이메일 검증 실패 (도메인 불일치) -> error audit + throw
  it("rejects invalid email domain with invalid-argument and writes error audit", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "other@gmail.com",
        firstName: "새이름",
      },
    });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin@cam.hs.kr",
        role: "admin",
        action: "users.write",
        target: "other@gmail.com",
        result: "error",
      }),
    );
  });

  // 5. 편집 필드 없음 -> error audit (no_fields_to_update) + throw
  it("rejects request with no editable fields and writes error audit", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "targetstudent@cam.hs.kr",
        firstName: "   ",
        lastName: "",
      },
    });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
      message: "no_fields_to_update",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin@cam.hs.kr",
        role: "admin",
        action: "users.write",
        target: "targetstudent@cam.hs.kr",
        result: "error",
        message: "no_fields_to_update",
      }),
    );
  });

  // 6. admin 이 workspace admin 편집 시도 -> permission-denied audit + throw
  it("blocks admin from editing a Workspace admin (isAdmin=true) with admin_cannot_edit_admin", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "workspaceadmin@cam.hs.kr",
        isAdmin: true,
        name: { givenName: "Work", familyName: "Admin" },
        orgUnitPath: "/",
      },
    });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "workspaceadmin@cam.hs.kr",
        firstName: "NewName",
      },
    });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "permission-denied",
      message: "admin_cannot_edit_admin",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "workspaceadmin@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "denied",
      message: "admin_cannot_edit_admin",
    });
  });

  // 7. super_admin 이 workspace admin 편집 성공
  it("allows super_admin to edit workspace admin and writes ok audit", async () => {
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "workspaceadmin@cam.hs.kr",
        isAdmin: true,
        name: { givenName: "Work", familyName: "Admin" },
        orgUnitPath: "/",
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "super@cam.hs.kr",
      role: "super_admin",
      data: {
        primaryEmail: "workspaceadmin@cam.hs.kr",
        firstName: "UpdatedName",
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "workspaceadmin@cam.hs.kr",
      updatedFields: ["firstName"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "workspaceadmin@cam.hs.kr",
      requestBody: {
        name: { givenName: "UpdatedName" },
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "super@cam.hs.kr",
        role: "super_admin",
        action: "users.write",
        target: "workspaceadmin@cam.hs.kr",
        result: "ok",
      }),
    );
  });

  // 8. admin 이 일반 사용자 편집 성공 (firstName 만)
  it("allows admin to edit regular user firstName only and logs before/after in audit", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "student@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "OldGiven", familyName: "Family" },
        orgUnitPath: "/학생",
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "student@cam.hs.kr",
        firstName: "NewGiven",
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "student@cam.hs.kr",
      updatedFields: ["firstName"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        name: { givenName: "NewGiven" },
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "student@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "ok",
      message: `updated fields: firstName | before: ${JSON.stringify({
        firstName: "OldGiven",
        lastName: "Family",
        orgUnitPath: "/학생",
      })} | after: ${JSON.stringify({
        name: { givenName: "NewGiven" },
      })}`,
    });
  });

  // 9. admin 이 일반 사용자 편집 성공 (orgUnitPath 만 — / 자동 prefix)
  it("allows admin to edit regular user orgUnitPath only with auto / prefix", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "student@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "Given", familyName: "Family" },
        orgUnitPath: "/",
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "student@cam.hs.kr",
        orgUnitPath: "교직원/행정",
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "student@cam.hs.kr",
      updatedFields: ["orgUnitPath"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        orgUnitPath: "/교직원/행정",
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "ok",
        message: expect.stringContaining("/교직원/행정"),
      }),
    );
  });

  // 10. 자기 자신 편집 성공 (admin 이 자기 이름 변경)
  it("allows admin to edit self even if user has admin privileges", async () => {
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "admin@cam.hs.kr",
        isAdmin: true,
        name: { givenName: "AdminGiven", familyName: "AdminFamily" },
        orgUnitPath: "/",
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "admin@cam.hs.kr",
        firstName: "NewSelfName",
        lastName: "NewSelfFamily",
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "admin@cam.hs.kr",
      updatedFields: ["firstName", "lastName"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "admin@cam.hs.kr",
      requestBody: {
        name: {
          givenName: "NewSelfName",
          familyName: "NewSelfFamily",
        },
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin@cam.hs.kr",
        role: "admin",
        target: "admin@cam.hs.kr",
        result: "ok",
      }),
    );
  });

  // 11. admin 이 app super_admin (Firestore role) 편집 시도 -> permission-denied audit
  it("blocks admin from editing an app super_admin (Firestore role) even when Workspace isAdmin=false", async () => {
    setTargetAppRole("super_admin");
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "appsuperadmin@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "App", familyName: "Super" },
        orgUnitPath: "/",
      },
    });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "appsuperadmin@cam.hs.kr",
        firstName: "Hacked",
      },
    });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "permission-denied",
      message: "admin_cannot_edit_admin",
    });

    expect(mockDirectoryUsersPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin@cam.hs.kr",
        role: "admin",
        target: "appsuperadmin@cam.hs.kr",
        result: "denied",
        message: "admin_cannot_edit_admin",
      }),
    );
  });

  // 12. Directory API error -> error audit + throw
  it("handles googleapis error and writes error audit log", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "student@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "Old", familyName: "Name" },
        orgUnitPath: "/",
      },
    });
    mockDirectoryUsersPatch.mockRejectedValueOnce(
      new Error("Google Directory 500 Internal Error"),
    );

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "student@cam.hs.kr",
        firstName: "NewName",
      },
    });

    await expect(usersUpdate.run(req)).rejects.toMatchObject({
      code: "unknown",
      message: "Google Directory 500 Internal Error",
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "student@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "error",
      message: "Google Directory 500 Internal Error",
    });
  });

  // 13. admin 이 일반 사용자 정지 (suspended=true 만 편집)
  it("allows admin to suspend regular user with suspended=true and writes ok audit", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "student@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "Given", familyName: "Family" },
        orgUnitPath: "/학생",
        suspended: false,
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "student@cam.hs.kr",
        suspended: true,
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "student@cam.hs.kr",
      updatedFields: ["suspended"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        suspended: true,
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "student@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "ok",
      message: `updated fields: suspended | before: ${JSON.stringify({
        firstName: "Given",
        lastName: "Family",
        orgUnitPath: "/학생",
        suspended: false,
      })} | after: ${JSON.stringify({
        suspended: true,
      })}`,
    });
  });

  // 14. admin 이 일반 사용자 복구 (suspended=false 만 편집)
  it("allows admin to restore suspended regular user with suspended=false and writes ok audit", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "student@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "Given", familyName: "Family" },
        orgUnitPath: "/학생",
        suspended: true,
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "student@cam.hs.kr",
        suspended: false,
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "student@cam.hs.kr",
      updatedFields: ["suspended"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        suspended: false,
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "student@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "ok",
      message: `updated fields: suspended | before: ${JSON.stringify({
        firstName: "Given",
        lastName: "Family",
        orgUnitPath: "/학생",
        suspended: true,
      })} | after: ${JSON.stringify({
        suspended: false,
      })}`,
    });
  });

  // 15. admin 이 firstName + suspended 함께 편집
  it("allows admin to edit firstName and suspended together and writes ok audit", async () => {
    setTargetAppRole(null);
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "student@cam.hs.kr",
        isAdmin: false,
        name: { givenName: "OldName", familyName: "Family" },
        orgUnitPath: "/학생",
        suspended: false,
      },
    });
    mockDirectoryUsersPatch.mockResolvedValueOnce({ data: {} });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: {
        primaryEmail: "student@cam.hs.kr",
        firstName: "NewName",
        suspended: true,
      },
    });

    const result = await usersUpdate.run(req);

    expect(result).toEqual({
      primaryEmail: "student@cam.hs.kr",
      updatedFields: ["firstName", "suspended"],
    });

    expect(mockDirectoryUsersPatch).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        name: { givenName: "NewName" },
        suspended: true,
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "student@cam.hs.kr",
      request_id: "req-test-update-123",
      result: "ok",
      message: `updated fields: firstName, suspended | before: ${JSON.stringify({
        firstName: "OldName",
        lastName: "Family",
        orgUnitPath: "/학생",
        suspended: false,
      })} | after: ${JSON.stringify({
        name: { givenName: "NewName" },
        suspended: true,
      })}`,
    });
  });
});
