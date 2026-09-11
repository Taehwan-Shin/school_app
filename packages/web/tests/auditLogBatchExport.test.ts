import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallAuditLogList = vi.fn();
vi.mock('../src/api/auditLogList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/auditLogList')>();
  return {
    ...actual,
    callAuditLogList: (data: unknown) => mockCallAuditLogList(data),
  };
});

import { fetchAllAuditLog } from '../src/api/auditLogBatchExport';

function entry(id: string, at: number) {
  return {
    id,
    actor: 'admin@cam.hs.kr',
    role: 'admin' as const,
    action: 'users.read',
    target: 'users/*',
    request_id: `req-${id}`,
    result: 'ok' as const,
    at,
  };
}

describe('fetchAllAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('단일 페이지 (nextCursor=null) 는 한 번만 호출하고 반환', async () => {
    mockCallAuditLogList.mockResolvedValueOnce({
      entries: [entry('a', 3), entry('b', 2), entry('c', 1)],
      nextCursor: null,
    });
    const progress: any[] = [];
    const result = await fetchAllAuditLog(
      { filterActor: 'admin@cam.hs.kr' },
      { pageSize: 3, onProgress: (p) => progress.push(p) },
    );
    expect(mockCallAuditLogList).toHaveBeenCalledTimes(1);
    expect(mockCallAuditLogList).toHaveBeenCalledWith(
      expect.objectContaining({ filterActor: 'admin@cam.hs.kr', limit: 3 }),
    );
    expect(result.entries).toHaveLength(3);
    expect(result.pages).toBe(1);
    expect(result.hitCap).toBe(false);
    expect(result.aborted).toBe(false);
    expect(progress).toEqual([{ page: 1, fetched: 3, hasMore: false }]);
  });

  it('다중 페이지 - nextCursor 를 before 로 전달하며 순회', async () => {
    mockCallAuditLogList
      .mockResolvedValueOnce({
        entries: [entry('a', 3), entry('b', 2)],
        nextCursor: 2,
      })
      .mockResolvedValueOnce({
        entries: [entry('c', 1)],
        nextCursor: null,
      });
    const result = await fetchAllAuditLog({}, { pageSize: 2 });
    expect(mockCallAuditLogList).toHaveBeenCalledTimes(2);
    // 첫 요청은 before 없음.
    expect(mockCallAuditLogList).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({ before: expect.anything() }),
    );
    // 두 번째 요청은 before=2.
    expect(mockCallAuditLogList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ before: 2, limit: 2 }),
    );
    expect(result.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(result.hitCap).toBe(false);
  });

  it('maxPages 상한 도달 → hitCap=true · 이후 페이지 미시도', async () => {
    mockCallAuditLogList
      .mockResolvedValueOnce({ entries: [entry('a', 3)], nextCursor: 3 })
      .mockResolvedValueOnce({ entries: [entry('b', 2)], nextCursor: 2 });
    const result = await fetchAllAuditLog({}, { pageSize: 1, maxPages: 2 });
    expect(mockCallAuditLogList).toHaveBeenCalledTimes(2);
    expect(result.pages).toBe(2);
    expect(result.hitCap).toBe(true);
    expect(result.entries).toHaveLength(2);
  });

  it('signal.aborted 로 중도 취소 → aborted=true · 이후 페이지 미시도', async () => {
    const controller = new AbortController();
    mockCallAuditLogList
      .mockImplementationOnce(async () => {
        // 첫 페이지 후 취소.
        controller.abort();
        return { entries: [entry('a', 2)], nextCursor: 2 };
      })
      .mockResolvedValue({ entries: [entry('b', 1)], nextCursor: null });
    const result = await fetchAllAuditLog(
      {},
      { pageSize: 1, signal: controller.signal },
    );
    expect(mockCallAuditLogList).toHaveBeenCalledTimes(1);
    expect(result.aborted).toBe(true);
    expect(result.entries).toHaveLength(1);
  });

  it('시작 전에 이미 abort 된 signal → 아무 페이지도 요청 안 함', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await fetchAllAuditLog({}, { signal: controller.signal });
    expect(mockCallAuditLogList).not.toHaveBeenCalled();
    expect(result.aborted).toBe(true);
    expect(result.pages).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it('filters 를 매 요청에 그대로 전달', async () => {
    mockCallAuditLogList.mockResolvedValueOnce({ entries: [], nextCursor: null });
    await fetchAllAuditLog(
      {
        filterActor: 'a@cam.hs.kr',
        filterTarget: 'courses/c-1',
        filterResult: 'ok',
        filterActions: ['users.read', 'users.write'],
        atMin: 1_000_000,
        atMax: 2_000_000,
      },
      { pageSize: 50 },
    );
    expect(mockCallAuditLogList).toHaveBeenCalledWith({
      filterActor: 'a@cam.hs.kr',
      filterTarget: 'courses/c-1',
      filterResult: 'ok',
      filterActions: ['users.read', 'users.write'],
      atMin: 1_000_000,
      atMax: 2_000_000,
      limit: 50,
    });
  });
});
