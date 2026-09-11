import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const mockWriteAudit = vi.fn();
vi.mock("../src/audit/writeAudit.js", () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryUsersInsert = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  users: {
    insert: mockDirectoryUsersInsert,
  },
}));
vi.mock("../src/google/directoryClient.js", () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { usersCreate } from "../src/callable/users/create.js";

describe("usersCreate unit tests", () => {
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
    const requestId = options.requestId !== undefined ? options.requestId : "req-test-create-123";
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
      primaryEmail: "newstudent@cam.hs.kr",
      givenName: "동",
      familyName: "홍",
      password: "password1234",
      orgUnitPath: "/학생/1학년",
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

  it("allows admin to create user and writes ok audit log", async () => {
    mockDirectoryUsersInsert.mockResolvedValueOnce({
      data: {
        id: "created-user-uid-999",
        primaryEmail: "newstudent@cam.hs.kr",
      },
    });

    const req = createRequest({ email: "admin@cam.hs.kr", role: "admin" });
    const result = await usersCreate.run(req);

    expect(result).toEqual({
      primaryEmail: "newstudent@cam.hs.kr",
      uid: "created-user-uid-999",
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith("valid-google-token");
    expect(mockDirectoryUsersInsert).toHaveBeenCalledWith({
      requestBody: {
        primaryEmail: "newstudent@cam.hs.kr",
        name: {
          givenName: "동",
          familyName: "홍",
        },
        password: "password1234",
        orgUnitPath: "/학생/1학년",
        changePasswordAtNextLogin: true,
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "newstudent@cam.hs.kr",
      request_id: "req-test-create-123",
      result: "ok",
      message: "created user",
    });
  });

  it("allows super_admin to create user", async () => {
    mockDirectoryUsersInsert.mockResolvedValueOnce({
      data: {
        id: "created-uid-super",
        primaryEmail: "newstudent@cam.hs.kr",
      },
    });

    const req = createRequest({ email: "super@cam.hs.kr", role: "super_admin" });
    const result = await usersCreate.run(req);

    expect(result.uid).toBe("created-uid-super");
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "super@cam.hs.kr",
        role: "super_admin",
        result: "ok",
      }),
    );
  });

  // v0.132b F106: 입력 검증 실패는 이제 result="denied" (orgunitsCreate 대칭).
  // 이전 result="error" 는 upstream 실패와 구분 안 됐던 취급이었음.
  it("rejects invalid email domain with invalid-argument and writes denied audit", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "other@gmail.com",
        givenName: "길동",
        familyName: "홍",
        password: "password1234",
      },
    });

    await expect(usersCreate.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
    });

    expect(mockDirectoryUsersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin@cam.hs.kr",
        role: "admin",
        action: "users.write",
        target: "other@gmail.com",
        result: "denied",
      }),
    );
  });

  it("rejects missing givenName with invalid-argument", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "newuser@cam.hs.kr",
        givenName: "",
        familyName: "홍",
        password: "password1234",
      },
    });

    await expect(usersCreate.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(mockDirectoryUsersInsert).not.toHaveBeenCalled();
  });

  it("rejects short password with invalid-argument", async () => {
    const req = createRequest({
      data: {
        primaryEmail: "newuser@cam.hs.kr",
        givenName: "길동",
        familyName: "홍",
        password: "short",
      },
    });

    await expect(usersCreate.run(req)).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(mockDirectoryUsersInsert).not.toHaveBeenCalled();
  });

  it("handles googleapis error and writes error audit log", async () => {
    mockDirectoryUsersInsert.mockRejectedValueOnce(new Error("Google Directory 409 User already exists"));

    const req = createRequest({ email: "admin@cam.hs.kr", role: "admin" });

    await expect(usersCreate.run(req)).rejects.toMatchObject({
      code: "unknown",
      message: "Google Directory 409 User already exists",
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "admin@cam.hs.kr",
      role: "admin",
      action: "users.write",
      target: "newstudent@cam.hs.kr",
      request_id: "req-test-create-123",
      result: "error",
      message: "Google Directory 409 User already exists",
    });
  });

  it("rejects teacher with permission-denied and writes denied audit", async () => {
    const req = createRequest({ email: "teacher@cam.hs.kr", role: "teacher" });

    await expect(usersCreate.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: "teacher@cam.hs.kr",
      role: "teacher",
      action: "users.write",
      target: "newstudent@cam.hs.kr",
      request_id: "req-test-create-123",
      result: "denied",
      message: "users.write",
    });
  });

  it("rejects when scope is insufficient", async () => {
    const req = createRequest({
      scopes: "https://www.googleapis.com/auth/admin.directory.user.readonly",
    });

    await expect(usersCreate.run(req)).rejects.toMatchObject({
      code: "permission-denied",
    });

    expect(mockDirectoryUsersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "denied",
      }),
    );
  });

  // v0.132b F106 (== v0.121b F98 대칭): Directory 계정 생성이 이미 성공했으나
  // writeAudit 이 실패하면 callable 은 성공 응답 (primaryEmail + uid) 을 반환해야
  // 재시도 시 중복 충돌을 피한다. Cloud Logging fallback 은 console.error 로 남는다.
  it("F106: insert 성공 후 writeAudit 실패 → 성공 응답 반환 · Cloud Logging fallback", async () => {
    mockDirectoryUsersInsert.mockResolvedValueOnce({
      data: {
        id: "created-user-uid-777",
        primaryEmail: "newstudent@cam.hs.kr",
      },
    });
    // ok 감사 3회 재시도 모두 실패.
    mockWriteAudit.mockRejectedValue(new Error("firestore_unavailable"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const req = createRequest({ email: "admin@cam.hs.kr", role: "admin" });
    const result = await usersCreate.run(req);

    expect(result).toEqual({
      primaryEmail: "newstudent@cam.hs.kr",
      uid: "created-user-uid-777",
    });
    // ok 감사가 3회 시도.
    const okCalls = mockWriteAudit.mock.calls.filter(
      (c: any[]) => c[0]?.result === "ok",
    );
    expect(okCalls.length).toBe(3);
    // Cloud Logging fallback.
    const logged = errSpy.mock.calls.find(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("users_create_audit_write_failed"),
    );
    expect(logged).toBeDefined();
    errSpy.mockRestore();
  });
});
