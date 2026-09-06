import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCurrentUser = {
  email: 'super@cam.hs.kr',
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

import { useAuditLogSummary } from '../src/api/auditLogSummary';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('auditLogSummary API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('scenario 1: 200 response returns data.count, data.entries, data.snapshotAt, and data.generatedAt', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockEntries = [
      {
        id: 'doc-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin' as const,
        action: 'users.create',
        target: 'user@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok' as const,
        at: 1700000000000,
        message: 'created user',
      },
    ];

    global.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            count: 42,
            entries: mockEntries,
            snapshotAt: 1700000040000,
            generatedAt: 1700000050000,
          },
        }),
      } as any;
    });

    const atMin = 1700000000000;
    const { result } = renderHook(() => useAuditLogSummary({ atMin }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      count: 42,
      entries: mockEntries,
      snapshotAt: 1700000040000,
      generatedAt: 1700000050000,
    });
    expect(capturedUrl).toContain('/asia-northeast3/auditLogSummary');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        atMin,
        _googleAccessToken: 'mock-google-access-token',
      },
    });
  });

  it('scenario 2: 401 response causes hook to report error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'unauthenticated' },
      }),
    })) as any;

    const { result } = renderHook(() => useAuditLogSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('unauthenticated');
    expect((result.current.error as any)?.status).toBe(401);
  });
});
