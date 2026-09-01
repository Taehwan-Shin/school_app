import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryMembersDelete = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    members: {
      delete: mockDirectoryMembersDelete,
    },
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsMembersDelete } from '../src/callable/groups/members/delete.js';

describe('groupsMembersDelete unit tests', () => {
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
      options.requestId !== undefined ? options.requestId : 'req-test-groups-members-delete-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/admin.directory.group.member';

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
      memberEmail: 'targetmember@cam.hs.kr',
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

    await expect(groupsMembersDelete.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryMembersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'groups.delete',
        target: '*',
        result: 'denied',
      }),
    );
  });

  it('rejects teacher with permission-denied (missing cap) and writes denied audit', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(groupsMembersDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'teacher@cam.hs.kr',
        role: 'teacher',
        action: 'groups.delete',
        target: 'team-a@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  it('rejects when member write scope is missing and writes denied audit', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.group.readonly',
    });

    await expect(groupsMembersDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.delete',
        target: 'team-a@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  it('rejects invalid email domain with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'external@gmail.com',
      },
    });

    await expect(groupsMembersDelete.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryMembersDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.delete',
        target: 'team-a@cam.hs.kr',
        result: 'error',
      }),
    );
  });

  it('allows admin with valid input, deletes member and writes ok audit', async () => {
    mockDirectoryMembersDelete.mockResolvedValueOnce({ data: {} });

    const req = createRequest();
    const result = await groupsMembersDelete.run(req);

    expect(result).toEqual({
      groupEmail: 'team-a@cam.hs.kr',
      memberEmail: 'targetmember@cam.hs.kr',
      deleted: true,
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockDirectoryMembersDelete).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      memberKey: 'targetmember@cam.hs.kr',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.delete',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-delete-123',
      result: 'ok',
      message: 'removed targetmember@cam.hs.kr from group team-a@cam.hs.kr',
    });
  });

  it('handles Directory API 404 (member not found) error, writes error audit and throws', async () => {
    mockDirectoryMembersDelete.mockRejectedValueOnce(
      new Error('Google Directory 404 Member not found: targetmember@cam.hs.kr'),
    );

    const req = createRequest();

    await expect(groupsMembersDelete.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory 404 Member not found: targetmember@cam.hs.kr',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.delete',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-delete-123',
      result: 'error',
      message: 'Google Directory 404 Member not found: targetmember@cam.hs.kr',
    });
  });

  it('allows super_admin to delete group member', async () => {
    mockDirectoryMembersDelete.mockResolvedValueOnce({ data: {} });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await groupsMembersDelete.run(req);

    expect(result.deleted).toBe(true);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'groups.delete',
        result: 'ok',
      }),
    );
  });

  it('handles Directory API error when attempting to remove last OWNER and writes error audit', async () => {
    mockDirectoryMembersDelete.mockRejectedValueOnce(
      new Error('Google Directory 400 Cannot remove last owner of the group'),
    );

    const req = createRequest();

    await expect(groupsMembersDelete.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory 400 Cannot remove last owner of the group',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.delete',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-delete-123',
      result: 'error',
      message: 'Google Directory 400 Cannot remove last owner of the group',
    });
  });
});
