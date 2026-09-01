import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

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

import {
  callGroupsMembersList,
  useGroupMembersList,
  type GroupMemberItem,
} from '../src/api/groupsMembersList.js';

describe('groupsMembersList API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-xyz');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callGroupsMembersList', () => {
    it('throws error when user is not authenticated', async () => {
      mockAuthObj.currentUser = null;
      await expect(
        callGroupsMembersList({ groupEmail: 'group-a@cam.hs.kr' })
      ).rejects.toThrow('not_authenticated');
    });

    it('fetches group members with correct headers and request body', async () => {
      const mockMembers: GroupMemberItem[] = [
        {
          email: 'member1@cam.hs.kr',
          role: 'OWNER',
          type: 'USER',
          status: 'ACTIVE',
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            members: mockMembers,
            nextPageToken: 'next-page-token-1',
          },
        }),
      });
      global.fetch = fetchMock as any;

      const result = await callGroupsMembersList({
        groupEmail: 'group-a@cam.hs.kr',
        pageToken: 'prev-token',
        maxResults: 50,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/asia-northeast3/groupsMembersList');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-id-token-xyz',
        'X-Google-Access-Token': 'mock-google-access-token',
        'X-Google-Scopes':
          'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
      });
      expect(options.headers['X-Request-Id']).toBeDefined();
      expect(JSON.parse(options.body)).toEqual({
        data: {
          groupEmail: 'group-a@cam.hs.kr',
          pageToken: 'prev-token',
          maxResults: 50,
          _googleAccessToken: 'mock-google-access-token',
        },
      });
      expect(result).toEqual({
        members: mockMembers,
        nextPageToken: 'next-page-token-1',
      });
    });

    it('throws server error message on non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'permission-denied: requires admin role' },
        }),
      });
      global.fetch = fetchMock as any;

      await expect(
        callGroupsMembersList({ groupEmail: 'group-a@cam.hs.kr' })
      ).rejects.toThrow('permission-denied: requires admin role');
    });
  });

  describe('useGroupMembersList Hook', () => {
    it('successfully loads initial page of group members', async () => {
      const mockMembers: GroupMemberItem[] = [
        {
          email: 'member1@cam.hs.kr',
          role: 'OWNER',
          type: 'USER',
          status: 'ACTIVE',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            members: mockMembers,
            nextPageToken: 'token-page-2',
          },
        }),
      }) as any;

      const { result } = renderHook(() =>
        useGroupMembersList('group-a@cam.hs.kr', 25)
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.members).toEqual(mockMembers);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('appends next page entries on loadMore and refreshes on reload', async () => {
      const page1: GroupMemberItem[] = [
        {
          email: 'member1@cam.hs.kr',
          role: 'OWNER',
          type: 'USER',
          status: 'ACTIVE',
        },
      ];
      const page2: GroupMemberItem[] = [
        {
          email: 'member2@cam.hs.kr',
          role: 'MEMBER',
          type: 'USER',
          status: 'ACTIVE',
        },
      ];
      const reloaded: GroupMemberItem[] = [
        {
          email: 'member1@cam.hs.kr',
          role: 'OWNER',
          type: 'USER',
          status: 'ACTIVE',
        },
        {
          email: 'member3@cam.hs.kr',
          role: 'MANAGER',
          type: 'USER',
          status: 'ACTIVE',
        },
      ];

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { members: page1, nextPageToken: 'token-page-2' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { members: page2, nextPageToken: null },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { members: reloaded, nextPageToken: null },
          }),
        });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() =>
        useGroupMembersList('group-a@cam.hs.kr', 25)
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.members).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);

      // Trigger loadMore
      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => expect(result.current.members).toHaveLength(2));
      expect(result.current.members[1].email).toBe('member2@cam.hs.kr');
      expect(result.current.hasMore).toBe(false);

      // Trigger reload
      act(() => {
        result.current.reload();
      });

      await waitFor(() => expect(result.current.members).toHaveLength(2));
      expect(result.current.members[1].email).toBe('member3@cam.hs.kr');
    });
  });
});
