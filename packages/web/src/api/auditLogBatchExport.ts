import {
  callAuditLogList,
  type AuditLogEntryRead,
  type AuditLogFilters,
  type AuditLogListRequest,
} from './auditLogList';

// v0.118: 감사 로그 배치 export. 기존 `handleExportJson` (v0.108) 은 현재 페이지
// filteredEntries 만 밀어냈다. 이 helper 는 서버 페이지를 hasMore=false 까지 순회해
// 하나의 통합 export payload 를 만든다.
//
// 안전 장치:
// - `maxPages` 로 브라우저 메모리·서버 부하 상한. 초과 시 `hitCap=true` 로 partial 표시.
// - `signal` (AbortSignal) 로 중도 취소. 취소 시 `aborted=true` + 이미 받은 페이지 반환.
// - 각 페이지 완료 시 `onProgress` 로 UI 갱신.

export interface AuditBatchExportProgress {
  /** 지금까지 완료된 요청 페이지 수. */
  page: number;
  /** 지금까지 누적된 entry 수. */
  fetched: number;
  /** 서버가 다음 커서를 돌려줬는지 여부. false 면 이 페이지가 마지막. */
  hasMore: boolean;
}

export interface AuditBatchExportOptions {
  /** 페이지당 요청 개수. 기본 100. 서버 hard limit 은 100 이므로 사실상 최대치. */
  pageSize?: number;
  /** 총 페이지 상한. 기본 100 (= 최대 10,000 entries). */
  maxPages?: number;
  onProgress?: (progress: AuditBatchExportProgress) => void;
  signal?: AbortSignal;
}

export interface AuditBatchExportResult {
  entries: AuditLogEntryRead[];
  /** 실제로 요청한 페이지 수. */
  pages: number;
  /** `maxPages` 상한에 걸려 끊긴 경우 true. */
  hitCap: boolean;
  /** `signal.aborted` 로 중도 취소된 경우 true. */
  aborted: boolean;
}

export async function fetchAllAuditLog(
  filters: AuditLogFilters,
  options: AuditBatchExportOptions = {},
): Promise<AuditBatchExportResult> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 100;

  const entries: AuditLogEntryRead[] = [];
  let cursor: number | undefined;
  let page = 0;
  let hitCap = false;
  let aborted = false;

  while (true) {
    if (options.signal?.aborted) {
      aborted = true;
      break;
    }

    const req: AuditLogListRequest = { ...filters, limit: pageSize };
    if (cursor !== undefined) req.before = cursor;

    const res = await callAuditLogList(req);
    entries.push(...res.entries);
    page += 1;

    const hasMore = res.nextCursor !== null;
    options.onProgress?.({ page, fetched: entries.length, hasMore });

    if (!hasMore) break;

    if (page >= maxPages) {
      hitCap = true;
      break;
    }
    cursor = res.nextCursor ?? undefined;
  }

  return { entries, pages: page, hitCap, aborted };
}
