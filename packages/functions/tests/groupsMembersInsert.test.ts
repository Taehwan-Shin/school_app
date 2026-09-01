import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryMembersInsert = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    members: {
      insert: mockDirectoryMembersInsert,
    },
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsMembersInsert } from '../src/callable/groups/members/insert.js';

describe('groupsMembersInsert unit tests', () => {
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
      options.requestId !== undefined ? options.requestId : 'req-test-groups-members-insert-123';
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
      memberEmail: 'newmember@cam.hs.kr',
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

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'groups.write',
        target: '*',
        result: 'denied',
      }),
    );
  });

  it('rejects teacher with permission-denied (missing cap) and writes denied audit', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'teacher@cam.hs.kr',
        role: 'teacher',
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  it('rejects when member write scope is missing and writes denied audit', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
    });

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  it('rejects invalid memberEmail domain with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'user@external.com',
      },
    });

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'error',
      }),
    );
  });

  it('rejects invalid groupEmail domain with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@gmail.com',
        memberEmail: 'user@cam.hs.kr',
      },
    });

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'team-a@gmail.com',
        result: 'error',
      }),
    );
  });

  it('allows admin with default MEMBER role and writes ok audit', async () => {
    mockDirectoryMembersInsert.mockResolvedValueOnce({
      data: {
        id: 'member-id-123',
        email: 'newmember@cam.hs.kr',
        role: 'MEMBER',
      },
    });

    const req = createRequest();
    const result = await groupsMembersInsert.run(req);

    expect(result).toEqual({
      groupEmail: 'team-a@cam.hs.kr',
      memberEmail: 'newmember@cam.hs.kr',
      role: 'MEMBER',
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockDirectoryMembersInsert).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      requestBody: {
        email: 'newmember@cam.hs.kr',
        role: 'MEMBER',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.write',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-insert-123',
      result: 'ok',
      message: 'added newmember@cam.hs.kr to group team-a@cam.hs.kr as MEMBER',
    });
  });

  it('allows admin with explicit OWNER role and writes ok audit', async () => {
    mockDirectoryMembersInsert.mockResolvedValueOnce({
      data: {
        id: 'member-id-owner',
        email: 'newmember@cam.hs.kr',
        role: 'OWNER',
      },
    });

    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'newmember@cam.hs.kr',
        role: 'OWNER',
      },
    });
    const result = await groupsMembersInsert.run(req);

    expect(result.role).toBe('OWNER');
    expect(mockDirectoryMembersInsert).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      requestBody: {
        email: 'newmember@cam.hs.kr',
        role: 'OWNER',
      },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'added newmember@cam.hs.kr to group team-a@cam.hs.kr as OWNER',
      }),
    );
  });

  it('handles Directory API 409 (already member) error, writes error audit and throws', async () => {
    mockDirectoryMembersInsert.mockRejectedValueOnce(
      new Error('Google Directory 409 Member already exists'),
    );

    const req = createRequest();

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory 409 Member already exists',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.write',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-insert-123',
      result: 'error',
      message: 'Google Directory 409 Member already exists',
    });
  });

  it('rejects invalid role value with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'newmember@cam.hs.kr',
        role: 'SUPERUSER',
      },
    });

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'error',
      }),
    );
  });

  it('rejects missing groupEmail with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: '',
        memberEmail: 'newmember@cam.hs.kr',
      },
    });

    await expect(groupsMembersInsert.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryMembersInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        result: 'error',
      }),
    );
  });
});
