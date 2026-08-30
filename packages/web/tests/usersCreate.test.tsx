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

import { callUsersCreate, useCreateUser } from "../src/api/usersCreate.js";

describe("usersCreate API & Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue("firebase-id-token-abc");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("callUsersCreate", () => {
    it("throws error when user is not authenticated", async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callUsersCreate({
          primaryEmail: "new@cam.hs.kr",
          givenName: "동",
          familyName: "홍",
          password: "password1234",
        }),
      ).rejects.toThrow("not_authenticated");
    });

    it("sends create request with headers and body", async () => {
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
              primaryEmail: "new@cam.hs.kr",
              uid: "created-uid-123",
            },
          }),
        } as any;
      });

      const result = await callUsersCreate({
        primaryEmail: "new@cam.hs.kr",
        givenName: "동",
        familyName: "홍",
        password: "password1234",
        orgUnitPath: "/학생/1학년",
        changePasswordAtNextLogin: true,
      });

      expect(result).toEqual({
        primaryEmail: "new@cam.hs.kr",
        uid: "created-uid-123",
      });

      expect(capturedUrl).toContain("/usersCreate");
      expect((capturedInit?.headers as any)["Authorization"]).toBe("Bearer firebase-id-token-abc");
      expect((capturedInit?.headers as any)["X-Google-Access-Token"]).toBe("mock-google-access-token");
      expect((capturedInit?.headers as any)["X-Google-Scopes"]).toBe(
        "https://www.googleapis.com/auth/admin.directory.user",
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.primaryEmail).toBe("new@cam.hs.kr");
      expect(parsedBody.data.password).toBe("password1234");
    });

    it("throws structured error on non-ok HTTP response", async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: "invalid_email_domain" },
          }),
        } as any;
      });

      await expect(
        callUsersCreate({
          primaryEmail: "new@other.com",
          givenName: "동",
          familyName: "홍",
          password: "password1234",
        }),
      ).rejects.toMatchObject({
        message: "invalid_email_domain",
        status: 400,
      });
    });
  });

  describe("useCreateUser Hook", () => {
    it("executes mutation and invalidates users list cache on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: { primaryEmail: "new@cam.hs.kr", uid: "created-uid-123" },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateUser(), { wrapper });

      await result.current.mutateAsync({
        primaryEmail: "new@cam.hs.kr",
        givenName: "동",
        familyName: "홍",
        password: "password1234",
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users", "list"] });
      });
    });
  });
});
