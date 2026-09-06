import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCurrentUser = {
  email: 'admin@cam.hs.kr',
  getIdToken: vi.fn(),
};

const mockAuthObj = {
  currentUser: mockCurrentUser as any,
};

vi.mock('../src/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return mockAuthObj.currentUser;
    },
  },
  app: {},
  db: {},
  functions: {},
}));

vi.mock('../src/lib/auth', () => ({
  getGoogleAccessTokenFromSession: vi.fn(() => 'mock-google-access-token'),
}));

import { callChatDelete, useDeleteChatSpace } from '../src/api/chatDelete';

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('chatDelete API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 시나리오 1: 200 응답 -> hook data.deleted === true (및 쿼리 invalidate 검증)
  it('scenario 1: 200 response returns deleted true and invalidates chat list query', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    global.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            deleted: true,
            name: 'spaces/AAAA1234',
          },
        }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteChatSpace(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationResult = await result.current.mutateAsync({
      name: 'spaces/AAAA1234',
    });

    expect(mutationResult).toEqual({
      deleted: true,
      name: 'spaces/AAAA1234',
    });

    expect(capturedUrl).toContain('/asia-northeast3/chatDelete');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe('https://www.googleapis.com/auth/chat.spaces');
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        name: 'spaces/AAAA1234',
        _googleAccessToken: 'mock-google-access-token',
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'list'] });
    });
  });

  // 시나리오 2: 404 응답 -> hook throws
  it('scenario 2: 404 response causes hook to throw and reports error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        error: { message: 'space_not_found' },
      }),
    })) as any;

    const { result } = renderHook(() => useDeleteChatSpace(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ name: 'spaces/NONEXISTENT' }),
    ).rejects.toMatchObject({
      message: 'space_not_found',
      status: 404,
    });
  });

  it('throws error when user is not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callChatDelete({ name: 'spaces/AAAA1234' }),
    ).rejects.toThrow('not_authenticated');
  });
});
