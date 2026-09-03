import { Link } from 'react-router-dom';
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

const ALLOWED_DOMAIN_SUFFIX = '@cam.hs.kr';

function renderActor(actor: string) {
  if (typeof actor === 'string' && actor.toLowerCase().endsWith(ALLOWED_DOMAIN_SUFFIX)) {
    return (
      <Link
        to={`/admin/users/${encodeURIComponent(actor)}`}
        className="text-fg-primary hover:underline"
        data-testid={`audit-actor-link-${actor}`}
      >
        {actor}
      </Link>
    );
  }
  return <span>{actor}</span>;
}

export interface UserAuditTrailProps {
  targetEmail: string;
}

export function UserAuditTrail({ targetEmail }: UserAuditTrailProps) {
  const { entries, loading, error, hasMore, loadMore } = useAuditLogList(25, {
    filterTarget: targetEmail,
  });

  return (
    <div className="space-y-4">
      {loading && entries.length === 0 && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-audit-loading">
          이력을 불러오는 중...
        </div>
      )}
      {error && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="user-audit-error">
          이력을 불러오지 못했습니다: {error.message}
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-audit-empty">
          이 사용자에 대한 감사 이력이 없습니다.
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
                  <TableHead>액션</TableHead>
                  <TableHead>결과</TableHead>
                  <TableHead>메시지</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const resultColor =
                    e.result === 'ok'
                      ? 'text-fg-primary'
                      : e.result === 'error'
                      ? 'text-state-danger'
                      : e.result === 'denied'
                      ? 'text-state-warning'
                      : 'text-fg-primary';

                  return (
                    <TableRow key={e.id} data-testid={`user-audit-row-${e.id}`}>
                      <TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
                        {new Date(e.at).toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell className="font-mono text-small text-fg-primary">{renderActor(e.actor)}</TableCell>
                      <TableCell className="font-mono text-small text-fg-primary">{e.action}</TableCell>
                      <TableCell className={`text-micro font-medium whitespace-nowrap ${resultColor}`}>
                        {e.result}
                      </TableCell>
                      <TableCell className="text-small text-fg-secondary max-w-xs truncate" title={e.message}>
                        {e.message || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="secondary" onClick={loadMore} disabled={loading} data-testid="user-audit-load-more">
                {loading ? '불러오는 중...' : '더 보기 (25 건)'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
