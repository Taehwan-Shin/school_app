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

import { callClassroomCreate, useClassroomCreate } from '../src/api/classroomCreate';

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

describe('classroomCreate API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 시나리오 1: 200 응답 -> data.course · id 확인
  it('scenario 1: 200 response returns created course with id and invalidates classroom list query', async () => {
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
            course: {
              id: 'course-new-123',
              name: '2026학년도 1학년 1반 수학',
              section: '1학기',
              ownerId: 'me',
              courseState: 'PROVISIONED',
            },
          },
        }),
      } as any;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClassroomCreate(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationResult = await result.current.mutateAsync({
      name: '2026학년도 1학년 1반 수학',
      section: '1학기',
      ownerId: 'me',
      courseState: 'PROVISIONED',
    });

    expect(mutationResult).toEqual({
      course: {
        id: 'course-new-123',
        name: '2026학년도 1학년 1반 수학',
        section: '1학기',
        ownerId: 'me',
        courseState: 'PROVISIONED',
      },
    });

    expect(capturedUrl).toContain('/asia-northeast3/classroomCreate');
    expect((capturedInit?.headers as any)['Authorization']).toBe('Bearer firebase-id-token-abc');
    expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe('mock-google-access-token');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe(
      'https://www.googleapis.com/auth/classroom.courses',
    );
    expect((capturedInit?.headers as any)['X-Request-Id']).toBeDefined();

    const parsedBody = JSON.parse(capturedInit?.body as string);
    expect(parsedBody).toEqual({
      data: {
        name: '2026학년도 1학년 1반 수학',
        section: '1학기',
        ownerId: 'me',
        courseState: 'PROVISIONED',
        _googleAccessToken: 'mock-google-access-token',
      },
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classroom', 'list'] });
    });
  });

  // 시나리오 2: 400 응답 (name 오류) -> hook throws · status 400
  it('scenario 2: 400 response causes hook to throw with status 400', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'invalid_name' },
      }),
    })) as any;

    const { result } = renderHook(() => useClassroomCreate(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ name: '' }),
    ).rejects.toMatchObject({
      message: 'invalid_name',
      status: 400,
    });
  });

  it('throws error when user is not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callClassroomCreate({ name: '테스트' }),
    ).rejects.toThrow('not_authenticated');
  });

  it('passes domain-scoped alias id in request body when provided', async () => {
    let capturedBody: any;
    global.fetch = vi.fn(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            course: { id: 'c-alias', name: '알리아스 코스' },
          },
        }),
      } as any;
    });

    const res = await callClassroomCreate({
      id: 'd:2026-1-1',
      name: '알리아스 코스',
    });

    expect(res.course.id).toBe('c-alias');
    expect(capturedBody.data.id).toBe('d:2026-1-1');
  });
});
