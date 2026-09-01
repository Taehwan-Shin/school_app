import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryGroupsInsert = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    insert: mockDirectoryGroupsInsert,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsCreate } from '../src/callable/groups/create.js';

describe('groupsCreate unit tests', () => {
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
      options.requestId !== undefined ? options.requestId : 'req-test-group-create-123';
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
      email: 'team-a@cam.hs.kr',
      name: 'Team A',
      description: 'Alpha team description',
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

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryGroupsInsert).not.toHaveBeenCalled();
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

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsInsert).not.toHaveBeenCalled();
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

  it('rejects when write scope is missing and writes denied audit', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.group.readonly',
    });

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsInsert).not.toHaveBeenCalled();
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

  it('rejects invalid email domain with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        email: 'other@gmail.com',
        name: 'Other Team',
      },
    });

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryGroupsInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'other@gmail.com',
        result: 'error',
      }),
    );
  });

  it('rejects missing email with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        email: '',
        name: 'Team A',
      },
    });

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryGroupsInsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        result: 'error',
      }),
    );
  });

  it('rejects missing or empty name with invalid-argument and writes error audit', async () => {
    const req = createRequest({
      data: {
        email: 'team-a@cam.hs.kr',
        name: '   ',
      },
    });

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    expect(mockDirectoryGroupsInsert).not.toHaveBeenCalled();
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

  it('allows admin with valid input, calls directory insert and writes ok audit', async () => {
    mockDirectoryGroupsInsert.mockResolvedValueOnce({
      data: {
        id: 'created-group-id-123',
        email: 'team-a@cam.hs.kr',
      },
    });

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });
    const result = await groupsCreate.run(req);

    expect(result).toEqual({
      email: 'team-a@cam.hs.kr',
      id: 'created-group-id-123',
    });

    expect(mockGetDirectoryClient).toHaveBeenCalledWith('valid-google-token');
    expect(mockDirectoryGroupsInsert).toHaveBeenCalledWith({
      requestBody: {
        email: 'team-a@cam.hs.kr',
        name: 'Team A',
        description: 'Alpha team description',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.write',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-group-create-123',
      result: 'ok',
      message: 'created group',
    });
  });

  it('allows super_admin to create group', async () => {
    mockDirectoryGroupsInsert.mockResolvedValueOnce({
      data: {
        id: 'created-group-id-super',
        email: 'team-a@cam.hs.kr',
      },
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await groupsCreate.run(req);

    expect(result.id).toBe('created-group-id-super');
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'groups.write',
        result: 'ok',
      }),
    );
  });

  it('handles googleapis error and writes error audit log', async () => {
    mockDirectoryGroupsInsert.mockRejectedValueOnce(
      new Error('Google Directory 409 Group already exists'),
    );

    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(groupsCreate.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Google Directory 409 Group already exists',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'groups.write',
      target: 'team-a@cam.hs.kr',
      request_id: 'req-test-group-create-123',
      result: 'error',
      message: 'Google Directory 409 Group already exists',
    });
  });

  it('succeeds without description optional field', async () => {
    mockDirectoryGroupsInsert.mockResolvedValueOnce({
      data: {
        id: 'created-group-id-nodesc',
        email: 'nodesc@cam.hs.kr',
      },
    });

    const req = createRequest({
      data: {
        email: 'nodesc@cam.hs.kr',
        name: 'Node Description Team',
      },
    });

    const result = await groupsCreate.run(req);

    expect(result).toEqual({
      email: 'nodesc@cam.hs.kr',
      id: 'created-group-id-nodesc',
    });

    expect(mockDirectoryGroupsInsert).toHaveBeenCalledWith({
      requestBody: {
        email: 'nodesc@cam.hs.kr',
        name: 'Node Description Team',
      },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'nodesc@cam.hs.kr',
        result: 'ok',
      }),
    );
  });
});
