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

import { callChatCreate, useCreateChatSpace } from '../src/api/chatCreate';

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

describe('chatCreate API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 시나리오 1: 200 응답 -> hook data.space (및 헤더·바디 검증)
  it('scenario 1: 200 response returns created space and invalidates chat list query', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockSpace = {
      name: 'spaces/AAAA1234',
      displayName: '2026년 1학년 A반',
      spaceType: 'SPACE',
      createTime: '2026-09-06T10:00:00Z',
    };

    global.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            space: mockSpace,
          },
        }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateChatSpace(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationResult = await result.current.mutateAsync({
      displayName: '2026년 1학년 A반',
    });

    expect(mutationResult).toEqual({
      space: mockSpace,
    });

    expect(capturedUrl).toContain('/asia-northeast3/chatCreate');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe('https://www.googleapis.com/auth/chat.spaces');
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        displayName: '2026년 1학년 A반',
        _googleAccessToken: 'mock-google-access-token',
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'list'] });
    });
  });

  // 시나리오 2: 400 응답 -> hook throws
  it('scenario 2: 400 response causes hook to throw and reports error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'display_name_required' },
      }),
    })) as any;

    const { result } = renderHook(() => useCreateChatSpace(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ displayName: '' }),
    ).rejects.toMatchObject({
      message: 'display_name_required',
      status: 400,
    });
  });

  it('throws error when user is not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callChatCreate({ displayName: '테스트방' }),
    ).rejects.toThrow('not_authenticated');
  });
});
