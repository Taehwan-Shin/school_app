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

import {
  callChatMembersDelete,
  useChatMembersDelete,
} from '../src/api/chatMembersDelete';

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

describe('chatMembersDelete API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 시나리오 1: 200 응답 -> data.ok & invalidate query
  it('scenario 1: 200 response returns ok and invalidates chat members query', async () => {
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
            ok: true,
          },
        }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useChatMembersDelete(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationResult = await result.current.mutateAsync({
      memberName: 'spaces/space-1/members/usr-123',
    });

    expect(mutationResult).toEqual({
      ok: true,
    });

    expect(capturedUrl).toContain('/asia-northeast3/chatMembersDelete');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe(
      'https://www.googleapis.com/auth/chat.memberships',
    );
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        memberName: 'spaces/space-1/members/usr-123',
        _googleAccessToken: 'mock-google-access-token',
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['chat', 'members', 'spaces/space-1'],
      });
    });
  });

  // 시나리오 2: 404 응답 -> throws
  it('scenario 2: 404 response causes hook to throw and reports error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        error: { message: 'google_upstream_not_found: Member not found' },
      }),
    })) as any;

    const { result } = renderHook(() => useChatMembersDelete(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ memberName: 'spaces/space-1/members/usr-404' }),
    ).rejects.toMatchObject({
      message: 'google_upstream_not_found: Member not found',
      status: 404,
    });
  });

  it('throws error when user is not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callChatMembersDelete({ memberName: 'spaces/space-1/members/usr-123' }),
    ).rejects.toThrow('not_authenticated');
  });
});
