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

import { callGroupsDelete, useDeleteGroup } from "../src/api/groupsDelete.js";

describe("groupsDelete API & Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue("firebase-id-token-abc");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("callGroupsDelete", () => {
    // 1. not_authenticated -> throw
    it("throws error when user is not authenticated", async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callGroupsDelete({
          email: "target-group@cam.hs.kr",
        }),
      ).rejects.toThrow("not_authenticated");
    });

    // 2. 성공 - 200 응답 파싱
    it("parses 200 success response", async () => {
      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            email: "target-group@cam.hs.kr",
            deleted: true,
          },
        }),
      } as any));

      const result = await callGroupsDelete({
        email: "target-group@cam.hs.kr",
      });

      expect(result).toEqual({
        email: "target-group@cam.hs.kr",
        deleted: true,
      });
    });

    // 3. 4xx (permission-denied) -> throw
    it("throws structured error on 4xx permission-denied response", async () => {
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: "permission-denied" },
        }),
      } as any));

      await expect(
        callGroupsDelete({
          email: "target-group@cam.hs.kr",
        }),
      ).rejects.toMatchObject({
        message: "permission-denied",
        status: 403,
      });
    });

    // 4. _googleAccessToken 포함 여부 body 검증
    it("includes _googleAccessToken and correct scope in request body and headers", async () => {
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
              email: "target-group@cam.hs.kr",
              deleted: true,
            },
          }),
        } as any;
      });

      await callGroupsDelete({
        email: "target-group@cam.hs.kr",
      });

      expect(capturedUrl).toContain("/groupsDelete");
      expect((capturedInit?.headers as any)["Authorization"]).toBe("Bearer firebase-id-token-abc");
      expect((capturedInit?.headers as any)["X-Google-Access-Token"]).toBe("mock-google-access-token");
      expect((capturedInit?.headers as any)["X-Google-Scopes"]).toBe(
        "https://www.googleapis.com/auth/admin.directory.group",
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data._googleAccessToken).toBe("mock-google-access-token");
      expect(parsedBody.data.email).toBe("target-group@cam.hs.kr");
    });
  });

  describe("useDeleteGroup Hook", () => {
    // 5. hook onSuccess - invalidate groups/list
    it("executes mutation and invalidates groups list cache on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: { email: "target-group@cam.hs.kr", deleted: true },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteGroup(), { wrapper });

      await result.current.mutateAsync({
        email: "target-group@cam.hs.kr",
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["groups", "list"] });
      });
    });
  });
});
