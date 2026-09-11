import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

const mockGet = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
// v0.118b F82: compound cursor 를 위해 startAfter 도 mock 대상.
const mockStartAfter = vi.fn();
const mockCountGet = vi.fn();
const mockCount = vi.fn(() => ({ get: mockCountGet }));
const mockCollection = vi.fn();
const mockDb = { collection: mockCollection };

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return {
    ...actual,
    getFirestore: () => mockDb,
  };
});

import { readAuditEntries, countAuditEntries } from '../src/audit/readAudit.js';

describe('readAuditEntries unit tests', () => {
  beforeEach(() => {
    // vi.clearAllMocks 는 호출 이력만 지우고 mockResolvedValueOnce 큐는 남긴다.
    // 테스트 간 오염 방지를 위해 mockGet 은 명시적으로 mockReset.
    mockGet.mockReset();
    vi.clearAllMocks();

    const queryMock: any = {};
    queryMock.orderBy = mockOrderBy.mockReturnValue(queryMock);
    queryMock.where = mockWhere.mockReturnValue(queryMock);
    queryMock.limit = mockLimit.mockReturnValue(queryMock);
    queryMock.startAfter = mockStartAfter.mockReturnValue(queryMock);
    queryMock.get = mockGet;
    queryMock.count = mockCount.mockReturnValue({ get: mockCountGet });
    mockCountGet.mockResolvedValue({ data: () => ({ count: 0 }) });

    mockCollection.mockReturnValue(queryMock);
  });

  it('queries audit_log ordered by at desc with given limit', async () => {
    const mockDoc1 = {
      id: 'doc-1',
      data: () => ({
        actor: 'user1@cam.hs.kr',
        role: 'super_admin',
        action: 'audit.read',
        target: '*',
        request_id: 'req-1',
        result: 'ok',
        at: Timestamp.fromMillis(1700000000000),
        message: 'msg-1',
      }),
    };

    mockGet.mockResolvedValueOnce({
      docs: [mockDoc1],
    });

    const result = await readAuditEntries({ limit: 50 });

    expect(mockCollection).toHaveBeenCalledWith('audit_log');
    expect(mockOrderBy).toHaveBeenCalledWith('at', 'desc');
    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(50);

    expect(result).toEqual({
      entries: [
        {
          id: 'doc-1',
          actor: 'user1@cam.hs.kr',
          role: 'super_admin',
          action: 'audit.read',
          target: '*',
          request_id: 'req-1',
          result: 'ok',
          at: 1700000000000,
          before: undefined,
          after: undefined,
          message: 'msg-1',
        },
      ],
      nextCursor: null,
    });
  });

  it('v0.118c F86: compound before cursor {seconds, nanoseconds, id} → full precision startAfter', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [],
    });

    await readAuditEntries({
      limit: 20,
      before: { seconds: 1700000005, nanoseconds: 123456000, id: 'doc-last' },
    });

    // startAfter 는 Timestamp (seconds/nanoseconds 로 재구성) + docId.
    expect(mockStartAfter).toHaveBeenCalledTimes(1);
    const [callArg1, callArg2] = mockStartAfter.mock.calls[0];
    expect(callArg1).toBeInstanceOf(Timestamp);
    expect((callArg1 as Timestamp).seconds).toBe(1700000005);
    expect((callArg1 as Timestamp).nanoseconds).toBe(123456000);
    expect(callArg2).toBe('doc-last');
    expect(mockLimit).toHaveBeenCalledWith(20);
    // 기존 where('at', '<', ...) 는 더 이상 쓰이지 않는다.
    expect(mockWhere).not.toHaveBeenCalledWith('at', '<', expect.anything());
  });

  it('v0.118c F86: sets nextCursor {seconds, nanoseconds, id} from last doc Timestamp full precision', async () => {
    const lastTs = new Timestamp(1700000001, 500_000_000); // 1700000001.5 s
    const mockDoc1 = {
      id: 'doc-1',
      data: () => ({
        actor: 'user1@cam.hs.kr',
        role: 'super_admin',
        action: 'audit.read',
        target: '*',
        request_id: 'req-1',
        result: 'ok',
        at: new Timestamp(1700000002, 0),
      }),
    };
    const mockDoc2 = {
      id: 'doc-2',
      data: () => ({
        actor: 'user2@cam.hs.kr',
        role: 'admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-2',
        result: 'ok',
        at: lastTs,
      }),
    };

    mockGet.mockResolvedValueOnce({
      docs: [mockDoc1, mockDoc2],
    });

    const result = await readAuditEntries({ limit: 2 });

    // v0.118c F86: nextCursor 는 Timestamp full precision + docId.
    expect(result.nextCursor).toEqual({
      seconds: 1700000001,
      nanoseconds: 500_000_000,
      id: 'doc-2',
    });
    expect(result.entries).toHaveLength(2);
  });

  it('falls back to Date.now() when doc at field is not a Timestamp', async () => {
    const mockDoc = {
      id: 'doc-no-ts',
      data: () => ({
        actor: 'user1@cam.hs.kr',
        role: 'admin',
        action: 'users.read',
        target: '*',
        request_id: 'req-1',
        result: 'ok',
      }),
    };

    mockGet.mockResolvedValueOnce({
      docs: [mockDoc],
    });

    const beforeTime = Date.now();
    const result = await readAuditEntries({ limit: 10 });
    const afterTime = Date.now();

    expect(result.entries[0].at).toBeGreaterThanOrEqual(beforeTime);
    expect(result.entries[0].at).toBeLessThanOrEqual(afterTime);
  });

  it('applies filterActor where clause when filterActor is provided', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({ limit: 50, filterActor: 'super@cam.hs.kr' });

    expect(mockWhere).toHaveBeenCalledWith('actor', '==', 'super@cam.hs.kr');
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('applies filterTarget and filterResult where clauses when combined', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      filterTarget: 'users/u123',
      filterResult: 'ok',
    });

    expect(mockWhere).toHaveBeenCalledWith('target', '==', 'users/u123');
    expect(mockWhere).toHaveBeenCalledWith('result', '==', 'ok');
    expect(mockWhere).toHaveBeenCalledTimes(2);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('applies filterAction where clause when filterAction is provided (v0.101)', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      filterAction: 'users.update_role',
    });

    expect(mockWhere).toHaveBeenCalledWith('action', '==', 'users.update_role');
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  // v0.104b F39: dedup 은 callable 경계 책임으로 이동. readAudit 은 입력을 verbatim
  // 그대로 in-where 에 전달 (callable audit log 와 query 가 같은 정규화 배열을 쓰도록).
  it('v0.104b F39: filterActions 다중 → `in` where 에 verbatim 전달 (dedup 은 상위 계약)', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      filterActions: ['users.update_role', 'users.read'],
    });

    expect(mockWhere).toHaveBeenCalledWith('action', 'in', [
      'users.update_role',
      'users.read',
    ]);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it('v0.104: filterActions 단일 원소 → `==` where 로 축약 (index 재사용)', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      filterActions: ['users.read'],
    });

    expect(mockWhere).toHaveBeenCalledWith('action', '==', 'users.read');
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it('v0.104: filterActions 가 있으면 filterAction 은 무시', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      filterActions: ['a', 'b'],
      filterAction: 'unused',
    });

    expect(mockWhere).toHaveBeenCalledWith('action', 'in', ['a', 'b']);
    expect(mockWhere).not.toHaveBeenCalledWith('action', '==', 'unused');
  });

  it('does not apply any filter where clauses when no filters are provided', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({ limit: 30 });

    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(30);
  });

  it('applies atMin filter (at >= atMin) when atMin is provided', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({ limit: 50, atMin: 1700000000000 });

    expect(mockWhere).toHaveBeenCalledWith('at', '>=', expect.any(Timestamp));
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('applies atMax filter (at <= atMax) when atMax is provided', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({ limit: 50, atMax: 1700000005000 });

    expect(mockWhere).toHaveBeenCalledWith('at', '<=', expect.any(Timestamp));
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('applies both atMin and atMax filters when both are provided', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      atMin: 1700000000000,
      atMax: 1700000005000,
    });

    expect(mockWhere).toHaveBeenCalledWith('at', '>=', expect.any(Timestamp));
    expect(mockWhere).toHaveBeenCalledWith('at', '<=', expect.any(Timestamp));
    expect(mockWhere).toHaveBeenCalledTimes(2);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('combines actor filter with atMin and atMax filters', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    await readAuditEntries({
      limit: 50,
      filterActor: 'super@cam.hs.kr',
      atMin: 1700000000000,
      atMax: 1700000005000,
    });

    expect(mockWhere).toHaveBeenCalledWith('at', '>=', expect.any(Timestamp));
    expect(mockWhere).toHaveBeenCalledWith('at', '<=', expect.any(Timestamp));
    expect(mockWhere).toHaveBeenCalledWith('actor', '==', 'super@cam.hs.kr');
    expect(mockWhere).toHaveBeenCalledTimes(3);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  describe('countAuditEntries', () => {
    it('counts with filterActor only', async () => {
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 7 }),
      });

      const count = await countAuditEntries({ filterActor: 'admin@cam.hs.kr' });

      expect(mockCollection).toHaveBeenCalledWith('audit_log');
      expect(mockWhere).toHaveBeenCalledWith('actor', '==', 'admin@cam.hs.kr');
      expect(mockWhere).toHaveBeenCalledTimes(1);
      expect(mockCount).toHaveBeenCalled();
      expect(count).toBe(7);
    });

    it('counts with atMin and filterResult combined', async () => {
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 3 }),
      });

      const count = await countAuditEntries({
        atMin: 1700000000000,
        filterResult: 'error',
      });

      expect(mockCollection).toHaveBeenCalledWith('audit_log');
      expect(mockWhere).toHaveBeenCalledWith('at', '>=', expect.any(Timestamp));
      expect(mockWhere).toHaveBeenCalledWith('result', '==', 'error');
      expect(mockWhere).toHaveBeenCalledTimes(2);
      expect(mockCount).toHaveBeenCalled();
      expect(count).toBe(3);
    });

    it('counts empty collection returning 0', async () => {
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 0 }),
      });

      const count = await countAuditEntries({});

      expect(mockCollection).toHaveBeenCalledWith('audit_log');
      expect(mockWhere).not.toHaveBeenCalled();
      expect(mockCount).toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });
});

