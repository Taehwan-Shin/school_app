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

import { callUsersDelete, useDeleteUser } from "../src/api/usersDelete.js";

describe("usersDelete API & Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue("firebase-id-token-abc");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("callUsersDelete", () => {
    it("throws error when user is not authenticated", async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callUsersDelete({ primaryEmail: "target@cam.hs.kr" }),
      ).rejects.toThrow("not_authenticated");
    });

    it("sends delete request with headers and body", async () => {
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
              deleted: true,
            },
          }),
        } as any;
      });

      const result = await callUsersDelete({ primaryEmail: "target@cam.hs.kr" });

      expect(result).toEqual({
        primaryEmail: "target@cam.hs.kr",
        deleted: true,
      });

      expect(capturedUrl).toContain("/usersDelete");
      expect((capturedInit?.headers as any)["Authorization"]).toBe("Bearer firebase-id-token-abc");
      expect((capturedInit?.headers as any)["X-Google-Access-Token"]).toBe("mock-google-access-token");
      expect((capturedInit?.headers as any)["X-Google-Scopes"]).toBe(
        "https://www.googleapis.com/auth/admin.directory.user",
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.primaryEmail).toBe("target@cam.hs.kr");
    });

    it("throws structured error on non-ok HTTP response", async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: "cannot_delete_self" },
          }),
        } as any;
      });

      await expect(
        callUsersDelete({ primaryEmail: "admin@cam.hs.kr" }),
      ).rejects.toMatchObject({
        message: "cannot_delete_self",
        status: 400,
      });
    });
  });

  describe("useDeleteUser Hook", () => {
    it("executes mutation and invalidates users list cache on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: { primaryEmail: "target@cam.hs.kr", deleted: true },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteUser(), { wrapper });

      await result.current.mutateAsync({ primaryEmail: "target@cam.hs.kr" });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users", "list"] });
      });
    });
  });
});
