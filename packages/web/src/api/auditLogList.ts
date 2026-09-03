import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

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

export interface AuditLogListRequest {
  limit?: number;
  before?: number;
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}

export interface AuditLogListResponse {
  entries: AuditLogEntryRead[];
  nextCursor: number | null;
}

export async function callAuditLogList(
  data: AuditLogListRequest = {}
): Promise<AuditLogListResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  // 프로덕션: Cloud Functions 직접 URL. Firebase Hosting rewrite 는 커스텀 헤더 (X-Google-Access-Token) 를 서버까지 전달하지 못하는 경우가 있어 함수 URL 로 직접 호출.
  // 개발: 로컬 emulator 직접 호출.
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/auditLogList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/auditLogList`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,
      'X-Google-Scopes': '',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { ...data, _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as AuditLogListResponse;
}

export interface AuditLogFilters {
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
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
  const [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const fetchPage = useCallback(
    async (targetCursor?: number, isReload = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await callAuditLogList({
          limit: pageSize,
          before: targetCursor,
          ...filters,
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
    [pageSize, filters?.filterActor, filters?.filterTarget, filters?.filterResult, filters?.atMin, filters?.atMax]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntries([]);
    setCursor(undefined);
    callAuditLogList({ limit: pageSize, ...filters })
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
  }, [pageSize, fetchTrigger, filters?.filterActor, filters?.filterTarget, filters?.filterResult, filters?.atMin, filters?.atMax]);

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
