import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

const mockCountAuditEntries = vi.fn();
const mockReadAuditEntries = vi.fn();
vi.mock('../src/audit/readAudit.js', () => ({
  countAuditEntries: (...args: any[]) => mockCountAuditEntries(...args),
  readAuditEntries: (...args: any[]) => mockReadAuditEntries(...args),
}));

import { auditLogSummary } from '../src/callable/audit/summary.js';
import type { AuditLogEntryRead } from '../src/audit/readAudit.js';

describe('auditLogSummary callable unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAudit.mockResolvedValue(undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    // v0.120: summary 는 이제 readAuditEntries 를 2 회 호출 (preview + sample).
    // 각 test 가 개별 mockResolvedValueOnce 를 override 하지 않는 한 기본으로 빈
    // 결과를 돌려주도록 default 지정.
    mockReadAuditEntries.mockResolvedValue({ entries: [], nextCursor: null });
    mockCountAuditEntries.mockResolvedValue(0);
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
    const requestId = options.requestId !== undefined ? options.requestId : 'req-summary-123';
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

  it('1. rejects unauthenticated request and writes denied audit log with target=dashboard:super_admin', async () => {
    const req = createRequest({ auth: false });
    await expect(auditLogSummary.run(req)).rejects.toMatchObject({ code: 'unauthenticated' });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'unknown',
        role: 'unknown',
        action: 'audit.read',
        target: 'dashboard:super_admin',
        result: 'denied',
      }),
    );
    expect(mockCountAuditEntries).not.toHaveBeenCalled();
    expect(mockReadAuditEntries).not.toHaveBeenCalled();
  });

  it('2. rejects teacher without capability and writes denied audit log with target=dashboard:super_admin', async () => {
    const req = createRequest({ email: 'teacher@cam.hs.kr', role: 'teacher' });
    await expect(auditLogSummary.run(req)).rejects.toMatchObject({ code: 'permission-denied' });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'audit.read',
      target: 'dashboard:super_admin',
      request_id: 'req-summary-123',
      result: 'denied',
      message: 'audit.read',
    });
    expect(mockCountAuditEntries).not.toHaveBeenCalled();
    expect(mockReadAuditEntries).not.toHaveBeenCalled();
  });

  it('3. returns count, entries, snapshotAt and generatedAt when no filter specified, and writes ok audit log', async () => {
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.write',
        target: 'user@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: 1700000000000,
        message: 'updated',
      },
    ];

    mockCountAuditEntries.mockResolvedValueOnce(42);
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: mockEntries,
      nextCursor: null,
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin', data: {} });
    const beforeTime = Date.now();
    const result = await auditLogSummary.run(req);
    const afterTime = Date.now();

    expect(result.count).toBe(42);
    expect(result.entries).toEqual(mockEntries);
    expect(result.snapshotAt).toBeGreaterThanOrEqual(beforeTime);
    expect(result.snapshotAt).toBeLessThanOrEqual(afterTime);
    expect(result.generatedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(result.generatedAt).toBeLessThanOrEqual(afterTime);
    expect(result.snapshotAt).toBe(result.generatedAt);

    expect(mockCountAuditEntries).toHaveBeenCalledWith({
      atMin: undefined,
      atMax: result.snapshotAt,
    });
    // v0.120: readAuditEntries 는 2 회 호출 (preview limit=5, sample limit=500).
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 5,
      atMin: undefined,
      atMax: result.snapshotAt,
    });
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 500,
      atMin: undefined,
      atMax: result.snapshotAt,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: 'req-summary-123',
        result: 'ok',
        message: expect.stringMatching(
          /^summarized 42 entries \(sample=\d+, truncated=(true|false)\) \[snapshot=.*, generated=.*\]$/,
        ),
      }),
    );
  });

  it('4. applies atMin filter and passes identical effectiveAtMax to both count and read helpers', async () => {
    mockCountAuditEntries.mockResolvedValueOnce(10);
    mockReadAuditEntries.mockResolvedValueOnce({
      entries: [],
      nextCursor: null,
    });

    const atMin = 1700000000000;
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { atMin },
    });
    const result = await auditLogSummary.run(req);

    expect(result.count).toBe(10);
    expect(mockCountAuditEntries).toHaveBeenCalledWith({
      atMin,
      atMax: result.snapshotAt,
    });
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 5,
      atMin,
      atMax: result.snapshotAt,
    });
  });

  it('5. clamps client atMax to snapshot boundary if in the future, or uses earlier client atMax', async () => {
    mockCountAuditEntries.mockResolvedValue(5);
    mockReadAuditEntries.mockResolvedValue({
      entries: [],
      nextCursor: null,
    });

    const pastAtMax = 1600000000000;
    const reqA = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { atMax: pastAtMax },
    });
    const resultA = await auditLogSummary.run(reqA);
    expect(mockCountAuditEntries).toHaveBeenCalledWith({
      atMin: undefined,
      atMax: pastAtMax,
    });
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 5,
      atMin: undefined,
      atMax: pastAtMax,
    });
    expect(resultA.snapshotAt).toBe(pastAtMax);
    expect(resultA.generatedAt).toBeGreaterThan(pastAtMax);

    mockCountAuditEntries.mockClear();
    mockReadAuditEntries.mockClear();
    const futureAtMax = Date.now() + 1000000;
    const reqB = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { atMax: futureAtMax },
    });
    const resultB = await auditLogSummary.run(reqB);
    expect(mockCountAuditEntries).toHaveBeenCalledWith({
      atMin: undefined,
      atMax: resultB.snapshotAt,
    });
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 5,
      atMin: undefined,
      atMax: resultB.snapshotAt,
    });
    expect(resultB.snapshotAt).toBe(resultB.generatedAt);
    expect(resultB.snapshotAt).toBeLessThan(futureAtMax);
  });

  it('6. executes queries via Promise.all and writes ok audit log strictly after queries resolve', async () => {
    const executionOrder: string[] = [];

    mockCountAuditEntries.mockImplementation(async () => {
      executionOrder.push('count-start');
      await new Promise((res) => setTimeout(res, 10));
      executionOrder.push('count-finish');
      return 7;
    });

    mockReadAuditEntries.mockImplementation(async () => {
      executionOrder.push('read-start');
      await new Promise((res) => setTimeout(res, 10));
      executionOrder.push('read-finish');
      return { entries: [], nextCursor: null };
    });

    mockWriteAudit.mockImplementation(async () => {
      executionOrder.push('write-audit');
    });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    const result = await auditLogSummary.run(req);

    expect(result.count).toBe(7);
    expect(executionOrder).toContain('count-finish');
    expect(executionOrder).toContain('read-finish');
    expect(executionOrder[executionOrder.length - 1]).toBe('write-audit');
  });

  it('7. writes error audit log and throws unknown HttpsError if query fails', async () => {
    mockCountAuditEntries.mockRejectedValueOnce(new Error('DB read error'));
    mockReadAuditEntries.mockResolvedValueOnce({ entries: [], nextCursor: null });

    const req = createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' });
    await expect(auditLogSummary.run(req)).rejects.toMatchObject({
      code: 'unknown',
      message: 'DB read error',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'audit.read',
      target: 'dashboard:super_admin',
      request_id: 'req-summary-123',
      result: 'error',
      message: 'DB read error',
    });
  });

  it('8. clamps client atMax in the future so that snapshotAt equals generatedAt', async () => {
    mockCountAuditEntries.mockResolvedValueOnce(3);
    mockReadAuditEntries.mockResolvedValueOnce({ entries: [], nextCursor: null });

    const futureAtMax = Date.now() + 5000000;
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { atMax: futureAtMax },
    });

    const result = await auditLogSummary.run(req);

    expect(result.snapshotAt).toBe(result.generatedAt);
    expect(result.snapshotAt).toBeLessThan(futureAtMax);
    expect(mockCountAuditEntries).toHaveBeenCalledWith({
      atMin: undefined,
      atMax: result.snapshotAt,
    });
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 5,
      atMin: undefined,
      atMax: result.snapshotAt,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(
          /^summarized 3 entries \(sample=\d+, truncated=(true|false)\) \[snapshot=.*, generated=.*\]$/,
        ),
      }),
    );
  });

  it('9. preserves client atMax in the past so that snapshotAt equals clientAtMax and differs from generatedAt', async () => {
    mockCountAuditEntries.mockResolvedValueOnce(2);
    mockReadAuditEntries.mockResolvedValueOnce({ entries: [], nextCursor: null });

    const pastAtMax = Date.now() - 3600000;
    const req = createRequest({
      email: 'super@cam.hs.kr',
      role: 'super_admin',
      data: { atMax: pastAtMax },
    });

    const beforeTime = Date.now();
    const result = await auditLogSummary.run(req);
    const afterTime = Date.now();

    expect(result.snapshotAt).toBe(pastAtMax);
    expect(result.generatedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(result.generatedAt).toBeLessThanOrEqual(afterTime);
    expect(result.snapshotAt).not.toBe(result.generatedAt);

    expect(mockCountAuditEntries).toHaveBeenCalledWith({
      atMin: undefined,
      atMax: pastAtMax,
    });
    expect(mockReadAuditEntries).toHaveBeenCalledWith({
      limit: 5,
      atMin: undefined,
      atMax: pastAtMax,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(
          /^summarized 2 entries \(sample=\d+, truncated=(true|false)\) \[snapshot=.*, generated=.*\]$/,
        ),
      }),
    );
  });

  // v0.120: action breakdown 신규 회귀.
  it('v0.120: actionCounts 는 sample 을 in-memory grouping. sampleTruncated=false 시 count === sampleSize', async () => {
    const sampleEntries: AuditLogEntryRead[] = [
      { id: 'a', actor: 'x@cam.hs.kr', role: 'admin', action: 'users.read', target: '*', request_id: 'r1', result: 'ok', at: 1 },
      { id: 'b', actor: 'x@cam.hs.kr', role: 'admin', action: 'users.read', target: '*', request_id: 'r2', result: 'ok', at: 2 },
      { id: 'c', actor: 'x@cam.hs.kr', role: 'admin', action: 'users.write', target: '*', request_id: 'r3', result: 'ok', at: 3 },
    ];
    mockCountAuditEntries.mockResolvedValueOnce(3);
    // preview + sample 을 순서대로 반환.
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: sampleEntries.slice(0, 5), nextCursor: null })
      .mockResolvedValueOnce({ entries: sampleEntries, nextCursor: null });

    const result = await auditLogSummary.run(
      createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' }),
    );
    expect(result.actionCounts).toEqual({ 'users.read': 2, 'users.write': 1 });
    expect(result.sampleSize).toBe(3);
    expect(result.sampleTruncated).toBe(false);
  });

  it('v0.120: count > sampleSize 이면 sampleTruncated=true', async () => {
    const sampleEntries: AuditLogEntryRead[] = Array.from({ length: 500 }, (_, i) => ({
      id: `log-${i}`,
      actor: 'x@cam.hs.kr',
      role: 'admin' as const,
      action: i % 2 === 0 ? 'users.read' : 'users.write',
      target: '*',
      request_id: `r-${i}`,
      result: 'ok' as const,
      at: i,
    }));
    mockCountAuditEntries.mockResolvedValueOnce(1234);
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: sampleEntries.slice(0, 5), nextCursor: null })
      .mockResolvedValueOnce({ entries: sampleEntries, nextCursor: { at: 0 } as any });

    const result = await auditLogSummary.run(
      createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' }),
    );
    expect(result.count).toBe(1234);
    expect(result.sampleSize).toBe(500);
    expect(result.sampleTruncated).toBe(true);
    expect(result.actionCounts).toEqual({ 'users.read': 250, 'users.write': 250 });
  });

  it('v0.120: 빈 결과 → actionCounts={} · sampleTruncated=false', async () => {
    mockCountAuditEntries.mockResolvedValueOnce(0);
    mockReadAuditEntries
      .mockResolvedValueOnce({ entries: [], nextCursor: null })
      .mockResolvedValueOnce({ entries: [], nextCursor: null });

    const result = await auditLogSummary.run(
      createRequest({ email: 'super@cam.hs.kr', role: 'super_admin' }),
    );
    expect(result.actionCounts).toEqual({});
    expect(result.sampleSize).toBe(0);
    expect(result.sampleTruncated).toBe(false);
  });
});
