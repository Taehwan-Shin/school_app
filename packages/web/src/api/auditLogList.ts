import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { callCallable } from './callCallable';

export interface AuditLogEntryRead {
  id: string;
  actor: string;
  role: 'super_admin' | 'admin' | 'teacher' | 'unknown';
  action: string;
  target: string;
  request_id: string;
  result: 'ok' | 'error' | 'denied';
  at: number;
  before?: unknown;
  after?: unknown;
  message?: string;
}

// v0.118b F82 / v0.118c F86: compound cursor (Firestore Timestamp + documentId)
// 로 tiebreak. Firestore Timestamp 는 microsecond 정밀도라 ms 만 보존하면
// sub-ms 이벤트가 경계에서 유실. seconds/nanoseconds 로 full precision 보존.
export interface AuditLogCursor {
  seconds: number;
  nanoseconds: number;
  id: string;
}

export interface AuditLogListRequest {
  limit?: number;
  before?: AuditLogCursor;
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
  filterAction?: string;
  filterActions?: string[]; // v0.104: 다중 액션
  // v0.118b F83: fetch 취소용. callAuditLogList 은 이 signal 을 fetch 로 forward.
  signal?: AbortSignal;
}

export interface AuditLogListResponse {
  entries: AuditLogEntryRead[];
  nextCursor: AuditLogCursor | null;
}

export async function callAuditLogList(
  data: AuditLogListRequest = {}
): Promise<AuditLogListResponse> {
  const { signal, ...rest } = data;
  return callCallable<Omit<AuditLogListRequest, 'signal'>, AuditLogListResponse>(
    'auditLogList',
    rest,
    { signal },
  );
}

export interface AuditLogFilters {
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
  filterAction?: string;
  filterActions?: string[]; // v0.104
  atMin?: number;
  atMax?: number;
}

export type UseAuditLogListOptions = AuditLogFilters;

export function useAuditLogList(
  pageSize = 25,
  filters?: UseAuditLogListOptions
): {
  entries: AuditLogEntryRead[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
} {
  const [entries, setEntries] = useState<AuditLogEntryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<AuditLogCursor | null | undefined>(undefined);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // v0.143: 마지막 exhaustive-deps warning 4건 해소 (auditLogList).
  // (1) filters 는 호출측 인라인 객체라 매 렌더 새 참조 · 각 필드를 원시로 분해.
  // (2) filterActions 배열도 참조 신규 위험 → join(',') 로 안정 문자열 (key)
  //     추출해 dep array 의 complex expression 경고 해소.
  const filterActor = filters?.filterActor;
  const filterTarget = filters?.filterTarget;
  const filterResult = filters?.filterResult;
  const filterAction = filters?.filterAction;
  const filterActionsList = filters?.filterActions;
  const atMin = filters?.atMin;
  const atMax = filters?.atMax;
  // v0.143b Codex F127: join(',') 은 ['a,b','c'] vs ['a','b,c'] 충돌. JSON
  // 직렬화로 정확 key.
  const filterActionsKey = useMemo(
    () => JSON.stringify(filterActionsList ?? []),
    [filterActionsList],
  );

  const fetchPage = useCallback(
    async (targetCursor?: AuditLogCursor, isReload = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await callAuditLogList({
          limit: pageSize,
          before: targetCursor,
          filterActor,
          filterTarget,
          filterResult,
          filterAction,
          filterActions: filterActionsList,
          atMin,
          atMax,
        });
        if (isReload) {
          setEntries(res.entries);
        } else {
          setEntries((prev) =>
            targetCursor !== undefined ? [...prev, ...res.entries] : res.entries
          );
        }
        setCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    // filterActionsList 는 참조 신규 위험 있어 filterActionsKey (정규화 문자열)
    // 로 변경 감지. list 자체는 dep 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageSize, filterActor, filterTarget, filterResult, filterAction, filterActionsKey, atMin, atMax]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntries([]);
    setCursor(undefined);
    callAuditLogList({
      limit: pageSize,
      filterActor,
      filterTarget,
      filterResult,
      filterAction,
      filterActions: filterActionsList,
      atMin,
      atMax,
    })
      .then((res) => {
        if (!cancelled) {
          setEntries(res.entries);
          setCursor(res.nextCursor);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // filterActionsList 는 참조 신규 위험 · filterActionsKey 로 대체 감지.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, fetchTrigger, filterActor, filterTarget, filterResult, filterAction, filterActionsKey, atMin, atMax]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || cursorRef.current === null || cursorRef.current === undefined) {
      return;
    }
    fetchPage(cursorRef.current, false);
  }, [fetchPage]);

  const reload = useCallback(() => {
    setFetchTrigger((c) => c + 1);
  }, []);

  const hasMore = cursor !== null;

  return {
    entries,
    loading,
    error,
    hasMore,
    loadMore,
    reload,
  };
}
