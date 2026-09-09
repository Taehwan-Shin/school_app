import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCurrentUser = {
  email: 'super@cam.hs.kr',
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

import { callUsersGetRole, useUserRole } from '../src/api/usersGetRole';

describe('usersGetRole API & Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.getIdToken.mockResolvedValue('id-token-mock');
    globalThis.fetch = vi.fn();
  });

  it('scenario 1: returns role payload from callable', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { primaryEmail: 't@cam.hs.kr', uid: 'uid-1', role: 'admin' },
      }),
    });
    const res = await callUsersGetRole('t@cam.hs.kr');
    expect(res).toEqual({ primaryEmail: 't@cam.hs.kr', uid: 'uid-1', role: 'admin' });
  });

  it('scenario 2: propagates http error with status', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'permission-denied' } }),
    });
    await expect(callUsersGetRole('t@cam.hs.kr')).rejects.toMatchObject({
      message: 'permission-denied',
    });
  });

  it('scenario 3: useUserRole is disabled when email is null', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUserRole(null), { wrapper: Wrapper });
    // 잠깐 대기 후에도 fetch 미호출.
    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
    expect(result.current.isFetching).toBe(false);
  });

  it('scenario 4: useUserRole enabled and populates data when email present', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { primaryEmail: 't@cam.hs.kr', uid: 'uid-1', role: 'teacher' },
      }),
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUserRole('t@cam.hs.kr'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.data?.role).toBe('teacher');
    });
  });
});
