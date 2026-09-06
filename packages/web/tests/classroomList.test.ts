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

import { useClassroomList } from '../src/api/classroomList';

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

describe('classroomList API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-xyz');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('scenario 1: 200 response returns data.courses with expected request format', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockCourses = [
      {
        id: 'course-1',
        name: '1학년 1반 수학',
        section: '1학기',
        courseState: 'ACTIVE',
        alternateLink: 'https://classroom.google.com/c/course-1',
      },
      {
        id: 'course-2',
        name: '1학년 2반 영어',
        section: '1학기',
        courseState: 'ARCHIVED',
        alternateLink: 'https://classroom.google.com/c/course-2',
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
            courses: mockCourses,
          },
        }),
      } as any;
    });

    const { result } = renderHook(() => useClassroomList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.courses).toEqual(mockCourses);
    expect(capturedUrl).toContain('/asia-northeast3/classroomList');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-xyz');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe('https://www.googleapis.com/auth/classroom.courses');
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        _googleAccessToken: 'mock-google-access-token',
      },
    });
  });

  it('scenario 2: 401 response causes hook to report error with status 401', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'unauthenticated' },
      }),
    })) as any;

    const { result } = renderHook(() => useClassroomList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('unauthenticated');
    expect((result.current.error as any)?.status).toBe(401);
  });
});
