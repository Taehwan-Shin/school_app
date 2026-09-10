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

  // v0.107d F46: 3 readAudit 호출 (detected + resolved + users.update_role) 순서.
  function mockThreeCalls(
    detected: any[],
    resolved: any[],
    updateRole: any[],
    opts: {
      detectedCursor?: number | null;
      resolvedCursor?: number | null;
      updateRoleCursor?: number | null;
    } = {},
  ) {
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: detected, nextCursor: opts.detectedCursor ?? null })
      .mockResolvedValueOnce({ entries: resolved, nextCursor: opts.resolvedCursor ?? null })
      .mockResolvedValueOnce({ entries: updateRole, nextCursor: opts.updateRoleCursor ?? null });
  }

  it('returns empty when no detected/resolved/update events', async () => {
    mockThreeCalls([], [], []);
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
    mockThreeCalls([detected], [], []);
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
    mockThreeCalls([detected], [resolved], []);
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toEqual([]);
  });

  // v0.107d F46: users.update_role 도 해소 신호로 인정 (Auth+Firestore 원자적 갱신).
  it('v0.107d F46: users.update_role (result=ok) 이 detected 이후면 unresolved 아님', async () => {
    const detected = makeEntry({ id: 'd-old', target: 'users/uid-A', at: 1725100000000 });
    const updateRole = makeEntry({
      id: 'ur-new',
      target: 'users/uid-A',
      at: 1725200000000,
      action: 'users.update_role',
      result: 'ok',
    });
    mockThreeCalls([detected], [], [updateRole]);
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toEqual([]);
  });

  it('v0.107d F46: users.update_role 이 detected 이전이면 detected 남음', async () => {
    const detected = makeEntry({ id: 'd-new', target: 'users/uid-A', at: 1725300000000 });
    const updateRole = makeEntry({
      id: 'ur-old',
      target: 'users/uid-A',
      at: 1725100000000,
      action: 'users.update_role',
      result: 'ok',
    });
    mockThreeCalls([detected], [], [updateRole]);
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].id).toBe('d-new');
  });

  it('keeps detected where detected.at > latest resolved.at (재감지)', async () => {
    const detectedNew = makeEntry({ id: 'd-new', target: 'users/uid-A', at: 1725300000000 });
    const detectedOld = makeEntry({ id: 'd-old', target: 'users/uid-A', at: 1725100000000 });
    const resolved = makeEntry({
      id: 'r-mid',
      target: 'users/uid-A',
      at: 1725200000000,
      action: 'system.role_split_resolved',
      result: 'ok',
    });
    mockThreeCalls([detectedNew, detectedOld], [resolved], []);
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].id).toBe('d-new');
  });

  it('requests readAudit with filterResult=ok for both resolved sources', async () => {
    mockThreeCalls([], [], []);
    const req = createRequest();
    await auditLogUnresolvedRoleSplits.run(req);
    // 2번째 호출: system.role_split_resolved + ok
    expect(mockReadAuditEntries).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        filterAction: 'system.role_split_resolved',
        filterResult: 'ok',
      }),
    );
    // 3번째 호출: users.update_role + ok (v0.107d F46)
    expect(mockReadAuditEntries).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        filterAction: 'users.update_role',
        filterResult: 'ok',
      }),
    );
  });

  it('surfaces detectedHasMore/resolvedHasMore when any of 3 scans exceed window', async () => {
    const detected = makeEntry({ id: 'd-1', target: 'users/uid-A', at: 1725100000000 });
    mockThreeCalls([detected], [], [], {
      detectedCursor: 1725000000000,
      updateRoleCursor: 1725000000000, // updateRole hasMore 도 resolvedHasMore 로 카운트.
    });
    const req = createRequest();
    const res = await auditLogUnresolvedRoleSplits.run(req);
    expect(res.detectedHasMore).toBe(true);
    expect(res.resolvedHasMore).toBe(true);
  });

  it('clamps scanLimit to [1, 1000]', async () => {
    mockThreeCalls([], [], []);
    const req = createRequest({ data: { scanLimit: 999999 } });
    await auditLogUnresolvedRoleSplits.run(req);
    expect(mockReadAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1000 }),
    );
  });

  it('audits success with counts in message', async () => {
    const detected = makeEntry({ id: 'd-1', target: 'users/uid-A', at: 1725100000000 });
    mockThreeCalls([detected], [], []);
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
