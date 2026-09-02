import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockReadAuditEntries = vi.fn();
vi.mock('../src/audit/readAudit.js', () => ({
  readAuditEntries: (...args: any[]) => mockReadAuditEntries(...args),
}));

import { auditLogList } from '../src/callable/audit/list.js';
import type { AuditLogEntryRead } from '../src/audit/readAudit.js';

describe('auditLogList unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      email?: string | null;
      role?: any;
      googleAccessToken?: string | null;
      requestId?: string;
      auth?: boolean;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const email = options.email !== undefined ? options.email : 'super@cam.hs.kr';
    const role = 'role' in options ? options.role : 'super_admin';
    const googleAccessToken =
      'googleAccessToken' in options ? options.googleAccessToken : 'valid-google-token';
    const requestId = options.requestId !== undefined ? options.requestId : 'req-audit-123';
    const data = options.data !== undefined ? options.data : {};

    const headers: Record<string, string> = {};
    if (googleAccessToken) {
      headers['x-google-access-token'] = googleAccessToken;
    }
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    return {
      data,
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

  it('allows super_admin to list audit log entries with default limit (50) and writes ok audit log', async () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'doc-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.write',
        target: 'user@cam.hs.kr',
        request_id: 'req-prev-1',
        result: 'ok',
        at: 1700000000000,
        message: 'updated user',
      },
    ];

    mockReadAuditEntries.mockResolvedValueOnce({
      entries: mockEntries,
      nextCursor: null,
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await auditLogList.run(req);

    expect(result).toEqual({
      entries: mockEntries,
      nextCursor: null,
    });

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 50,
      before: undefined,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'audit.read',
      target: '*',
      request_id: 'req-audit-123',
      result: 'ok',
      message: 'read 1 entries (limit 50)',
    });
  });

  it('respects explicit limit option (limit=100)', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { limit: 100 },
    });
    const result = await auditLogList.run(req);

    expect(result).toEqual({
      entries: [],
      nextCursor: null,
    });

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 100,
      before: undefined,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'read 0 entries (limit 100)',
      }),
    );
  });

  it('clamps limit above MAX_LIMIT (999 -> 200)', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { limit: 999 },
    });
    await auditLogList.run(req);

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 200,
      before: undefined,
    });
  });

  it('clamps limit below 1 (0 or negative -> 1)', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { limit: -5 },
    });
    await auditLogList.run(req);

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 1,
      before: undefined,
    });
  });

  it('passes before cursor timestamp to readAuditEntries and records in audit log message', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { limit: 50, before: 1700000000000 },
    });
    await auditLogList.run(req);

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 50,
      before: 1700000000000,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'read 0 entries (limit 50, before 1700000000000)',
      }),
    );
  });

  it('returns nextCursor when page is full (entries.length === limit)', async () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'doc-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-1',
        result: 'ok',
        at: 1700000002000,
      },
      {
        id: 'doc-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-2',
        result: 'ok',
        at: 1700000001000,
      },
    ];

    mockReadAuditEntries.mockResolvedValueOnce({
      entries: mockEntries,
      nextCursor: 1700000001000,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { limit: 2 },
    });
    const result = await auditLogList.run(req);

    expect(result.nextCursor).toBe(1700000001000);
    expect(result.entries).toHaveLength(2);
  });

  it('passes filterActor to readAuditEntries when provided', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { filterActor: 'admin@cam.hs.kr' },
    });
    await auditLogList.run(req);

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 50,
      before: undefined,
      filterActor: 'admin@cam.hs.kr',
      filterTarget: undefined,
      filterResult: undefined,
    });
  });

  it('includes filter information in successful audit message', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {
        filterActor: 'admin@cam.hs.kr',
        filterTarget: 'user@cam.hs.kr',
        filterResult: 'ok',
      },
    });
    await auditLogList.run(req);

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'read 0 entries (limit 50) [actor=admin@cam.hs.kr, target=user@cam.hs.kr, result=ok]',
      }),
    );
  });

  it('preserves existing behavior and message format when no filters are provided', async () => {
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: {},
    });
    await auditLogList.run(req);

    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 50,
      before: undefined,
      filterActor: undefined,
      filterTarget: undefined,
      filterResult: undefined,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'ok',
        message: 'read 0 entries (limit 50)',
      }),
    );
  });

  it('rejects admin with permission-denied and writes denied audit log', async () => {
    const req = createRequest({ email: 'admin@cam.hs.kr', role: 'admin' });

    await expect(auditLogList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockReadAuditEntries).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'audit.read',
      target: '*',
      request_id: 'req-audit-123',
      result: 'denied',
      message: 'audit.read',
    });
  });

  it('rejects teacher with permission-denied and writes denied audit log', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });

    await expect(auditLogList.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(mockReadAuditEntries).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'audit.read',
      target: '*',
      request_id: 'req-audit-123',
      result: 'denied',
      message: 'audit.read',
    });
  });

  it('handles readAuditEntries error by writing error audit log and throwing HttpsError unknown', async () => {
    mockReadAuditEntries.mockRejectedValueOnce(new Error('Firestore read failed'));

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });

    await expect(auditLogList.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Firestore read failed',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'audit.read',
      target: '*',
      request_id: 'req-audit-123',
      result: 'error',
      message: 'Firestore read failed',
    });
  });

  describe('denied audit role fidelity (no forgery)', () => {
    it('writes denied audit with actor=unknown role=unknown when unauthenticated', async () => {
      const req = createRequest({ auth: false });
      await expect(auditLogList.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'unknown',
          role: 'unknown',
          action: 'audit.read',
          target: '*',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with role=unknown when role claim is missing', async () => {
      const req = createRequest({ email: 'super@cam.hs.kr', role: undefined });
      await expect(auditLogList.run(req)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'super@cam.hs.kr',
          role: 'unknown',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit with role=unknown when role claim is invalid', async () => {
      const req = createRequest({ email: 'super@cam.hs.kr', role: 'other_role' as any });
      await expect(auditLogList.run(req)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'super@cam.hs.kr',
          role: 'unknown',
          result: 'denied',
        }),
      );
    });

    it('writes denied audit when domain is invalid', async () => {
      const req = createRequest({ email: 'intruder@example.com', role: 'super_admin' });
      await expect(auditLogList.run(req)).rejects.toMatchObject({ code: 'permission-denied' });
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'intruder@example.com',
          role: 'super_admin',
          result: 'denied',
        }),
      );
    });
  });
});
