import { useAuditLogList } from '../../api/auditLogList';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export function AuditLogTable() {
  const { entries, loading, error, hasMore, loadMore, reload } = useAuditLogList(25);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-small text-fg-secondary">
          {entries.length}건 표시됨 · 최근 {entries.length > 0 ? new Date(entries[0].at).toLocaleDateString('ko-KR') : '-'} 까지
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={reload}
          data-testid="audit-log-reload"
        >
          새로 고침
        </Button>
      </div>

      {loading && entries.length === 0 && (
        <div
          className="py-8 text-center text-small text-fg-secondary"
          data-testid="audit-log-loading"
        >
          감사 로그를 불러오는 중...
        </div>
      )}

      {error && (
        <div
          className="border border-state-danger p-4 text-small text-state-danger"
          data-testid="audit-log-error"
        >
          {error.message.includes('permission-denied') ||
          error.message.includes('PERMISSION_DENIED') ||
          error.message.includes('failed-precondition') ||
          error.message.includes('http_403')
            ? '이 기능은 최고 관리자만 사용할 수 있습니다.'
            : `감사 로그를 불러오지 못했습니다: ${error.message || '알 수 없는 오류'}`}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div
          className="py-12 text-center text-small text-fg-secondary"
          data-testid="audit-log-empty"
        >
          감사 로그 항목이 없습니다.
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시간</TableHead>
                  <TableHead>행위자</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>액션</TableHead>
                  <TableHead>대상</TableHead>
                  <TableHead>결과</TableHead>
                  <TableHead>요청 ID</TableHead>
                  <TableHead>메시지</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const resultColor =
                    entry.result === 'ok'
                      ? 'text-fg-primary'
                      : entry.result === 'error'
                      ? 'text-state-danger'
                      : entry.result === 'denied'
                      ? 'text-state-warning'
                      : 'text-fg-primary';

                  const roleColor =
                    entry.role === 'unknown' ? 'text-fg-muted' : 'text-fg-primary';

                  const shortRequestId =
                    entry.request_id && entry.request_id.length > 8
                      ? entry.request_id.slice(-8)
                      : entry.request_id || '-';

                  return (
                    <TableRow key={entry.id} data-testid={`audit-log-row-${entry.id}`}>
                      <TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
                        {new Date(entry.at).toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
                        {entry.actor}
                      </TableCell>
                      <TableCell className={`text-micro whitespace-nowrap ${roleColor}`}>
                        {entry.role}
                      </TableCell>
                      <TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
                        {entry.action}
                      </TableCell>
                      <TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
                        {entry.target}
                      </TableCell>
                      <TableCell className={`text-micro font-medium whitespace-nowrap ${resultColor}`}>
                        {entry.result}
                      </TableCell>
                      <TableCell className="text-micro font-mono text-fg-muted whitespace-nowrap">
                        {shortRequestId}
                      </TableCell>
                      <TableCell
                        className="text-small text-fg-secondary max-w-xs truncate"
                        title={entry.message}
                      >
                        {entry.message || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="secondary"
                onClick={loadMore}
                disabled={loading}
                data-testid="audit-log-load-more"
              >
                {loading ? '불러오는 중...' : '더 보기 (25 건)'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
