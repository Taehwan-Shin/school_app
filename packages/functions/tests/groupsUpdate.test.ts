import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockDirectoryGroupsPatch = vi.fn();
const mockDirectoryGroupsGet = vi.fn();
const mockGetDirectoryClient = vi.fn(() => ({
  groups: {
    patch: mockDirectoryGroupsPatch,
    get: mockDirectoryGroupsGet,
  },
}));
vi.mock('../src/google/directoryClient.js', () => ({
  getDirectoryClient: (...args: any[]) => mockGetDirectoryClient(...args),
}));

import { groupsUpdate } from '../src/callable/groups/update.js';

describe('groupsUpdate unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    mockDirectoryGroupsGet.mockResolvedValue({
      data: {
        id: 'group-123',
        email: 'team-a@cam.hs.kr',
        name: 'Old Team A',
        description: 'Old description',
      },
    });
    mockDirectoryGroupsPatch.mockResolvedValue({
      data: {
        id: 'group-123',
        email: 'team-a@cam.hs.kr',
        name: 'New Team A',
        description: 'New description',
      },
    });
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
      options.requestId !== undefined ? options.requestId : 'req-test-group-update-123';
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
      name: 'New Team A',
      description: 'Updated description',
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

  // 1. 인증 실패 -> denied audit
  it('rejects unauthenticated request and writes denied audit log', async () => {
    const req = createRequest({ auth: false, data: undefined });

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
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

  // 2. cap 없음 (teacher) -> denied
  it('rejects teacher lacking groups.write cap and writes denied audit log', async () => {
    const req = createRequest({
      email: 'teacher@cam.hs.kr',
      role: 'teacher',
    });

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
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

  // 3. scopes 없음 -> denied
  it('rejects admin lacking write scope and writes denied audit log', async () => {
    const req = createRequest({
      scopes: 'https://www.googleapis.com/auth/admin.directory.group.readonly',
    });

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
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

  // 4. 이메일 검증 실패 (도메인) -> error
  it('rejects group with invalid email domain and writes error audit log', async () => {
    const req = createRequest({
      data: {
        email: 'team-a@otherdomain.com',
        name: 'New Name',
      },
    });

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'invalid_email_domain',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.write',
        target: 'team-a@otherdomain.com',
        result: 'error',
      }),
    );
  });

  // 5. 이메일 없음 / missing data -> error
  it('rejects request with missing email and writes error audit log', async () => {
    const req = createRequest({
      data: {
        email: '',
        name: 'New Name',
      },
    });

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'email_required',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.write',
        target: '*',
        result: 'error',
      }),
    );
  });

  // 6. 편집 필드 없음 -> error no_fields_to_update
  it('rejects request with no fields to update and writes error audit log', async () => {
    const req = createRequest({
      data: {
        email: 'team-a@cam.hs.kr',
      },
    });

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'no_fields_to_update',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'error',
      }),
    );
  });

  // 7. admin + name 만 수정 성공 -> ok audit + before/after
  it('allows admin to update only name and writes ok audit log with before/after', async () => {
    const req = createRequest({
      data: {
        email: 'team-a@cam.hs.kr',
        name: 'Updated Name Only',
      },
      requestId: 'req-name-only-1',
    });

    const res = await groupsUpdate.run(req);

    expect(res).toEqual({
      email: 'team-a@cam.hs.kr',
      updatedFields: ['name'],
    });

    expect(mockDirectoryGroupsGet).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
    });
    expect(mockDirectoryGroupsPatch).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      requestBody: { name: 'Updated Name Only' },
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        request_id: 'req-name-only-1',
        result: 'ok',
        message: expect.stringContaining('updated fields: name'),
      }),
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('before: {"name":"Old Team A","description":"Old description"}'),
      }),
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('after: {"name":"Updated Name Only"}'),
      }),
    );
  });

  // 8. admin + description 만 수정 성공
  it('allows admin to update only description and writes ok audit log', async () => {
    const req = createRequest({
      data: {
        email: 'team-a@cam.hs.kr',
        description: 'New description only',
      },
    });

    const res = await groupsUpdate.run(req);

    expect(res).toEqual({
      email: 'team-a@cam.hs.kr',
      updatedFields: ['description'],
    });

    expect(mockDirectoryGroupsPatch).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      requestBody: { description: 'New description only' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: expect.stringContaining('updated fields: description'),
      }),
    );
  });

  // 9. admin + 둘 다 수정 성공
  it('allows admin to update both name and description', async () => {
    const req = createRequest({
      data: {
        email: 'team-a@cam.hs.kr',
        name: 'Brand New Name',
        description: 'Brand new description',
      },
    });

    const res = await groupsUpdate.run(req);

    expect(res).toEqual({
      email: 'team-a@cam.hs.kr',
      updatedFields: ['name', 'description'],
    });

    expect(mockDirectoryGroupsPatch).toHaveBeenCalledWith({
      groupKey: 'team-a@cam.hs.kr',
      requestBody: {
        name: 'Brand New Name',
        description: 'Brand new description',
      },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: expect.stringContaining('updated fields: name, description'),
      }),
    );
  });

  // 10. super_admin 도 성공
  it('allows super_admin to update group', async () => {
    const req = createRequest({
      email: 'superadmin@cam.hs.kr',
      role: 'super_admin',
      data: {
        email: 'team-a@cam.hs.kr',
        name: 'Super Admin Name',
      },
    });

    const res = await groupsUpdate.run(req);

    expect(res.email).toBe('team-a@cam.hs.kr');
    expect(res.updatedFields).toEqual(['name']);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'superadmin@cam.hs.kr',
        role: 'super_admin',
        result: 'ok',
      }),
    );
  });

  // 11. Directory API 오류 (404 등) -> error audit + throw
  it('handles Directory API patch failure and writes error audit log', async () => {
    mockDirectoryGroupsPatch.mockRejectedValueOnce(new Error('Google Directory API 404: Group not found'));

    const req = createRequest();

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: expect.stringContaining('404'),
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'error',
      }),
    );
  });

  // 12. before 조회 실패 -> error audit + throw
  it('handles before lookup failure and writes error audit log', async () => {
    mockDirectoryGroupsGet.mockRejectedValueOnce(new Error('Failed to fetch existing group'));

    const req = createRequest();

    await expect(groupsUpdate.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Failed to fetch existing group',
    });

    expect(mockDirectoryGroupsPatch).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups.write',
        target: 'team-a@cam.hs.kr',
        result: 'error',
      }),
    );
  });
});
