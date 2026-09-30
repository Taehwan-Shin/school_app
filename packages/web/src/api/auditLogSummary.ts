import { useQuery } from '@tanstack/react-query';
import type { AuditLogEntryRead } from './auditLogList';
import { callCallable } from './callCallable';

export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  snapshotAt: number;
  generatedAt: number;
  // v0.120: 대시보드 위젯 — action 별 카운트. sampleTruncated=true 이면 최신
  // sampleSize 건만 반영 (정확 count 는 `count` 필드).
  actionCounts?: Record<string, number>;
  // v0.154: result 별 카운트 (sample 기반, action 과 동일 sample). client
  // aggregate 이 preview 5건만 반영해 왜곡되는 것을 방지.
  resultCounts?: { ok: number; denied: number; error: number };
  sampleSize?: number;
  sampleTruncated?: boolean;
  // v0.126: exact=true 요청 시 AUDIT_ACTIONS 각각을 Firestore count()
  // aggregation 으로 조회한 정확 값. 0 인 action 제외. 미요청 시 undefined —
  // 렌더는 exactActionCounts ?? actionCounts 우선순위.
  exactActionCounts?: Record<string, number>;
}

export interface UseAuditLogSummaryOptions {
  atMin?: number;
  atMax?: number;
  // v0.126: 정확 count aggregation on/off.
  exact?: boolean;
}

export async function callAuditLogSummary(
  data: UseAuditLogSummaryOptions = {}
): Promise<AuditLogSummaryResponse> {
  return callCallable<UseAuditLogSummaryOptions, AuditLogSummaryResponse>(
    'auditLogSummary',
    data,
  );
}

export function useAuditLogSummary(options?: UseAuditLogSummaryOptions, enabled = true) {
  return useQuery<AuditLogSummaryResponse, Error>({
    // v0.126: exact 도 queryKey 에 포함해서 sample-only 응답과 exact 응답이
    // 별도 cache 로 저장되게. exact=true 는 서버 부담이 커서 사용자 요청 시만.
    queryKey: ['audit', 'summary', options?.atMin, options?.atMax, options?.exact === true],
    queryFn: () => callAuditLogSummary(options ?? {}),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
