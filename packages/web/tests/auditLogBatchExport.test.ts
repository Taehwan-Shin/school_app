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
      nextCursor: null as null,
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

  it('다중 페이지 - nextCursor 를 before 로 전달하며 순회 (v0.118b F82: compound cursor)', async () => {
    mockCallAuditLogList
      .mockResolvedValueOnce({
        entries: [entry('a', 3), entry('b', 2)],
        nextCursor: { at: 2, id: 'b' },
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
    // 두 번째 요청은 compound before={at, id}.
    expect(mockCallAuditLogList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ before: { at: 2, id: 'b' }, limit: 2 }),
    );
    expect(result.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(result.hitCap).toBe(false);
  });

  it('maxPages 상한 도달 → hitCap=true · 이후 페이지 미시도', async () => {
    mockCallAuditLogList
      .mockResolvedValueOnce({ entries: [entry('a', 3)], nextCursor: { at: 3, id: 'a' } })
      .mockResolvedValueOnce({ entries: [entry('b', 2)], nextCursor: { at: 2, id: 'b' } });
    const result = await fetchAllAuditLog({}, { pageSize: 1, maxPages: 2 });
    expect(mockCallAuditLogList).toHaveBeenCalledTimes(2);
    expect(result.pages).toBe(2);
    expect(result.hitCap).toBe(true);
    expect(result.entries).toHaveLength(2);
  });

  it('signal.aborted 로 loop 시작 시점 검사 → aborted=true · 이후 페이지 미시도', async () => {
    const controller = new AbortController();
    mockCallAuditLogList
      .mockImplementationOnce(async () => {
        // 첫 페이지 후 취소 (응답은 아직 반환하기 전).
        controller.abort();
        return { entries: [entry('a', 2)], nextCursor: { at: 2, id: 'a' } };
      })
      .mockResolvedValue({ entries: [entry('b', 1)], nextCursor: null });
    const result = await fetchAllAuditLog(
      {},
      { pageSize: 1, signal: controller.signal },
    );
    expect(mockCallAuditLogList).toHaveBeenCalledTimes(1);
    expect(result.aborted).toBe(true);
    // v0.118b F83: await 뒤 abort 재검사가 있으므로 entries 는 첫 응답을 담기 전에 끊긴다.
    expect(result.entries).toHaveLength(0);
  });

  // v0.118b F83: fetch signal 을 request 로 forward 해야 네트워크 취소가 실제로 동작.
  it('F83: signal 을 각 request 로 forward', async () => {
    const controller = new AbortController();
    mockCallAuditLogList.mockResolvedValue({ entries: [], nextCursor: null });
    await fetchAllAuditLog({}, { signal: controller.signal });
    expect(mockCallAuditLogList).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
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
