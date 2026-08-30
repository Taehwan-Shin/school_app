import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCurrentUser = {
  email: 'admin@cam.hs.kr',
  getIdToken: vi.fn(),
};

vi.mock('../src/lib/firebase.js', () => ({
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

vi.mock('../src/lib/auth.js', () => ({
  getGoogleAccessTokenFromSession: vi.fn(() => 'mock-google-access-token'),
}));

import { callUsersList, useUsersList } from '../src/api/usersList.js';

describe('usersList API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callUsersList', () => {
    it('throws error when user is not authenticated', async () => {
      mockAuthObj.currentUser = null;
      await expect(callUsersList()).rejects.toThrow('not_authenticated');
    });

    it('fetches users list with correct headers and parses response', async () => {
      const mockUsers = [
        {
          email: 'teacher@cam.hs.kr',
          firstName: '길동',
          lastName: '홍',
          orgUnitPath: '/교사',
          isAdmin: false,
          isSuspended: false,
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { users: mockUsers } }),
      });
      global.fetch = fetchMock as any;

      const result = await callUsersList();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/asia-northeast3/usersList');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-id-token-abc',
        'X-Google-Access-Token': 'mock-google-access-token',
        'X-Google-Scopes': 'https://www.googleapis.com/auth/admin.directory.user.readonly',
      });
      expect(options.headers['X-Request-Id']).toBeDefined();
      expect(JSON.parse(options.body)).toEqual({ data: {} });
      expect(result).toEqual({ users: mockUsers });
    });

    it('throws server error message on non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied: not enough capability' } }),
      });
      global.fetch = fetchMock as any;

      await expect(callUsersList()).rejects.toThrow('permission-denied: not enough capability');
    });
  });

  describe('useUsersList Hook', () => {
    function createWrapper() {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    }

    it('successfully loads user list', async () => {
      const mockUsers = [
        {
          email: 'admin@cam.hs.kr',
          firstName: '관리',
          lastName: '김',
          orgUnitPath: '/',
          isAdmin: true,
          isSuspended: false,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { users: mockUsers } }),
      }) as any;

      const { result } = renderHook(() => useUsersList(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.users).toHaveLength(1);
      expect(result.current.data?.users[0].email).toBe('admin@cam.hs.kr');
    });

    it('handles query error state', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied' } }),
      }) as any;

      const { result } = renderHook(() => useUsersList(true, { retry: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe('permission-denied');
    });

    it('respects enabled=false', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useUsersList(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // 회귀 방지: 4xx 는 재시도하지 않는다 — 서버가 이미 denied/permission-denied 감사를
    // 남긴 상태이므로 재시도 시 감사 로그가 중복 생성된다.
    it('does NOT retry on 4xx (permission-denied) to avoid duplicating denied audit logs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied' } }),
      });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useUsersList(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // fetch 는 정확히 한 번만 — 4xx 는 재시도 없음
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx (transient server error)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'server-error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { users: [] } }),
        });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useUsersList(true), {
        wrapper: createWrapper(),
      });

      // TanStack Query 기본 retryDelay 는 지수 backoff (첫 대기 ~1s).
      // 테스트가 그 대기를 커버할 수 있도록 timeout 을 넉넉히.
      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
