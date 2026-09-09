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

import { callUsersUpdateRole, useUsersUpdateRole } from '../src/api/usersUpdateRole';

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('usersUpdateRole API & Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.getIdToken.mockResolvedValue('id-token-mock');
    globalThis.fetch = vi.fn();
  });

  // 시나리오 1: callable 결과 파싱 및 반환.
  it('scenario 1: parses response body.result and returns UsersUpdateRoleResponse', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { primaryEmail: 'target@cam.hs.kr', uid: 'uid-1', role: 'admin' },
      }),
    });

    const res = await callUsersUpdateRole({
      primaryEmail: 'target@cam.hs.kr',
      role: 'admin',
    });
    expect(res).toEqual({ primaryEmail: 'target@cam.hs.kr', uid: 'uid-1', role: 'admin' });
  });

  // 시나리오 2: 에러 응답에 status 필드 부여.
  it('scenario 2: throws Error with status when response not ok', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'permission-denied' } }),
    });
    await expect(
      callUsersUpdateRole({ primaryEmail: 'target@cam.hs.kr', role: 'admin' }),
    ).rejects.toMatchObject({ message: 'permission-denied' });
  });

  // 시나리오 3: 헤더에 idToken · x-google-access-token · request-id 포함.
  it('scenario 3: sends idToken and google access token headers', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ result: { primaryEmail: 't@cam.hs.kr', uid: 'u', role: 'teacher' } }),
    });
    await callUsersUpdateRole({ primaryEmail: 't@cam.hs.kr', role: 'teacher' });

    const [, opts] = (globalThis.fetch as any).mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer id-token-mock');
    expect(opts.headers['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect(typeof opts.headers['X-Request-Id']).toBe('string');
    const parsed = JSON.parse(opts.body);
    expect(parsed.data.primaryEmail).toBe('t@cam.hs.kr');
    expect(parsed.data.role).toBe('teacher');
  });

  // 시나리오 4: hook 성공 시 users list query 무효화.
  it('scenario 4: useUsersUpdateRole invalidates users list on success', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ result: { primaryEmail: 't@cam.hs.kr', uid: 'u', role: 'admin' } }),
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUsersUpdateRole(), { wrapper: Wrapper });
    await result.current.mutateAsync({ primaryEmail: 't@cam.hs.kr', role: 'admin' });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'list'] }),
    );
  });

  // 시나리오 5: 로그아웃 상태 (currentUser null) → not_authenticated.
  it('scenario 5: throws not_authenticated when no current user', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callUsersUpdateRole({ primaryEmail: 'target@cam.hs.kr', role: 'admin' }),
    ).rejects.toThrow('not_authenticated');
    mockAuthObj.currentUser = mockCurrentUser as any;
  });
});
