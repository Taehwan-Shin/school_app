import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
  callClassroomTransferOwnership,
  useClassroomTransferOwnership,
} from '../src/api/classroomTransferOwnership';

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

describe('classroomTransferOwnership API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('scenario 1: 200 response returns course + addedAsTeacher, hits transferOwnership endpoint', async () => {
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
            course: { id: 'c-101', ownerId: 'newowner@cam.hs.kr' },
            addedAsTeacher: false,
          },
        }),
      } as any;
    });

    const { result } = renderHook(() => useClassroomTransferOwnership(), {
      wrapper: createWrapper(),
    });
    const mutationResult = await result.current.mutateAsync({
      courseId: 'c-101',
      newOwnerEmail: 'newowner@cam.hs.kr',
    });

    expect(mutationResult).toEqual({
      course: { id: 'c-101', ownerId: 'newowner@cam.hs.kr' },
      addedAsTeacher: false,
    });
    expect(capturedUrl).toContain('/asia-northeast3/classroomTransferOwnership');
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toContain(
      'classroom.courses',
    );
    expect((capturedInit?.headers as any)['X-Google-Scopes']).toContain(
      'classroom.rosters',
    );
  });

  // v0.116d F77 회귀: fetch 계층이 body.error.details 를 Error.details 로 보존해
  // partial 실패의 rollback 상태를 UI 에 전달한다.
  it('scenario 2: preserves body.error.details on failure (partial rollback state)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          message: 'added_teacher_but_patch_failed:google_upstream_unavailable',
          details: {
            addedTeacherButPatchFailed: true,
            rollback: 'skipped',
            newOwnerEmail: 'newowner@cam.hs.kr',
            underlying: 'google_upstream_unavailable',
          },
        },
      }),
    })) as any;

    try {
      await callClassroomTransferOwnership({
        courseId: 'c-101',
        newOwnerEmail: 'newowner@cam.hs.kr',
      });
      throw new Error('expected throw');
    } catch (err: any) {
      expect(err.status).toBe(500);
      expect(err.message).toContain('added_teacher_but_patch_failed');
      expect(err.details).toMatchObject({
        addedTeacherButPatchFailed: true,
        rollback: 'skipped',
        newOwnerEmail: 'newowner@cam.hs.kr',
      });
    }
  });

  it('throws when not authenticated', async () => {
    mockAuthObj.currentUser = null;
    await expect(
      callClassroomTransferOwnership({
        courseId: 'c-101',
        newOwnerEmail: 'x@cam.hs.kr',
      }),
    ).rejects.toThrow('not_authenticated');
  });
});
