import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCurrentUser = {
  email: 'admin@cam.hs.kr',
  getIdToken: vi.fn(),
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

const mockAuthObj = {
  currentUser: mockCurrentUser as any,
};

vi.mock('../src/lib/auth.js', () => ({
  getGoogleAccessTokenFromSession: vi.fn(() => 'mock-google-access-token'),
}));

import {
  callGroupsMembersUpdate,
  useUpdateMemberRole,
} from '../src/api/groupsMembersUpdate.js';

describe('groupsMembersUpdate API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callGroupsMembersUpdate', () => {
    it('throws error when user is not authenticated', async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callGroupsMembersUpdate({
          groupEmail: 'group-a@cam.hs.kr',
          memberEmail: 'member1@cam.hs.kr',
          role: 'MANAGER',
        })
      ).rejects.toThrow('not_authenticated');
    });

    it('sends update member request with correct headers and body', async () => {
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
              groupEmail: 'group-a@cam.hs.kr',
              memberEmail: 'member1@cam.hs.kr',
              role: 'MANAGER',
            },
          }),
        } as any;
      });

      const result = await callGroupsMembersUpdate({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'member1@cam.hs.kr',
        role: 'MANAGER',
      });

      expect(result).toEqual({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'member1@cam.hs.kr',
        role: 'MANAGER',
      });

      expect(capturedUrl).toContain('/asia-northeast3/groupsMembersUpdate');
      expect((capturedInit?.headers as any)['Authorization']).toBe(
        'Bearer firebase-id-token-abc'
      );
      expect((capturedInit?.headers as any)['X-Google-Access-Token']).toBe(
        'mock-google-access-token'
      );
      expect((capturedInit?.headers as any)['X-Google-Scopes']).toBe(
        'https://www.googleapis.com/auth/admin.directory.group.member'
      );

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.groupEmail).toBe('group-a@cam.hs.kr');
      expect(parsedBody.data.memberEmail).toBe('member1@cam.hs.kr');
      expect(parsedBody.data.role).toBe('MANAGER');
      expect(parsedBody.data._googleAccessToken).toBe('mock-google-access-token');
    });

    it('throws structured error on non-ok HTTP response', async () => {
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'cannot_downgrade_last_owner' },
        }),
      } as any));

      await expect(
        callGroupsMembersUpdate({
          groupEmail: 'group-a@cam.hs.kr',
          memberEmail: 'owner@cam.hs.kr',
          role: 'MEMBER',
        })
      ).rejects.toMatchObject({
        message: 'cannot_downgrade_last_owner',
        status: 400,
      });
    });
  });

  describe('useUpdateMemberRole Hook', () => {
    it('executes mutation and invalidates groups members cache on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            groupEmail: 'group-a@cam.hs.kr',
            memberEmail: 'member1@cam.hs.kr',
            role: 'OWNER',
          },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateMemberRole('group-a@cam.hs.kr'), { wrapper });

      await result.current.mutateAsync({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'member1@cam.hs.kr',
        role: 'OWNER',
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['groups', 'members', 'group-a@cam.hs.kr'],
        });
      });
    });
  });
});
