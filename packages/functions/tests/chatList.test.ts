import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockChatSpacesList = vi.fn();
const mockGetChatClient = vi.fn(() => ({
  spaces: {
    list: mockChatSpacesList,
  },
}));
vi.mock('../src/google/chatClient.js', () => ({
  getChatClient: (...args: any[]) => mockGetChatClient(...args),
}));

import { chatList } from '../src/callable/chat/list.js';

describe('chatList unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      email?: string;
      role?: any;
      googleAccessToken?: string | null;
      requestId?: string;
      auth?: boolean;
      scopes?: string | null;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const googleAccessToken =
      'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId = options.requestId !== undefined ? options.requestId : 'req-test-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/chat.spaces';

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }
    if (requestId) {
      headers['x-request-id'] = requestId;
    }
    if (scopes !== null && scopes !== undefined) {
      headers['x-google-scopes'] = scopes;
    }

    return {
      data: options.data ?? {},
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
            uid: 'uid-123',
          }
        : null,
      rawRequest: {
        headers,
      },
    } as any;
  }

  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false });
    await expect(chatList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockChatSpacesList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'chat.read',
        target: '*',
        result: 'denied',
      }),
    );
  });

  it('rejects teacher with permission-denied (missing cap) and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(chatList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'chat.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'chat.read',
    });
  });

  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(chatList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockChatSpacesList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/chat.spaces',
    });
  });

  it('allows admin with required scopes to list 3 spaces and writes ok audit log', async () => {
    mockChatSpacesList.mockResolvedValueOnce({
      data: {
        spaces: [
          {
            name: 'spaces/space-1',
            displayName: 'General Space',
            spaceType: 'SPACE',
            spaceHistoryState: 'HISTORY_ON',
            externalUserAllowed: false,
            createTime: '2026-09-01T00:00:00Z',
          },
          {
            name: 'spaces/space-2',
            displayName: 'Teachers Group Chat',
            spaceType: 'GROUP_CHAT',
            spaceHistoryState: 'HISTORY_ON',
            externalUserAllowed: false,
            createTime: '2026-09-02T00:00:00Z',
          },
          {
            name: 'spaces/space-3',
            displayName: 'Direct Message',
            spaceType: 'DIRECT_MESSAGE',
            spaceHistoryState: 'HISTORY_OFF',
            externalUserAllowed: false,
            createTime: '2026-09-03T00:00:00Z',
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatList.run(req);

    expect(result).toEqual({
      spaces: [
        {
          name: 'spaces/space-1',
          displayName: 'General Space',
          spaceType: 'SPACE',
          spaceHistoryState: 'HISTORY_ON',
          externalUserAllowed: false,
          createTime: '2026-09-01T00:00:00Z',
        },
        {
          name: 'spaces/space-2',
          displayName: 'Teachers Group Chat',
          spaceType: 'GROUP_CHAT',
          spaceHistoryState: 'HISTORY_ON',
          externalUserAllowed: false,
          createTime: '2026-09-02T00:00:00Z',
        },
        {
          name: 'spaces/space-3',
          displayName: 'Direct Message',
          spaceType: 'DIRECT_MESSAGE',
          spaceHistoryState: 'HISTORY_OFF',
          externalUserAllowed: false,
          createTime: '2026-09-03T00:00:00Z',
        },
      ],
    });

    expect(mockGetChatClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockChatSpacesList).toHaveBeenCalledWith({
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 3 chat spaces',
    });
  });

  it('supports pagination over multiple pages and returns all spaces', async () => {
    mockChatSpacesList
      .mockResolvedValueOnce({
        data: {
          spaces: [
            {
              name: 'spaces/page-1',
              displayName: 'Page 1 Space',
              spaceType: 'SPACE',
            },
            {
              name: 'spaces/page-2',
              displayName: 'Page 2 Space',
              spaceType: 'SPACE',
            },
          ],
          nextPageToken: 'page-token-next',
        },
      })
      .mockResolvedValueOnce({
        data: {
          spaces: [
            {
              name: 'spaces/page-3',
              displayName: 'Page 3 Space',
              spaceType: 'SPACE',
            },
          ],
          nextPageToken: null,
        },
      });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatList.run(req);

    expect(result.spaces).toHaveLength(3);
    expect(result.spaces[0].name).toBe('spaces/page-1');
    expect(result.spaces[1].name).toBe('spaces/page-2');
    expect(result.spaces[2].name).toBe('spaces/page-3');
    expect(mockChatSpacesList).toHaveBeenCalledTimes(2);
    expect(mockChatSpacesList).toHaveBeenNthCalledWith(1, {
      pageSize: 100,
      pageToken: undefined,
    });
    expect(mockChatSpacesList).toHaveBeenNthCalledWith(2, {
      pageSize: 100,
      pageToken: 'page-token-next',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 3 chat spaces',
    });
  });

  it('handles Google API error by writing error audit log and throwing HttpsError unknown', async () => {
    mockChatSpacesList.mockRejectedValueOnce(new Error('Google Chat API service unavailable'));

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(chatList.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Chat API service unavailable',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'chat.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'error',
      message: 'Google Chat API service unavailable',
    });
  });

  it('allows super_admin to list spaces and writes ok audit log', async () => {
    mockChatSpacesList.mockResolvedValueOnce({
      data: {
        spaces: [
          {
            name: 'spaces/super-space',
            displayName: 'Super Space',
            spaceType: 'SPACE',
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await chatList.run(req);

    expect(result.spaces).toHaveLength(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        result: 'ok',
        message: 'listed 1 chat spaces',
      }),
    );
  });

  it('handles empty spaces (0 spaces) returning empty array and ok audit log', async () => {
    mockChatSpacesList.mockResolvedValueOnce({
      data: {
        spaces: [],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await chatList.run(req);

    expect(result).toEqual({ spaces: [] });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'listed 0 chat spaces',
      }),
    );
  });
});
