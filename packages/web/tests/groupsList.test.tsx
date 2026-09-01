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

import { callGroupsList, useGroupsList } from '../src/api/groupsList.js';

describe('groupsList API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callGroupsList', () => {
    it('throws error when user is not authenticated', async () => {
      mockAuthObj.currentUser = null;
      await expect(callGroupsList()).rejects.toThrow('not_authenticated');
    });

    it('fetches groups list with correct headers and parses response', async () => {
      const mockGroups = [
        {
          email: 'teachers@cam.hs.kr',
          name: '교사 전체',
          description: '교직원 안내용 그룹',
          aliases: ['all-teachers@cam.hs.kr'],
          directMembersCount: 42,
        },
        {
          email: 'grade1@cam.hs.kr',
          name: '1학년 교사',
          description: '1학년 담당 교사',
          aliases: [],
          directMembersCount: 15,
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { groups: mockGroups } }),
      });
      global.fetch = fetchMock as any;

      const result = await callGroupsList();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/asia-northeast3/groupsList');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-id-token-abc',
        'X-Google-Access-Token': 'mock-google-access-token',
        'X-Google-Scopes': 'https://www.googleapis.com/auth/admin.directory.group.readonly',
      });
      expect(options.headers['X-Request-Id']).toBeDefined();
      expect(JSON.parse(options.body)).toEqual({ data: {} });
      expect(result).toEqual({ groups: mockGroups });
    });

    it('throws server error message on non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied: not enough capability' } }),
      });
      global.fetch = fetchMock as any;

      await expect(callGroupsList()).rejects.toThrow('permission-denied: not enough capability');
    });
  });

  describe('useGroupsList Hook', () => {
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

    it('successfully loads groups list', async () => {
      const mockGroups = [
        {
          email: 'teachers@cam.hs.kr',
          name: '교사 전체',
          description: '교직원 안내용 그룹',
          aliases: ['all-teachers@cam.hs.kr'],
          directMembersCount: 42,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { groups: mockGroups } }),
      }) as any;

      const { result } = renderHook(() => useGroupsList(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.groups).toHaveLength(1);
      expect(result.current.data?.groups[0].email).toBe('teachers@cam.hs.kr');
      expect(result.current.data?.groups[0].directMembersCount).toBe(42);
    });

    it('handles query error state', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied' } }),
      }) as any;

      const { result } = renderHook(() => useGroupsList(true, { retry: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe('permission-denied');
    });

    it('respects enabled=false', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useGroupsList(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does NOT retry on 4xx (permission-denied) to avoid duplicating denied audit logs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied' } }),
      });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useGroupsList(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

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
          json: async () => ({ result: { groups: [] } }),
        });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useGroupsList(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
