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
  callGroupsMembersInsert,
  useAddMember,
} from '../src/api/groupsMembersInsert.js';

describe('groupsMembersInsert API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-abc');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callGroupsMembersInsert', () => {
    it('throws error when user is not authenticated', async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callGroupsMembersInsert({
          groupEmail: 'group-a@cam.hs.kr',
          memberEmail: 'new-member@cam.hs.kr',
          role: 'MEMBER',
        })
      ).rejects.toThrow('not_authenticated');
    });

    it('sends insert member request with correct headers and body', async () => {
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
              memberEmail: 'new-member@cam.hs.kr',
              role: 'MANAGER',
            },
          }),
        } as any;
      });

      const result = await callGroupsMembersInsert({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'new-member@cam.hs.kr',
        role: 'MANAGER',
      });

      expect(result).toEqual({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'new-member@cam.hs.kr',
        role: 'MANAGER',
      });

      expect(capturedUrl).toContain('/asia-northeast3/groupsMembersInsert');
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
      expect(parsedBody.data.memberEmail).toBe('new-member@cam.hs.kr');
      expect(parsedBody.data.role).toBe('MANAGER');
      expect(parsedBody.data._googleAccessToken).toBe('mock-google-access-token');
    });

    it('handles insert request without explicit role', async () => {
      let capturedInit: RequestInit | undefined;
      global.fetch = vi.fn(async (_url: any, init: any) => {
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              groupEmail: 'group-a@cam.hs.kr',
              memberEmail: 'new-member@cam.hs.kr',
              role: 'MEMBER',
            },
          }),
        } as any;
      });

      const result = await callGroupsMembersInsert({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'new-member@cam.hs.kr',
      });

      expect(result.role).toBe('MEMBER');
      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.data.role).toBeUndefined();
    });

    it('throws structured error on non-ok HTTP response', async () => {
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          error: { message: 'member_already_exists' },
        }),
      } as any));

      await expect(
        callGroupsMembersInsert({
          groupEmail: 'group-a@cam.hs.kr',
          memberEmail: 'existing@cam.hs.kr',
          role: 'MEMBER',
        })
      ).rejects.toMatchObject({
        message: 'member_already_exists',
        status: 409,
      });
    });
  });

  describe('useAddMember Hook', () => {
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
            memberEmail: 'new-member@cam.hs.kr',
            role: 'MEMBER',
          },
        }),
      } as any));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useAddMember('group-a@cam.hs.kr'), { wrapper });

      await result.current.mutateAsync({
        groupEmail: 'group-a@cam.hs.kr',
        memberEmail: 'new-member@cam.hs.kr',
        role: 'MEMBER',
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['groups', 'members', 'group-a@cam.hs.kr'],
        });
      });
    });
  });
});
