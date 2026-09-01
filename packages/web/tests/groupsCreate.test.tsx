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

import { callGroupsCreate, useCreateGroup } from "../src/api/groupsCreate.js";

describe("groupsCreate API & Hook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue("firebase-id-token-abc");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("callGroupsCreate", () => {
    // 1. not_authenticated -> throw
    it("throws error when user is not authenticated", async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callGroupsCreate({
          email: "team-a@cam.hs.kr",
          name: "Team A",
          description: "Team A group",
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
            email: "team-a@cam.hs.kr",
            id: "group-id-123",
          },
        }),
      } as any));

      const result = await callGroupsCreate({
        email: "team-a@cam.hs.kr",
        name: "Team A",
        description: "Team A group",
      });

      expect(result).toEqual({
        email: "team-a@cam.hs.kr",
        id: "group-id-123",
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
        callGroupsCreate({
          email: "team-a@cam.hs.kr",
          name: "Team A",
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
              email: "team-a@cam.hs.kr",
              id: "group-id-123",
            },
          }),
        } as any;
      });

      await callGroupsCreate({
        email: "team-a@cam.hs.kr",
        name: "Team A",
        description: "Test Group",
      });

      expect(capturedUrl).toContain("/groupsCreate");
      expect((capturedInit?.headers as any)["Authorization"]).toBe("Bearer firebase-id-token-abc");
      expect((capturedInit?.headers as any)["X-Google-Access-Token"]).toBe("mock-google-access-token");
      expect((capturedInit?.headers as any)["X-Google-Scopes"]).toBe(
        "https://www.googleapis.com/auth/admin.directory.group",
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data._googleAccessToken).toBe("mock-google-access-token");
      expect(parsedBody.data.email).toBe("team-a@cam.hs.kr");
      expect(parsedBody.data.name).toBe("Team A");
      expect(parsedBody.data.description).toBe("Test Group");
    });
  });

  describe("useCreateGroup Hook", () => {
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
          result: { email: "team-a@cam.hs.kr", id: "group-id-123" },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateGroup(), { wrapper });

      await result.current.mutateAsync({
        email: "team-a@cam.hs.kr",
        name: "Team A",
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["groups", "list"] });
      });
    });
  });
});
