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

  it("blocks admin from deleting another admin/super_admin with admin_cannot_delete_admin", async () => {
    mockDirectoryUsersGet.mockResolvedValueOnce({
      data: {
        primaryEmail: "superadmin@cam.hs.kr",
        isAdmin: true,
      },
    });

    const req = createRequest({
      email: "admin@cam.hs.kr",
      role: "admin",
      data: { primaryEmail: "superadmin@cam.hs.kr" },
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
      target: "superadmin@cam.hs.kr",
      request_id: "req-test-delete-123",
      result: "denied",
      message: "admin_cannot_delete_admin",
    });
  });

  it("handles googleapis error and writes error audit log", async () => {
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
