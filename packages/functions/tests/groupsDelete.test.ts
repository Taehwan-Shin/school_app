import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryGroupsDelete = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    delete: mockDirectoryGroupsDelete,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsDelete } from '../src/callable/groups/delete.js';

describe('groupsDelete unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockDirectoryGroupsDelete.mockResolvedValue({ data: {} });
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
      options.requestId !== undefined ? options.requestId : 'req-test-group-delete-123';
    const scopes =
      'scopes' in options
        ? options.scopes
        : 'https://www.googleapis.com/auth/admin.directory.group';

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
      email: 'team-to-delete@cam.hs.kr',
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

  // 1. 인증 실패 -> denied
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false, data: undefined });

    await expect(groupsDelete.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryGroupsDelete).not.toHaveBeenCalled();
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

  // 2. cap 없음 (teacher) -> denied
  it('rejects teacher lacking groups.delete cap and writes denied audit log', async () => {
    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
    });

    await expect(groupsDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'teacher@cam.hs.kr',
        role: 'teacher',
        action: 'groups.delete',
        target: 'team-to-delete@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  // 3. scopes 없음 -> denied
  it('rejects admin lacking write scope and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.group.readonly',
    });

    await expect(groupsDelete.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.delete',
        target: 'team-to-delete@cam.hs.kr',
        result: 'denied',
      }),
    );
  });

  // 4. 이메일 검증 실패 (도메인) -> error
  it('rejects group with invalid email domain and writes error audit log', async () => {
    const req = createRequest({
      data: {
        email: 'team@external.com',
      },
    });

    await expect(groupsDelete.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email_domain',
    });

    expect(mockDirectoryGroupsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.delete',
        target: 'team@external.com',
        result: 'error',
      }),
    );
  });

  // 5. 이메일 없음 / missing data -> error
  it('rejects request with missing email and writes error audit log', async () => {
    const req = createRequest({
      data: {
        email: '',
      },
    });

    await expect(groupsDelete.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'email_required',
    });

    expect(mockDirectoryGroupsDelete).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.delete',
        target: '*',
        result: 'error',
      }),
    );
  });

  // 6. admin + 유효 이메일 -> ok audit
  it('allows admin to delete group and writes ok audit log', async () => {
    const req = createRequest({
      data: {
        email: 'team-to-delete@cam.hs.kr',
      },
      requestId: 'req-delete-1',
    });

    const res = await groupsDelete.run(req);

    expect(res).toEqual({
      email: 'team-to-delete@cam.hs.kr',
      deleted: true,
    });

    expect(mockDirectoryGroupsDelete).toHaveBeenCalledWith({
      groupKey: 'team-to-delete@cam.hs.kr',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.delete',
        target: 'team-to-delete@cam.hs.kr',
        request_id: 'req-delete-1',
        result: 'ok',
        message: 'deleted group',
      }),
    );
  });

  // 7. super_admin 도 성공
  it('allows super_admin to delete group', async () => {
    const req = createRequest({
      email: 'superadmin@cam.hs.kr',
      role: 'super_admin',
      data: {
        email: 'team-to-delete@cam.hs.kr',
      },
    });

    const res = await groupsDelete.run(req);

    expect(res).toEqual({
      email: 'team-to-delete@cam.hs.kr',
      deleted: true,
    });

    expect(mockDirectoryGroupsDelete).toHaveBeenCalledWith({
      groupKey: 'team-to-delete@cam.hs.kr',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'superadmin@cam.hs.kr',
        role: 'super_admin',
        action: 'groups.delete',
        target: 'team-to-delete@cam.hs.kr',
        result: 'ok',
        message: 'deleted group',
      }),
    );
  });

  // 8. Directory API 오류 -> error audit
  it('handles Directory API failure and writes error audit log', async () => {
    mockDirectoryGroupsDelete.mockRejectedValueOnce(
      new Error('Google Directory API 404: Group not found'),
    );

    const req = createRequest();

    await expect(groupsDelete.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: expect.stringContaining('404'),
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.delete',
        target: 'team-to-delete@cam.hs.kr',
        result: 'error',
      }),
    );
  });
});
