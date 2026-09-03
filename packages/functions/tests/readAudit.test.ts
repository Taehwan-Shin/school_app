import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

const mockGet = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockCollection = vi.fn();
const mockDb = { collection: mockCollection };

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return {
    ...actual,
    getFirestore: () => mockDb,
  };
});

import { readAuditEntries } from '../src/audit/readAudit.js';

describe('readAuditEntries unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const queryMock: any = {};
    queryMock.orderBy = mockOrderBy.mockReturnValue(queryMock);
    queryMock.where = mockWhere.mockReturnValue(queryMock);
    queryMock.limit = mockLimit.mockReturnValue(queryMock);
    queryMock.get = mockGet;

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

  it('applies before filter when before cursor timestamp is provided', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [],
    });

    await readAuditEntries({ limit: 20, before: 1700000005000 });

    expect(mockWhere).toHaveBeenCalledWith('at', '<', expect.any(Timestamp));
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it('sets nextCursor to last item timestamp when docs count equals limit', async () => {
    const mockDoc1 = {
      id: 'doc-1',
      data: () => ({
        actor: 'user1@cam.hs.kr',
        role: 'super_admin',
        action: 'audit.read',
        target: '*',
        request_id: 'req-1',
        result: 'ok',
        at: Timestamp.fromMillis(1700000002000),
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
        at: Timestamp.fromMillis(1700000001000),
      }),
    };

    mockGet.mockResolvedValueOnce({
      docs: [mockDoc1, mockDoc2],
    });

    const result = await readAuditEntries({ limit: 2 });

    expect(result.nextCursor).toBe(1700000001000);
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
});

