import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const mockWriteAudit = vi.fn();
vi.mock("../src/audit/writeAudit.js", () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryUsersUpdate = vi.fn();
const mockDirectoryUsersPatch = vi.fn();
const mockDirectoryUsersGet = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  users: {
    update: mockDirectoryUsersUpdate,
    patch: mockDirectoryUsersPatch,
    get: mockDirectoryUsersGet,
  },
}));
vi.mock("../src/google/directoryClient.js", () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

const mockFirestoreGet = vi.fn();
const mockFirestoreLimit = vi.fn(() => ({ get: mockFirestoreGet }));
const mockFirestoreWhere = vi.fn(() => ({ limit: mockFirestoreLimit }));
const mockFirestoreCollection = vi.fn(() => ({ where: mockFirestoreWhere }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: mockFirestoreCollection }),
}));

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

import { usersResetPassword } from "../src/callable/users/resetPassword.js";

describe("usersResetPassword unit tests", () => {
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
      options.requestId !== undefined ? options.requestId : "req-test-reset-123";
    const scopes =
      options.scopes !== undefined
        ? options.scopes
        : "https://www.googleapis.com/auth/admin.directory.user.security";

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
      newPassword: "newpassword1234",
      changePasswordAtNextLogin: true,
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

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "unauthenticated",
    });

    expect(mockDirectoryUsersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "unknown",
        role: "unknown",
        action: "users.reset_password",
        target: "targetstudent@cam.hs.kr",
        result: "denied",
      }),
    );
  });

  // 2. cap 없음 (teacher) -> denied audit + throw
  it("rejects teacher role with permission-denied and writes denied audit", async () => {
    const req = createRequest({ email: "teacher@cam.hs.kr", role: "teacher" });

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "teacher@cam.hs.kr",
      role: "teacher",
      action: "users.reset_password",
      target: "targetstudent@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "denied",
      message: expect.any(String),
    });
  });

  // 3. scopes 없음 (admin.directory.user.security 부재) -> denied audit + throw
  it("rejects missing user.security scope with permission-denied and writes denied audit", async () => {
    const req = createRequest({
      scopes: "https://www.googleapis.com/auth/admin.directory.user",
    });

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.reset_password",
      target: "targetstudent@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "denied",
      message: expect.stringContaining("admin.directory.user.security"),
    });
  });

  // 4. 이메일 검증 실패 (도메인) -> error audit
  it("rejects invalid email domain with invalid-argument and writes error audit", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "student@otherdomain.com",
        newPassword: "newpassword1234",
      },
    });

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
      message: "invalid_email_domain",
    });

    expect(mockDirectoryUsersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.reset_password",
      target: "student@otherdomain.com",
      request_id: "req-test-reset-123",
      result: "error",
      message: "invalid_email_domain",
    });
  });

  // 5. 비밀번호 짧음 (< 8 자) -> error password_too_short
  it("rejects password shorter than 8 chars with password_too_short", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "student@cam.hs.kr",
        newPassword: "short",
      },
    });

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
      message: "password_too_short",
    });

    expect(mockDirectoryUsersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.reset_password",
      target: "student@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "error",
      message: "password_too_short",
    });
  });

  // 6. admin 이 workspace admin 재설정 시도 -> permission-denied
  it("blocks admin from resetting a workspace admin and writes denied audit", async () => {
    const req = createRequest({
      email: "admin1@cam.hs.kr",
      data: {
        primaryEmail: "admin2@cam.hs.kr",
        newPassword: "newpassword1234",
      },
    });

    setTargetAppRole("teacher");
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: { primaryEmail: "admin2@cam.hs.kr", isAdmin: true },
    });

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "permission-denied",
      message: "admin_cannot_edit_admin",
    });

    expect(mockDirectoryUsersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin1@cam.hs.kr",
      role: "admin",
      action: "users.reset_password",
      target: "admin2@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "denied",
      message: "admin_cannot_edit_admin",
    });
  });

  // 7. super_admin 이 workspace admin 재설정 -> 성공
  it("allows super_admin to reset workspace admin password", async () => {
    const req = createRequest({
      email: "superadmin@cam.hs.kr",
      role: "super_admin",
      data: {
        primaryEmail: "admin2@cam.hs.kr",
        newPassword: "newpassword1234",
      },
    });

    mockDirectoryUsersUpdate.mockResolvedValueOnce({
      data: { primaryEmail: "admin2@cam.hs.kr" },
    });

    const res = await usersResetPassword.run(req);

    expect(res).toEqual({
      primaryEmail: "admin2@cam.hs.kr",
      passwordReset: true,
    });

    expect(mockDirectoryUsersGet).not.toHaveBeenCalled();
    expect(mockDirectoryUsersUpdate).toHaveBeenCalledWith({
      userKey: "admin2@cam.hs.kr",
      requestBody: {
        password: "newpassword1234",
        changePasswordAtNextLogin: true,
      },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "superadmin@cam.hs.kr",
      role: "super_admin",
      action: "users.reset_password",
      target: "admin2@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "ok",
      message: "password reset (changeOnNextLogin: true)",
    });
  });

  // 8. admin + 일반 사용자 -> 성공, audit 에 비밀번호 값 없음 확인
  it("allows admin to reset normal user password and never writes password to audit log", async () => {
    const secretPassword = "superSecretPassword987!";
    const req = createRequest({
      data: {
        primaryEmail: "student@cam.hs.kr",
        newPassword: secretPassword,
        changePasswordAtNextLogin: true,
      },
    });

    setTargetAppRole("teacher");
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: { primaryEmail: "student@cam.hs.kr", isAdmin: false },
    });
    mockDirectoryUsersUpdate.mockResolvedValueOnce({
      data: { primaryEmail: "student@cam.hs.kr" },
    });

    const res = await usersResetPassword.run(req);

    expect(res).toEqual({
      primaryEmail: "student@cam.hs.kr",
      passwordReset: true,
    });

    expect(mockDirectoryUsersUpdate).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        password: secretPassword,
        changePasswordAtNextLogin: true,
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.reset_password",
      target: "student@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "ok",
      message: "password reset (changeOnNextLogin: true)",
    });

    // 보안 검증: 어떤 audit 호출 인자에도 패스워드 원문이 포함되지 않아야 함
    for (const call of mockWriteAudit.mock.calls) {
      const stringified = JSON.stringify(call);
      expect(stringified).not.toContain(secretPassword);
    }
  });

  // 9. admin + changePasswordAtNextLogin=false -> 성공 (audit message 반영)
  it("supports changePasswordAtNextLogin=false and reflects it in audit log", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "student@cam.hs.kr",
        newPassword: "newpassword1234",
        changePasswordAtNextLogin: false,
      },
    });

    setTargetAppRole("teacher");
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: { primaryEmail: "student@cam.hs.kr", isAdmin: false },
    });
    mockDirectoryUsersUpdate.mockResolvedValueOnce({
      data: { primaryEmail: "student@cam.hs.kr" },
    });

    const res = await usersResetPassword.run(req);

    expect(res).toEqual({
      primaryEmail: "student@cam.hs.kr",
      passwordReset: true,
    });

    expect(mockDirectoryUsersUpdate).toHaveBeenCalledWith({
      userKey: "student@cam.hs.kr",
      requestBody: {
        password: "newpassword1234",
        changePasswordAtNextLogin: false,
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "ok",
        action: "users.reset_password",
        message: "password reset (changeOnNextLogin: false)",
      }),
    );
  });

  // 10. Directory API 오류 -> error audit
  it("handles Directory API error and writes error audit", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "student@cam.hs.kr",
        newPassword: "newpassword1234",
      },
    });

    setTargetAppRole("teacher");
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: { primaryEmail: "student@cam.hs.kr", isAdmin: false },
    });
    mockDirectoryUsersUpdate.mockRejectedValueOnce(new Error("directory_internal_error"));

    await expect(usersResetPassword.run(req)).rejects.toMatchObject({
      code: "unknown",
      message: "directory_internal_error",
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.reset_password",
      target: "student@cam.hs.kr",
      request_id: "req-test-reset-123",
      result: "error",
      message: "directory_internal_error",
    });
  });
});
