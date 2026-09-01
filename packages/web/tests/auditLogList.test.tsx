import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockCurrentUser = {
  email: 'super@cam.hs.kr',
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

import { callAuditLogList, useAuditLogList, type AuditLogEntryRead } from '../src/api/auditLogList.js';

describe('auditLogList API & Hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = mockCurrentUser;
    mockCurrentUser.getIdToken.mockResolvedValue('firebase-id-token-xyz');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callAuditLogList', () => {
    it('throws error when user is not authenticated', async () => {
      mockAuthObj.currentUser = null;
      await expect(callAuditLogList()).rejects.toThrow('not_authenticated');
    });

    it('fetches audit logs with correct headers and parses response', async () => {
      const mockEntries: AuditLogEntryRead[] = [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.delete',
          target: 'bad@cam.hs.kr',
          request_id: 'req-12345678',
          result: 'ok',
          at: 1725150000000,
          message: 'user deleted',
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            entries: mockEntries,
            nextCursor: 1725150000000,
          },
        }),
      });
      global.fetch = fetchMock as any;

      const result = await callAuditLogList({ limit: 25, before: 1725160000000 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/asia-northeast3/auditLogList');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-id-token-xyz',
        'X-Google-Access-Token': 'mock-google-access-token',
        'X-Google-Scopes': '',
      });
      expect(options.headers['X-Request-Id']).toBeDefined();
      expect(JSON.parse(options.body)).toEqual({
        data: expect.objectContaining({
          limit: 25,
          before: 1725160000000,
          _googleAccessToken: 'mock-google-access-token',
        }),
      });
      expect(result).toEqual({
        entries: mockEntries,
        nextCursor: 1725150000000,
      });
    });

    it('throws server error message on non-ok response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'permission-denied: requires super_admin role' },
        }),
      });
      global.fetch = fetchMock as any;

      await expect(callAuditLogList()).rejects.toThrow('permission-denied: requires super_admin role');
    });
  });

  describe('useAuditLogList Hook', () => {
    it('successfully loads initial page of audit logs', async () => {
      const mockEntries: AuditLogEntryRead[] = [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.create',
          target: 'user1@cam.hs.kr',
          request_id: 'req-001',
          result: 'ok',
          at: 1725150000000,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            entries: mockEntries,
            nextCursor: 1725150000000,
          },
        }),
      }) as any;

      const { result } = renderHook(() => useAuditLogList(25));

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.entries).toEqual(mockEntries);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('appends next page entries on loadMore', async () => {
      const page1: AuditLogEntryRead[] = [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.create',
          target: 'user1@cam.hs.kr',
          request_id: 'req-001',
          result: 'ok',
          at: 1725150000000,
        },
      ];
      const page2: AuditLogEntryRead[] = [
        {
          id: 'log-2',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.delete',
          target: 'user2@cam.hs.kr',
          request_id: 'req-002',
          result: 'ok',
          at: 1725140000000,
        },
      ];

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { entries: page1, nextCursor: 1725150000000 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { entries: page2, nextCursor: null },
          }),
        });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useAuditLogList(25));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);

      // Trigger loadMore
      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => expect(result.current.entries).toHaveLength(2));
      expect(result.current.entries).toEqual([...page1, ...page2]);
      expect(result.current.hasMore).toBe(false);

      const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondCallBody.data).toEqual(
        expect.objectContaining({
          limit: 25,
          before: 1725150000000,
        }),
      );
    });

    it('does not call fetch on loadMore when hasMore is false', async () => {
      const page1: AuditLogEntryRead[] = [
        {
          id: 'log-1',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.create',
          target: 'user1@cam.hs.kr',
          request_id: 'req-001',
          result: 'ok',
          at: 1725150000000,
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { entries: page1, nextCursor: null },
        }),
      });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useAuditLogList(25));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasMore).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.loadMore();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reloads entries from beginning on reload', async () => {
      const initialEntries: AuditLogEntryRead[] = [
        {
          id: 'log-old',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.read',
          target: '*',
          request_id: 'req-000',
          result: 'ok',
          at: 1725100000000,
        },
      ];
      const reloadedEntries: AuditLogEntryRead[] = [
        {
          id: 'log-new',
          actor: 'super@cam.hs.kr',
          role: 'super_admin',
          action: 'users.create',
          target: 'new@cam.hs.kr',
          request_id: 'req-999',
          result: 'ok',
          at: 1725200000000,
        },
      ];

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { entries: initialEntries, nextCursor: null },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { entries: reloadedEntries, nextCursor: null },
          }),
        });
      global.fetch = fetchMock as any;

      const { result } = renderHook(() => useAuditLogList(25));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.entries).toEqual(initialEntries);

      act(() => {
        result.current.reload();
      });

      await waitFor(() => expect(result.current.entries).toEqual(reloadedEntries));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondCallBody.data).toEqual(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it('handles initial load error properly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'permission-denied' } }),
      }) as any;

      const { result } = renderHook(() => useAuditLogList(25));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error?.message).toBe('permission-denied');
      expect(result.current.entries).toEqual([]);
    });
  });
});
