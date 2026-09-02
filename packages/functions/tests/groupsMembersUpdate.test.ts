import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryMembersUpdate = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    members: {
      update: mockDirectoryMembersUpdate,
    },
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsMembersUpdate } from '../src/callable/groups/members/update.js';

describe('groupsMembersUpdate unit tests', () => {
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
      options.requestId !== undefined ? options.requestId : 'req-test-groups-members-update-123';
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
      memberEmail: 'member1@cam.hs.kr',
      role: 'MANAGER',
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

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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

  it('rejects missing role with invalid-argument role_required and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'member1@cam.hs.kr',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'role_required',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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

  it('rejects invalid role value with invalid-argument invalid_role and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'member1@cam.hs.kr',
        role: 'ADMIN',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_role',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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
        memberEmail: 'member1@cam.hs.kr',
        role: 'MANAGER',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_group_email_domain',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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

  it('rejects invalid memberEmail domain with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'user@external.com',
        role: 'MANAGER',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_member_email_domain',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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

  it('allows admin with valid role change and writes ok audit', async () => {
    mockDirectoryMembersUpdate.mockResolvedValueOnce({
      data: {
        id: 'member-id-123',
        email: 'member1@cam.hs.kr',
        role: 'MANAGER',
      },
    });

    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'member1@cam.hs.kr',
        role: 'MANAGER',
      },
    });
    const result = await groupsMembersUpdate.run(req);

    expect(result).toEqual({
      groupEmail: 'team-a@cam.hs.kr',
      memberEmail: 'member1@cam.hs.kr',
      role: 'MANAGER',
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockDirectoryMembersUpdate).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      memberKey: 'member1@cam.hs.kr',
      requestBody: {
        role: 'MANAGER',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.write',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-update-123',
      result: 'ok',
      message: 'updated member1@cam.hs.kr role to MANAGER in group team-a@cam.hs.kr',
    });
  });

  it('handles Directory API failure error, writes error audit and throws', async () => {
    mockDirectoryMembersUpdate.mockRejectedValueOnce(
      new Error('Google Directory 400 Cannot downgrade the only owner'),
    );

    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: 'owner@cam.hs.kr',
        role: 'MEMBER',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory 400 Cannot downgrade the only owner',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.write',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-groups-members-update-123',
      result: 'error',
      message: 'Google Directory 400 Cannot downgrade the only owner',
    });
  });

  it('rejects missing groupEmail with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: '',
        memberEmail: 'member1@cam.hs.kr',
        role: 'MANAGER',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'group_email_required',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        result: 'error',
      }),
    );
  });

  it('rejects missing memberEmail with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        groupEmail: 'team-a@cam.hs.kr',
        memberEmail: '',
        role: 'MANAGER',
      },
    });

    await expect(groupsMembersUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'member_email_required',
    });

    expect(mockDirectoryMembersUpdate).not.toHaveBeenCalled();
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
});
