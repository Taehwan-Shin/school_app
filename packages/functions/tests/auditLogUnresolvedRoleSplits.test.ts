import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockReadAuditEntries = vi.fn();
vi.mock('../src/audit/readAudit.js', () => ({
  readAuditEntries: (...args: any[]) => mockReadAuditEntries(...args),
}));

import { auditLogUnresolvedRoleSplits } from '../src/callable/audit/unresolvedRoleSplits.js';

function makeEntry(
  overrides: Partial<{
    id: string;
    target: string;
    at: number;
    action: string;
    result: 'ok' | 'error' | 'denied';
    message: string;
  }>,
): any {
  return {
    id: overrides.id ?? 'log-x',
    actor: 'super@cam.hs.kr',
    role: 'super_admin',
    action: overrides.action ?? 'system.role_split_detected',
    target: overrides.target ?? 'users/uid-A',
    request_id: 'req-1',
    result: overrides.result ?? 'error',
    at: overrides.at ?? 1725100000000,
    message: overrides.message,
  };
}

describe('auditLogUnresolvedRoleSplits unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  function createRequest(
    options: {
      role?: any;
      auth?: boolean;
      data?: any;
    } = {},
  ) {
    const hasAuth = options.auth !== false;
    const role = 'role' in options ? options.role : 'super_admin';
    return {
      data: options.data ?? {},
      auth: hasAuth ? { token: { email: 'super@cam.hs.kr', role }, uid: 'uid-a' } : null,
      rawRequest: {
        headers: {
          'x-google-access-token': 'valid-google-token',
          'x-request-id': 'req-uv-1',
        },
      },
    } as any;
  }

  it('rejects unauthenticated request', async () => {
    const req = createRequest({ auth: false });
    await expect(auditLogUnresolvedRoleSplits.run(req)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'audit.read', result: 'denied' }),
    );
  });

  it('rejects teacher (missing audit.read cap)', async () => {
    const req = createRequest({ role: 'teacher' });
    await expect(auditLogUnresolvedRoleSplits.run(req)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('returns empty when no detected/resolved events', async () => {
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [], nextCursor: null })
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toEqual([]);
    expect(res.scannedDetected).toBe(0);
    expect(res.scannedResolved).toBe(0);
    expect(res.detectedHasMore).toBe(false);
    expect(res.resolvedHasMore).toBe(false);
  });

  it('returns detected without any resolved as unresolved', async () => {
    const detected = makeEntry({ id: 'd-1', target: 'users/uid-A', at: 1725100000000 });
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [detected], nextCursor: null })
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].id).toBe('d-1');
  });

  it('filters out detected where resolved.at > detected.at (target별 최신)', async () => {
    const detected = makeEntry({ id: 'd-old', target: 'users/uid-A', at: 1725100000000 });
    const resolved = makeEntry({
      id: 'r-new',
      target: 'users/uid-A',
      at: 1725200000000,
      action: 'system.role_split_resolved',
      result: 'ok',
    });
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [detected], nextCursor: null })
      .mockResolvedValueOnce({ entries: [resolved], nextCursor: null });
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toEqual([]);
  });

  it('keeps detected where detected.at > latest resolved.at (재감지)', async () => {
    // Note: readAudit returns at desc — 최신 첫 번째.
    const detectedNew = makeEntry({ id: 'd-new', target: 'users/uid-A', at: 1725300000000 });
    const detectedOld = makeEntry({ id: 'd-old', target: 'users/uid-A', at: 1725100000000 });
    const resolved = makeEntry({
      id: 'r-mid',
      target: 'users/uid-A',
      at: 1725200000000,
      action: 'system.role_split_resolved',
      result: 'ok',
    });
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [detectedNew, detectedOld], nextCursor: null })
      .mockResolvedValueOnce({ entries: [resolved], nextCursor: null });
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toHaveLength(1);
    // target 별로 최신 detected 만 남기고, resolved.at 이후이면 unresolved.
    expect(res.entries[0].id).toBe('d-new');
  });

  it('requests readAudit with filterResult=ok for resolved feed (denied/error 는 상태 전이 아님)', async () => {
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [], nextCursor: null })
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    const req = createRequest();
    await auditLogUnresolvedRoleSplits.run(req);
    // 2번째 호출이 resolved feed.
    expect(mockReadAuditEntries).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        filterAction: 'system.role_split_resolved',
        filterResult: 'ok',
      }),
    );
  });

  it('surfaces detectedHasMore/resolvedHasMore when scan window exceeded', async () => {
    const detected = makeEntry({ id: 'd-1', target: 'users/uid-A', at: 1725100000000 });
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [detected], nextCursor: 1725000000000 })
      .mockResolvedValueOnce({ entries: [], nextCursor: 1725000000000 });
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.detectedHasMore).toBe(true);
    expect(res.resolvedHasMore).toBe(true);
  });

  it('clamps scanLimit to [1, 1000]', async () => {
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [], nextCursor: null })
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    const req = createRequest({ data: { scanLimit: 999999 } });
    await auditLogUnresolvedRoleSplits.run(req);
    expect(mockReadAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1000 }),
    );
  });

  it('audits success with counts in message', async () => {
    const detected = makeEntry({ id: 'd-1', target: 'users/uid-A', at: 1725100000000 });
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [detected], nextCursor: null })
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    const req = createRequest();
    await auditLogUnresolvedRoleSplits.run(req);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'audit.read',
        target: 'system.role_split_unresolved',
        result: 'ok',
        message: expect.stringContaining('unresolved=1'),
      }),
    );
  });
});
