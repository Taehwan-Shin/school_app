import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryGroupsList = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    list: mockDirectoryGroupsList,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsList } from '../src/callable/groups/list.js';

describe('groupsList unit tests', () => {
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
        : 'https://www.googleapis.com/auth/admin.directory.group.readonly';

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
      data: {},
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
    await expect(groupsList.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryGroupsList).not.toHaveBeenCalled();
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

  it('rejects teacher with permission-denied (missing cap) and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(groupsList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'groups.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'groups.read',
    });
  });

  it('rejects request with missing scopes and writes denied audit log', async () => {
    const req = createRequest({
      email: 'admin@cam.hs.kr',
      role: 'admin',
      scopes: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    });

    await expect(groupsList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsList).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'denied',
      message: 'insufficient_scope:https://www.googleapis.com/auth/admin.directory.group.readonly',
    });
  });

  it('allows admin with required scopes to list 3 groups and writes ok audit log', async () => {
    mockDirectoryGroupsList.mockResolvedValueOnce({
      data: {
        groups: [
          {
            email: 'group1@cam.hs.kr',
            name: 'Group 1',
            description: 'Desc 1',
            aliases: ['g1-alias@cam.hs.kr'],
            directMembersCount: 10,
          },
          {
            email: 'group2@cam.hs.kr',
            name: 'Group 2',
            description: 'Desc 2',
            aliases: [],
            directMembersCount: 20,
          },
          {
            email: 'group3@cam.hs.kr',
            name: 'Group 3',
            description: 'Desc 3',
            aliases: ['g3-a@cam.hs.kr', 'g3-b@cam.hs.kr'],
            directMembersCount: 30,
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsList.run(req);

    expect(result).toEqual({
      groups: [
        {
          email: 'group1@cam.hs.kr',
          name: 'Group 1',
          description: 'Desc 1',
          aliases: ['g1-alias@cam.hs.kr'],
          directMembersCount: 10,
        },
        {
          email: 'group2@cam.hs.kr',
          name: 'Group 2',
          description: 'Desc 2',
          aliases: [],
          directMembersCount: 20,
        },
        {
          email: 'group3@cam.hs.kr',
          name: 'Group 3',
          description: 'Desc 3',
          aliases: ['g3-a@cam.hs.kr', 'g3-b@cam.hs.kr'],
          directMembersCount: 30,
        },
      ],
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'ok',
      message: 'listed 3 groups',
    });
  });

  it('allows super_admin to list groups and writes ok audit log', async () => {
    mockDirectoryGroupsList.mockResolvedValueOnce({
      data: {
        groups: [
          {
            email: 'super-group@cam.hs.kr',
            name: 'Super Group',
            description: 'All super admins',
            aliases: [],
            directMembersCount: 2,
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await groupsList.run(req);

    expect(result.groups).toHaveLength(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        result: 'ok',
        message: 'listed 1 groups',
      }),
    );
  });

  it('handles empty groups (0 groups) returning empty array and ok audit log', async () => {
    mockDirectoryGroupsList.mockResolvedValueOnce({
      data: {
        groups: [],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsList.run(req);

    expect(result).toEqual({ groups: [] });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'listed 0 groups',
      }),
    );
  });

  it('converts string directMembersCount ("5") to integer 5', async () => {
    mockDirectoryGroupsList.mockResolvedValueOnce({
      data: {
        groups: [
          {
            email: 'team@cam.hs.kr',
            name: 'Team',
            description: 'Team with string count',
            aliases: [],
            directMembersCount: '5',
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsList.run(req);

    expect(result.groups[0].directMembersCount).toBe(5);
    expect(typeof result.groups[0].directMembersCount).toBe('number');
  });

  it('defaults missing directMembersCount to 0', async () => {
    mockDirectoryGroupsList.mockResolvedValueOnce({
      data: {
        groups: [
          {
            email: 'team-nocount@cam.hs.kr',
            name: 'Team No Count',
            description: '',
            aliases: [],
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsList.run(req);

    expect(result.groups[0].directMembersCount).toBe(0);
  });

  it('defaults missing aliases to empty array', async () => {
    mockDirectoryGroupsList.mockResolvedValueOnce({
      data: {
        groups: [
          {
            email: 'team-noalias@cam.hs.kr',
            name: 'Team No Alias',
            description: 'No aliases field',
            directMembersCount: 1,
          },
        ],
        nextPageToken: null,
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsList.run(req);

    expect(result.groups[0].aliases).toEqual([]);
  });

  it('handles Google API error by writing error audit log and throwing HttpsError unknown', async () => {
    mockDirectoryGroupsList.mockRejectedValueOnce(new Error('Google Directory API service unavailable'));

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(groupsList.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory API service unavailable',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.read',
      target: '*',
      request_id: 'req-test-123',
      result: 'error',
      message: 'Google Directory API service unavailable',
    });
  });

  it('supports pagination over multiple pages', async () => {
    mockDirectoryGroupsList
      .mockResolvedValueOnce({
        data: {
          groups: [
            {
              email: 'group-p1@cam.hs.kr',
              name: 'Page 1 Group',
              description: 'First page',
              aliases: [],
              directMembersCount: '10',
            },
          ],
          nextPageToken: 'page-token-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          groups: [
            {
              email: 'group-p2@cam.hs.kr',
              name: 'Page 2 Group',
              description: 'Second page',
              aliases: ['alias2@cam.hs.kr'],
              directMembersCount: 20,
            },
          ],
          nextPageToken: null,
        },
      });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsList.run(req);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].email).toBe('group-p1@cam.hs.kr');
    expect(result.groups[0].directMembersCount).toBe(10);
    expect(result.groups[1].email).toBe('group-p2@cam.hs.kr');
    expect(result.groups[1].directMembersCount).toBe(20);
    expect(mockDirectoryGroupsList).toHaveBeenCalledTimes(2);
    expect(mockDirectoryGroupsList).toHaveBeenNthCalledWith(1, {
      customer: 'my_customer',
      maxResults: 200,
      pageToken: undefined,
    });
    expect(mockDirectoryGroupsList).toHaveBeenNthCalledWith(2, {
      customer: 'my_customer',
      maxResults: 200,
      pageToken: 'page-token-2',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'listed 2 groups',
      }),
    );
  });

  describe('denied audit role fidelity (no forgery)', () => {
    it('writes denied audit with actor=unknown role=unknown when unauthenticated', async () => {
      const req = createRequest({ auth: false });
      await expect(groupsList.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
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

    it('writes denied audit with role=unknown when role claim is missing', async () => {
      const req = createRequest({ email: 'admin@cam.hs.kr', role: undefined });
      await expect(groupsList.run(req)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'admin@cam.hs.kr',
          role: 'unknown',
          action: 'groups.read',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with role=unknown when role claim is an unknown value', async () => {
      const req = createRequest({ email: 'admin@cam.hs.kr', role: 'wizard' as any });
      await expect(groupsList.run(req)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'admin@cam.hs.kr',
          role: 'unknown',
          action: 'groups.read',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with actor=email role=admin when domain is invalid', async () => {
      const req = createRequest({ email: 'intruder@example.com', role: 'admin' });
      await expect(groupsList.run(req)).rejects.toMatchObject({ code: 'permission-denied' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'intruder@example.com',
          role: 'admin',
          action: 'groups.read',
          result: 'denied',
        }),
      );
    });
  });
});
