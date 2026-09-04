import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BasicDataYear } from '@school-app/shared';

const mockCurrentUser = {
  email: 'admin@cam.hs.kr',
  getIdToken: vi.fn(),
};

const mockAuthObj = {
  currentUser: mockCurrentUser as any,
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

vi.mock('../src/lib/auth.js', () => ({
  getGoogleAccessTokenFromSession: vi.fn(() => 'mock-google-access-token'),
}));

import { useBasicDataGet } from '../src/api/basicDataGet.js';

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

describe('basicDataGet API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('200 response with null data returns data = { data: null }', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    global.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: { data: null },
        }),
      } as any;
    });

    const { result } = renderHook(() => useBasicDataGet(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ data: null });
    expect(capturedUrl).toContain('/asia-northeast3/basicDataGet');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBeUndefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        year: 2026,
        _googleAccessToken: 'mock-google-access-token',
      },
    });
  });

  it('200 response with existing data returns data.data = { year, grades: [...] }', async () => {
    const mockBasicData: BasicDataYear = {
      year: 2026,
      grades: [
        { grade: 1, classes: ['1', '2', '3'] },
        { grade: 2, classes: ['1', '2'] },
      ],
      updatedAt: 1788480000000,
      updatedBy: 'admin@cam.hs.kr',
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: { data: mockBasicData },
      }),
    })) as any;

    const { result } = renderHook(() => useBasicDataGet(2026), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual(mockBasicData);
    expect(result.current.data?.data?.year).toBe(2026);
    expect(result.current.data?.data?.grades).toHaveLength(2);
    expect(result.current.data?.data?.updatedBy).toBe('admin@cam.hs.kr');
  });
});
