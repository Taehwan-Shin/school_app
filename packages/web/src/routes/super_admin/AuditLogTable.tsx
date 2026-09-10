import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuditLogList } from '../../api/auditLogList';
import { Button } from '../../components/ui/button';
import { AUDIT_ACTIONS } from '@school-app/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { cn } from '../../lib/utils';

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

export function AuditLogTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultFilter = (() => {
    const raw = searchParams.get('result');
    return raw === 'ok' || raw === 'error' || raw === 'denied' ? raw : 'all';
  })();
  const actionSearch = searchParams.get('q') ?? '';
  // v0.104: URL `action` 은 콤마 구분 다중 값 (backward-compat: 단일 값도 그대로 배열 원소로).
  const actionParam = searchParams.get('action') ?? '';
  const actionList = actionParam
    ? Array.from(new Set(actionParam.split(',').map((s) => s.trim()).filter((s) => s.length > 0)))
    : [];
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
    // v0.104: 다중이면 filterActions, 단일이면 filterAction (Firestore in vs == index 재사용).
    filterAction: actionList.length === 1 ? actionList[0] : undefined,
    filterActions: actionList.length > 1 ? actionList : undefined,
    atMin: atMinMs,
    atMax: atMaxMs,
  });

  const filteredEntries = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter((e) => {
      const inAction = e.action.toLowerCase().includes(q);
      const inMessage = (e.message ?? '').toLowerCase().includes(q);
      return inAction || inMessage;
    });
  }, [entries, actionSearch]);

  // v0.108: 현재 필터 요약을 파일명에 반영. 여러 export 를 구분할 수 있도록. filesystem-safe
  // 문자만 남기고 나머지는 _ 로 치환.
  const filterSummaryForFilename = (): string => {
    const parts: string[] = [];
    if (actionParam) parts.push(`action-${actionParam.replace(/,/g, '_')}`);
    if (resultFilter !== 'all') parts.push(`result-${resultFilter}`);
    if (actorFilter) parts.push(`actor-${actorFilter.replace(/@.*/, '')}`);
    if (actionSearch) parts.push(`q-${actionSearch.slice(0, 20)}`);
    return parts.length > 0 ? '-' + parts.join('-').replace(/[^a-zA-Z0-9._-]/g, '_') : '';
  };

  // v0.108: filteredEntries 를 Blob 다운로드로 밀어내는 공통 helper. CSV/JSON 진입점이 공유.
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    const dateStr = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `audit-log-${dateStr}${filterSummaryForFilename()}.csv`);
  };

  // v0.108: JSON export. CSV 가 개행 제거하고 flat table 로 변환하는 반면 JSON 은 원본 그대로
  // 기계 처리에 적합. before/after 필드도 (존재 시) 함께 담음. NDJSON 아닌 array 로.
  // v0.108b F53/F54/F55: hasMore + before/after 포함 · metadata 는 URL 원문이 아니라 실제
  // 서버로 넘긴 정규화된 hook 인자 사용.
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      // F55: 정규화된 실제 hook 인자를 그대로 반영 (actionList 는 dedup 완료 · atMin/Max
      // 는 유효 검증 통과한 ms). URL 원문과 다를 수 있는 사례: 중복 action 제거, 잘못된
      // 날짜 무시. 사용자가 export 파일만 봐도 실제 어떤 조건으로 조회됐는지 정확히 알 수
      // 있게.
      filter: {
        actions: actionList.length > 0 ? actionList : null,
        result: resultFilter !== 'all' ? resultFilter : null,
        actor: actorFilter || null,
        q: actionSearch || null,
        atMinMs: atMinMs ?? null,
        atMinIso: atMinMs !== undefined ? new Date(atMinMs).toISOString() : null,
        atMaxMs: atMaxMs ?? null,
        atMaxIso: atMaxMs !== undefined ? new Date(atMaxMs).toISOString() : null,
        pageSize: 25,
      },
      // F53: hasMore=true 이면 partial 결과. count/entries 를 완전한 필터 결과처럼 해석
      // 하지 않도록 명시.
      partial: hasMore,
      hasMore,
      count: filteredEntries.length,
      entries: filteredEntries.map((e) => ({
        id: e.id,
        at: e.at,
        atIso: new Date(e.at).toISOString(),
        actor: e.actor,
        role: e.role,
        action: e.action,
        target: e.target,
        result: e.result,
        requestId: e.request_id,
        message: e.message ?? null,
        // F54: AuditLogEntryRead 타입이 약속한 before/after 보존 (존재 시).
        before: e.before ?? null,
        after: e.after ?? null,
      })),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const dateStr = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `audit-log-${dateStr}${filterSummaryForFilename()}.json`);
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
    if (check(0)) return 0;
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
          <details className="relative" data-testid="audit-log-filter-action-multi">
            <summary
              className="cursor-pointer list-none border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary hover:bg-elevated focus:outline-none focus:border-border-strong"
              title="서버측 액션 정확 매치 필터 (다중 선택)"
            >
              {actionList.length === 0
                ? '전체 액션'
                : actionList.length === 1
                  ? actionList[0]
                  : `${actionList.length}개 액션 선택됨`}
            </summary>
            {/* F40: WAI-ARIA listbox 는 role=option 자식을 요구. 여기 자식은 native checkbox
                이므로 checkbox pattern 에 맞춰 role=group 컨테이너로 변경. */}
            <div
              className="absolute z-20 mt-1 right-0 md:right-auto md:left-0 w-64 max-h-72 overflow-y-auto border border-border-subtle bg-canvas shadow-md p-2 space-y-1"
              role="group"
              aria-label="액션 다중 선택"
            >
              <div className="flex justify-between items-center pb-1 mb-1 border-b border-border-subtle">
                <span className="text-micro text-fg-muted uppercase tracking-wide">
                  선택된 {actionList.length}개
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete('action');
                    setSearchParams(next, { replace: true });
                  }}
                  disabled={actionList.length === 0}
                  data-testid="audit-log-filter-action-clear"
                  className="text-small text-fg-secondary underline decoration-transparent hover:decoration-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  전체 해제
                </button>
              </div>
              {AUDIT_ACTIONS.map((action) => {
                const checked = actionList.includes(action);
                return (
                  <label
                    key={action}
                    className="flex items-center gap-2 text-small text-fg-primary cursor-pointer px-2 py-1 hover:bg-elevated"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = new URLSearchParams(searchParams);
                        const nextSet = new Set(actionList);
                        if (checked) nextSet.delete(action);
                        else nextSet.add(action);
                        if (nextSet.size === 0) next.delete('action');
                        else next.set('action', Array.from(nextSet).join(','));
                        setSearchParams(next, { replace: true });
                      }}
                      data-testid={`audit-log-filter-action-cb-${action}`}
                      className="accent-fg-primary cursor-pointer"
                    />
                    <span className="font-mono">{action}</span>
                  </label>
                );
              })}
            </div>
          </details>
          <input
            type="text"
            value={actionSearch}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v) next.set('q', v); else next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            placeholder="메시지·액션 부분 검색"
            data-testid="audit-log-filter-action"
            title="현재 페이지 내 메시지·액션 부분 문자열 검색 (클라이언트)"
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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            disabled={filteredEntries.length === 0}
            data-testid="audit-log-export-json"
            title="현재 필터 조건과 함께 감사 이벤트를 JSON 파일로 저장"
          >
            JSON 내보내기
          </Button>
        </div>
      </div>

      <div className="flex justify-end flex-wrap gap-4">
        <div className="flex items-center gap-2" role="group" aria-label="날짜 프리셋">
          <span className="text-small text-fg-secondary mr-1">프리셋:</span>
          {[
            { key: 0 as const, label: '오늘' },
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
        {/* v0.111: role_split 감지 + 해결 이벤트를 한 번에 보는 action preset. detected 와
            resolved 를 multi-action 으로 필터. 이미 두 액션이 URL 에 있으면 「활성」 상태. */}
        <div className="flex items-center gap-2" role="group" aria-label="액션 프리셋">
          <span className="text-small text-fg-secondary mr-1">액션:</span>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              const target = ['system.role_split_detected', 'system.role_split_resolved'];
              const current = actionList;
              // 이미 정확히 두 액션이면 clear, 아니면 설정.
              const isActive =
                current.length === 2 &&
                target.every((a) => current.includes(a));
              if (isActive) {
                next.delete('action');
              } else {
                next.set('action', target.join(','));
              }
              setSearchParams(next, { replace: false });
            }}
            data-testid="audit-log-preset-role-split"
            className={cn(
              'px-3 py-1 text-small border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
              actionList.length === 2 &&
                ['system.role_split_detected', 'system.role_split_resolved'].every((a) =>
                  actionList.includes(a),
                )
                ? 'bg-fg-primary text-canvas border-fg-primary'
                : 'bg-canvas text-fg-primary border-border-subtle hover:border-border-strong',
            )}
            title="role_split 감지 + 해결 이벤트만 필터"
          >
            role_split
          </button>
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
                          {renderActor(entry.actor)}
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
