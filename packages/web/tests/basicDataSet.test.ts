import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BasicDataSetRequest, BasicDataSetResponse } from '../src/api/basicDataSet.js';

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

import { useBasicDataSet } from '../src/api/basicDataSet.js';

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('basicDataSet API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('200 response sets basic_data and hook returns { year, updatedAt }', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockResponse: BasicDataSetResponse = {
      year: 2026,
      updatedAt: 1788480000000,
    };

    global.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: mockResponse,
        }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useBasicDataSet(), {
      wrapper: createWrapper(queryClient),
    });

    const requestPayload: BasicDataSetRequest = {
      year: 2026,
      grades: [
        { grade: 1, classes: ['1', '2', '3'] },
        { grade: 2, classes: ['1', '2'] },
      ],
    };

    const res = await result.current.mutateAsync(requestPayload);

    expect(res).toEqual(mockResponse);
    await waitFor(() => expect(result.current.data).toEqual(mockResponse));
    expect(capturedUrl).toContain('/asia-northeast3/basicDataSet');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        year: 2026,
        grades: [
          { grade: 1, classes: ['1', '2', '3'] },
          { grade: 2, classes: ['1', '2'] },
        ],
        _googleAccessToken: 'mock-google-access-token',
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['basic_data', 'get', 2026],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['basic_data', 'list_years'],
      });
    });
  });

  it('400 response (invalid_basic_data) causes hook to throw error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'invalid_basic_data' },
      }),
    })) as any;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useBasicDataSet(), {
      wrapper: createWrapper(queryClient),
    });

    const requestPayload: BasicDataSetRequest = {
      year: 2026,
      grades: [],
    };

    await expect(result.current.mutateAsync(requestPayload)).rejects.toThrow('invalid_basic_data');
  });

  it('onSuccess invalidates both basic_data.get and basic_data.list_years queries', async () => {
    const mockResponse: BasicDataSetResponse = {
      year: 2027,
      updatedAt: 1788480000000,
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: mockResponse,
      }),
    })) as any;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useBasicDataSet(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      year: 2027,
      grades: [{ grade: 1, classes: ['1'] }],
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['basic_data', 'get', 2027],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['basic_data', 'list_years'],
      });
    });
  });
});
