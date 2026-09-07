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
  callChatMembersAdd,
  useChatMembersAdd,
} from '../src/api/chatMembersAdd';

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

describe('chatMembersAdd API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 시나리오 1: 200 응답 -> data.member & invalidate query
  it('scenario 1: 200 response returns member and invalidates chat members query', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockMember = {
      name: 'spaces/space-1/members/usr-123',
      member: {
        name: 'users/usr-123',
        type: 'HUMAN',
        displayName: '홍길동',
      },
      role: 'ROLE_MEMBER',
      state: 'JOINED',
    };

    global.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            member: mockMember,
          },
        }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useChatMembersAdd(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationResult = await result.current.mutateAsync({
      spaceName: 'spaces/space-1',
      email: 'user1@cam.hs.kr',
    });

    expect(mutationResult).toEqual({
      member: mockMember,
    });

    expect(capturedUrl).toContain('/asia-northeast3/chatMembersAdd');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe(
      'https://www.googleapis.com/auth/chat.memberships https://www.googleapis.com/auth/admin.directory.user.readonly',
    );
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        spaceName: 'spaces/space-1',
        email: 'user1@cam.hs.kr',
        _googleAccessToken: 'mock-google-access-token',
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['chat', 'members', 'spaces/space-1'],
      });
    });
  });

  // 시나리오 2: 400 응답 -> throws
  it('scenario 2: 400 response causes hook to throw and reports error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'invalid_argument' },
      }),
    })) as any;

    const { result } = renderHook(() => useChatMembersAdd(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ spaceName: 'spaces/space-1', email: 'invalid-email' }),
    ).rejects.toMatchObject({
      message: 'invalid_argument',
      status: 400,
    });
  });

  it('throws error when user is not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callChatMembersAdd({ spaceName: 'spaces/space-1', email: 'user1@cam.hs.kr' }),
    ).rejects.toThrow('not_authenticated');
  });
});
