import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { cn } from '../../lib/utils';

export function AuditLogTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultFilter = (() => {
    const raw = searchParams.get('result');
    return raw === 'ok' || raw === 'error' || raw === 'denied' ? raw : 'all';
  })();
  const actionSearch = searchParams.get('q') ?? '';
  const actorFilter = searchParams.get('actor') ?? '';
  const atMinMs = (() => {
    const raw = searchParams.get('atMin');
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
    const d = new Date(`${raw}T00:00:00`);
    return isNaN(d.getTime()) ? undefined : d.getTime();
  })();
  const atMaxMs = (() => {
    const raw = searchParams.get('atMax');
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
    const d = new Date(`${raw}T23:59:59.999`);
    return isNaN(d.getTime()) ? undefined : d.getTime();
  })();

  const { entries, loading, error, hasMore, loadMore, reload } = useAuditLogList(25, {
    filterActor: actorFilter || undefined,
    filterResult: resultFilter !== 'all' ? resultFilter : undefined,
    atMin: atMinMs,
    atMax: atMaxMs,
  });

  const filteredEntries = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter((e) => e.action.toLowerCase().includes(q));
  }, [entries, actionSearch]);

  const handleExportCsv = () => {
    const header = ['시간', '행위자', '역할', '액션', '대상', '결과', '요청 ID', '메시지'];
    const rows = filteredEntries.map((e) => [
      new Date(e.at).toISOString(),
      e.actor,
      e.role,
      e.action,
      e.target,
      e.result,
      e.request_id,
      (e.message ?? '').replace(/\n/g, ' '), // 개행 제거
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM 으로 Excel 한글 지원
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreset = (days: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (days === null) {
      next.delete('atMin');
      next.delete('atMax');
    } else {
      const atMinDate = new Date();
      atMinDate.setDate(atMinDate.getDate() - days);
      const yyyy = atMinDate.getFullYear();
      const mm = String(atMinDate.getMonth() + 1).padStart(2, '0');
      const dd = String(atMinDate.getDate()).padStart(2, '0');
      next.set('atMin', `${yyyy}-${mm}-${dd}`);
      next.delete('atMax');
    }
    setSearchParams(next, { replace: false });
  };

  const activePreset: number | 'all' | null = (() => {
    if (!searchParams.get('atMin') && !searchParams.get('atMax')) return 'all';
    if (searchParams.get('atMax')) return null;
    const raw = searchParams.get('atMin');
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const now = new Date();
    const check = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}` === raw;
    };
    if (check(1)) return 1;
    if (check(7)) return 7;
    if (check(30)) return 30;
    return null;
  })();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <p className="text-small text-fg-secondary">
          {filteredEntries.length}건 표시됨 / 전체 {entries.length}건 · 최근 {entries.length > 0 ? new Date(entries[0].at).toLocaleDateString('ko-KR') : '-'} 까지
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v) next.set('actor', v); else next.delete('actor');
              setSearchParams(next, { replace: false });
            }}
            placeholder="행위자 이메일"
            aria-label="행위자 필터"
            data-testid="audit-log-filter-actor"
            className="w-56 border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
          />
          <select
            value={resultFilter}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v && v !== 'all') next.set('result', v); else next.delete('result');
              setSearchParams(next, { replace: false });
            }}
            data-testid="audit-log-filter-result"
            className="border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary focus:outline-none focus:border-border-strong"
          >
            <option value="all">모든 결과</option>
            <option value="ok">성공</option>
            <option value="error">오류</option>
            <option value="denied">거부</option>
          </select>
          <input
            type="date"
            value={searchParams.get('atMin') ?? ''}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v) next.set('atMin', v); else next.delete('atMin');
              setSearchParams(next, { replace: false });
            }}
            aria-label="시작 날짜"
            data-testid="audit-log-filter-atmin"
            className="border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
          <span className="text-fg-muted text-small" aria-hidden="true">~</span>
          <input
            type="date"
            value={searchParams.get('atMax') ?? ''}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v) next.set('atMax', v); else next.delete('atMax');
              setSearchParams(next, { replace: false });
            }}
            aria-label="끝 날짜"
            data-testid="audit-log-filter-atmax"
            className="border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
          <input
            type="text"
            value={actionSearch}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v) next.set('q', v); else next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            placeholder="액션 검색"
            data-testid="audit-log-filter-action"
            className="w-56 border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={reload}
            data-testid="audit-log-reload"
          >
            새로 고침
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredEntries.length === 0}
            data-testid="audit-log-export-csv"
          >
            CSV 내보내기
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-2" role="group" aria-label="날짜 프리셋">
          <span className="text-small text-fg-secondary mr-1">프리셋:</span>
          {[
            { key: 1 as const, label: '지난 24시간' },
            { key: 7 as const, label: '지난 7일' },
            { key: 30 as const, label: '지난 30일' },
            { key: 'all' as const, label: '전체' },
          ].map(({ key, label }) => (
            <button
              key={String(key)}
              type="button"
              onClick={() => handlePreset(key === 'all' ? null : key)}
              data-testid={`audit-log-preset-${key}`}
              className={cn(
                'px-3 py-1 text-small border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
                activePreset === key
                  ? 'bg-fg-primary text-canvas border-fg-primary'
                  : 'bg-canvas text-fg-primary border-border-subtle hover:border-border-strong',
              )}
            >
              {label}
            </button>
          ))}
        </div>
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
          {actorFilter || resultFilter !== 'all' || searchParams.get('atMin') || searchParams.get('atMax')
            ? '해당 필터에 매칭되는 로그가 없습니다.'
            : '감사 로그 항목이 없습니다.'}
        </div>
      )}

      {entries.length > 0 && (
        <>
          {filteredEntries.length === 0 ? (
            <div
              className="py-12 text-center text-small text-fg-secondary"
              data-testid="audit-log-filter-empty"
            >
              필터에 매칭되는 로그가 없습니다.
            </div>
          ) : (
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
                  {filteredEntries.map((entry) => {
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
          )}

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
