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

import { callUsersUpdate, useUpdateUser } from "../src/api/usersUpdate.js";

describe("usersUpdate API & Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue("firebase-id-token-abc");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("callUsersUpdate", () => {
    it("throws error when user is not authenticated", async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callUsersUpdate({ primaryEmail: "target@cam.hs.kr", firstName: "철수" }),
      ).rejects.toThrow("not_authenticated");
    });

    it("sends update request with headers and body and returns updatedFields", async () => {
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
              updatedFields: ["firstName", "lastName"],
            },
          }),
        } as any;
      });

      const result = await callUsersUpdate({
        primaryEmail: "target@cam.hs.kr",
        firstName: "철수",
        lastName: "김",
      });

      expect(result).toEqual({
        primaryEmail: "target@cam.hs.kr",
        updatedFields: ["firstName", "lastName"],
      });

      expect(capturedUrl).toContain("/usersUpdate");
      expect((capturedInit?.headers as any)["Authorization"]).toBe("Bearer firebase-id-token-abc");
      expect((capturedInit?.headers as any)["X-Google-Access-Token"]).toBe("mock-google-access-token");
      expect((capturedInit?.headers as any)["X-Google-Scopes"]).toBe(
        "https://www.googleapis.com/auth/admin.directory.user",
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.primaryEmail).toBe("target@cam.hs.kr");
      expect(parsedBody.data.firstName).toBe("철수");
      expect(parsedBody.data.lastName).toBe("김");
    });

    it("throws 403 permission-denied error when admin_cannot_edit_admin", async () => {
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
        callUsersUpdate({ primaryEmail: "otheradmin@cam.hs.kr", firstName: "수정" }),
      ).rejects.toMatchObject({
        message: "admin_cannot_edit_admin",
        status: 403,
      });
    });

    it("throws 400 no_fields_to_update error on empty update fields", async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: "no_fields_to_update" },
          }),
        } as any;
      });

      await expect(
        callUsersUpdate({ primaryEmail: "target@cam.hs.kr" }),
      ).rejects.toMatchObject({
        message: "no_fields_to_update",
        status: 400,
      });
    });
  });

  describe("useUpdateUser Hook", () => {
    it("executes mutation and invalidates users list cache on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: { primaryEmail: "target@cam.hs.kr", updatedFields: ["orgUnitPath"] },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateUser(), { wrapper });

      await result.current.mutateAsync({
        primaryEmail: "target@cam.hs.kr",
        orgUnitPath: "/교사",
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users", "list"] });
      });
    });
  });
});
