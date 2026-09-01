import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryMembersList = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    members: {
      list: mockDirectoryMembersList,
    },
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsMembersList } from '../src/callable/groups/members/list.js';

describe('groupsMembersList unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      data?: any;
      email?: string;
      role?: any;
      googleAccessToken?: string | null;
      requestId?: string;
      auth?: boolean;
      scopes?: string | null;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'admin@cam.hs.kr';
    const role = 'role' in options ? options.role : 'admin';
    const googleAccessToken =
      'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId =
      options.requestId !== undefined ? options.requestId : 'req-test-groups-members-list-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/admin.directory.group.member.readonly';

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

    const defaultData = {
      groupEmail: 'team-a@cam.hs.kr',
    };

    return {
      data: 'data' in options ? options.data : defaultData,
      auth: hasAuth
        ? {
            token: {
              email,
              role,
            },
            uid: 'uid-admin-123',
          }
        : null,
      rawRequest: {
        headers,
      },
    } as any;
  }

  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false, data: undefined });

    await expect(groupsMembersList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'groups.read',
        target: '*',
        result: 'denied',
      }),
    );
  });

  it('rejects teacher with permission-denied (missing cap) and writes denied audit', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(groupsMembersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'teacher@cam.hs.kr',
        role: 'teacher',
        action: 'groups.read',
        target: 'team-a@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  it('rejects when member.readonly scope is missing and writes denied audit', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.group.readonly',
    });

    await expect(groupsMembersList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.read',
        target: 'team-a@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  it('rejects invalid email domain with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'invalid@gmail.com',
      },
    });

    await expect(groupsMembersList.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryMembersList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.read',
        target: 'invalid@gmail.com',
        result: 'error',
      }),
    );
  });

  it('allows admin with valid input, returns 3 members and writes ok audit', async () => {
    mockDirectoryMembersList.mockResolvedValueOnce({
      data: {
        members: [
          { email: 'user1@cam.hs.kr', role: 'OWNER', type: 'USER', status: 'ACTIVE' },
          { email: 'user2@cam.hs.kr', role: 'MANAGER', type: 'USER', status: 'ACTIVE' },
          { email: 'user3@cam.hs.kr', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsMembersList.run(req);

    expect(result).toEqual({
      members: [
        { email: 'user1@cam.hs.kr', role: 'OWNER', type: 'USER', status: 'ACTIVE' },
        { email: 'user2@cam.hs.kr', role: 'MANAGER', type: 'USER', status: 'ACTIVE' },
        { email: 'user3@cam.hs.kr', role: 'MEMBER', type: 'USER', status: 'ACTIVE' },
      ],
      nextPageToken: null,
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockDirectoryMembersList).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      maxResults: 200,
      pageToken: undefined,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.read',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-list-123',
      result: 'ok',
      message: 'listed 3 members of group team-a@cam.hs.kr',
    });
  });

  it('allows super_admin and succeeds', async () => {
    mockDirectoryMembersList.mockResolvedValueOnce({
      data: {
        members: [],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await groupsMembersList.run(req);

    expect(result.members).toEqual([]);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'groups.read',
        result: 'ok',
      }),
    );
  });

  it('handles Directory API 404 error and writes error audit', async () => {
    mockDirectoryMembersList.mockRejectedValueOnce(
      new Error('Google Directory 404 Resource Not Found: groupKey'),
    );

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(groupsMembersList.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory 404 Resource Not Found: groupKey',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.read',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-list-123',
      result: 'error',
      message: 'Google Directory 404 Resource Not Found: groupKey',
    });
  });

  it('clamps maxResults (0 -> 1, 999 -> 200)', async () => {
    mockDirectoryMembersList.mockResolvedValue({
      data: { members: [], nextPageToken: null },
    });

    // Case 0 -> 1
    const req0 = createRequest({ data: { groupEmail: 'team-a@cam.hs.kr', maxResults: 0 } });
    await groupsMembersList.run(req0);
    expect(mockDirectoryMembersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxResults: 1 }),
    );

    // Case 999 -> 200
    const req999 = createRequest({ data: { groupEmail: 'team-a@cam.hs.kr', maxResults: 999 } });
    await groupsMembersList.run(req999);
    expect(mockDirectoryMembersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxResults: 200 }),
    );
  });

  it('passes pageToken correctly to directory call', async () => {
    mockDirectoryMembersList.mockResolvedValueOnce({
      data: { members: [], nextPageToken: null },
    });

    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        pageToken: 'token-page-2',
      },
    });

    await groupsMembersList.run(req);

    expect(mockDirectoryMembersList).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      maxResults: 200,
      pageToken: 'token-page-2',
    });
  });

  it('returns nextPageToken when directory response provides it', async () => {
    mockDirectoryMembersList.mockResolvedValueOnce({
      data: {
        members: [{ email: 'm1@cam.hs.kr', role: 'MEMBER', type: 'USER', status: 'ACTIVE' }],
        nextPageToken: 'token-page-next-123',
      },
    });

    const req = createRequest();
    const result = await groupsMembersList.run(req);

    expect(result.nextPageToken).toBe('token-page-next-123');
  });
});
