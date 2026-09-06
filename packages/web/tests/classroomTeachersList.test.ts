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
  callClassroomTeachersList,
  useClassroomTeachersList,
} from '../src/api/classroomTeachersList';

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

describe('classroomTeachersList API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 시나리오 1: 200 응답 -> hook data.teachers
  it('scenario 1: 200 response returns data.teachers with expected request format', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockTeachers = [
      {
        courseId: 'c-101',
        userId: 'teacher-1',
        profile: {
          name: { fullName: '김교사' },
          emailAddress: 'teacher1@cam.hs.kr',
        },
      },
      {
        courseId: 'c-101',
        userId: 'teacher-2',
        profile: {
          name: { fullName: '이교사' },
          emailAddress: 'teacher2@cam.hs.kr',
        },
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
            teachers: mockTeachers,
          },
        }),
      } as any;
    });

    const { result } = renderHook(() => useClassroomTeachersList('c-101'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.teachers).toEqual(mockTeachers);
    expect(capturedUrl).toContain('/asia-northeast3/classroomTeachersList');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe(
      'https://www.googleapis.com/auth/classroom.rosters',
    );
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        courseId: 'c-101',
        _googleAccessToken: 'mock-google-access-token',
      },
    });
  });

  // 시나리오 2: 401 응답 -> hook throws / reports error
  it('scenario 2: 401 response causes hook to report error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'unauthenticated' },
      }),
    })) as any;

    const { result } = renderHook(() => useClassroomTeachersList('c-101'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('unauthenticated');
    expect((result.current.error as any)?.status).toBe(401);
  });

  it('throws error when user is not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(callClassroomTeachersList({ courseId: 'c-101' })).rejects.toThrow(
      'not_authenticated',
    );
  });
});
