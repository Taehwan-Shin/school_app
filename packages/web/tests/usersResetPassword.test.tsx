import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCurrentUser = {
  email: "admin@cam.hs.kr",
  getIdToken: vi.fn(),
};

vi.mock("../src/lib/firebase.js", () => ({
  auth: {
    get currentUser() {
      return mockAuthObj.currentUser;
    },
  },
  app: {},
  db: {},
  functions: {},
}));

const mockAuthObj = {
  currentUser: mockCurrentUser as any,
};

vi.mock("../src/lib/auth.js", () => ({
  getGoogleAccessTokenFromSession: vi.fn(() => "mock-google-access-token"),
}));

import { callUsersResetPassword, useResetPassword } from "../src/api/usersResetPassword.js";

describe("usersResetPassword API & Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue("firebase-id-token-abc");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("callUsersResetPassword", () => {
    it("throws error when user is not authenticated", async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callUsersResetPassword({
          primaryEmail: "target@cam.hs.kr",
          newPassword: "newpassword1234",
        }),
      ).rejects.toThrow("not_authenticated");
    });

    it("sends reset password request with headers and body and returns passwordReset true", async () => {
      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;

      global.fetch = vi.fn(async (url: any, init: any) => {
        capturedUrl = url.toString();
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              primaryEmail: "target@cam.hs.kr",
              passwordReset: true,
            },
          }),
        } as any;
      });

      const result = await callUsersResetPassword({
        primaryEmail: "target@cam.hs.kr",
        newPassword: "newpassword1234",
        changePasswordAtNextLogin: true,
      });

      expect(result).toEqual({
        primaryEmail: "target@cam.hs.kr",
        passwordReset: true,
      });

      expect(capturedUrl).toContain("/usersResetPassword");
      expect((capturedInit?.headers as any)["Authorization"]).toBe("Bearer firebase-id-token-abc");
      expect((capturedInit?.headers as any)["X-Google-Access-Token"]).toBe("mock-google-access-token");
      expect((capturedInit?.headers as any)["X-Google-Scopes"]).toBe(
        "https://www.googleapis.com/auth/admin.directory.user.security",
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.primaryEmail).toBe("target@cam.hs.kr");
      expect(parsedBody.data.newPassword).toBe("newpassword1234");
      expect(parsedBody.data.changePasswordAtNextLogin).toBe(true);
      expect(parsedBody.data._googleAccessToken).toBe("mock-google-access-token");
    });

    it("sends body with changePasswordAtNextLogin false when specified", async () => {
      let capturedInit: RequestInit | undefined;

      global.fetch = vi.fn(async (_url: any, init: any) => {
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              primaryEmail: "target@cam.hs.kr",
              passwordReset: true,
            },
          }),
        } as any;
      });

      const result = await callUsersResetPassword({
        primaryEmail: "target@cam.hs.kr",
        newPassword: "newpassword1234",
        changePasswordAtNextLogin: false,
      });

      expect(result).toEqual({
        primaryEmail: "target@cam.hs.kr",
        passwordReset: true,
      });

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.changePasswordAtNextLogin).toBe(false);
    });

    it("throws 403 permission-denied error when admin cannot edit admin", async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: { message: "admin_cannot_edit_admin" },
          }),
        } as any;
      });

      await expect(
        callUsersResetPassword({
          primaryEmail: "otheradmin@cam.hs.kr",
          newPassword: "newpassword1234",
        }),
      ).rejects.toMatchObject({
        message: "admin_cannot_edit_admin",
        status: 403,
      });
    });
  });

  describe("useResetPassword Hook", () => {
    it("executes mutation successfully", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: { primaryEmail: "target@cam.hs.kr", passwordReset: true },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useResetPassword(), { wrapper });

      const res = await result.current.mutateAsync({
        primaryEmail: "target@cam.hs.kr",
        newPassword: "newpassword1234",
      });

      await waitFor(() => {
        expect(res).toEqual({
          primaryEmail: "target@cam.hs.kr",
          passwordReset: true,
        });
      });
    });
  });
});
