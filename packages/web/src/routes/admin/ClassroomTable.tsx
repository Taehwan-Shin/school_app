import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { userHasCap } from '@school-app/shared';
import { useClassroomList } from '../../api/classroomList';
import { useAuth } from '../../lib/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  ArchiveClassroomDialog,
  type ArchiveClassroomTarget,
} from './ArchiveClassroomDialog';
import {
  DeleteClassroomDialog,
  type DeleteClassroomTarget,
} from './DeleteClassroomDialog';
import { CreateClassroomDialog } from './CreateClassroomDialog';
import { CourseBulkCreateDialog } from './CourseBulkCreateDialog';
import { ClassroomChatPairBulkCreateDialog } from './ClassroomChatPairBulkCreateDialog';
import {
  BulkArchiveClassroomDialog,
  type BulkArchiveDirection,
} from './BulkArchiveClassroomDialog';
import { BulkRenameClassroomDialog } from './BulkRenameClassroomDialog';
import {
  TransferClassroomOwnerDialog,
  type TransferClassroomOwnerTarget,
} from './TransferClassroomOwnerDialog';
import { Button } from '../../components/ui/button';

export function translateCourseState(s?: string): string {
  switch (s) {
    case 'ACTIVE': return '활성';
    case 'ARCHIVED': return '보관됨';
    case 'PROVISIONED': return '준비 중';
    case 'DECLINED': return '거절됨';
    case 'SUSPENDED': return '일시중지';
    default: return s || '-';
  }
}

type SortColumn = 'name' | 'section' | 'state' | null;
type SortDirection = 'asc' | 'desc';
type KpiFilter = 'active' | 'archived' | null;

const PAGE_SIZE = 25;

export function ClassroomTable() {
  const { role: currentRole } = useAuth();
  const canTransferOwner = userHasCap(currentRole, 'classroom.transfer_owner');
  const { data, isLoading, isError, error } = useClassroomList();
  const [archiveTarget, setArchiveTarget] = useState<ArchiveClassroomTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteClassroomTarget | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isPairOpen, setIsPairOpen] = useState(false);
  // v0.115: 다중 선택 + bulk archive/restore.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDirection, setBulkDirection] = useState<BulkArchiveDirection | null>(null);
  // v0.116: 소유자 이관.
  const [transferTarget, setTransferTarget] = useState<TransferClassroomOwnerTarget | null>(null);
  // v0.134: 일괄 이름 변경.
  const [isBulkRenameOpen, setIsBulkRenameOpen] = useState(false);

  // v0.137: URL 기반 검색·필터·정렬. AccountsTable (v0.125) · GroupsTable (v0.127) 대칭.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const kpiFilterRaw = searchParams.get('filter');
  // v0.137 F105 대칭: allowlist 밖 filter 는 fail-open (필터 미적용).
  const kpiFilter: KpiFilter =
    kpiFilterRaw === 'active' || kpiFilterRaw === 'archived' ? kpiFilterRaw : null;
  const sortColumn: SortColumn = (() => {
    const raw = searchParams.get('sort');
    return raw === 'name' || raw === 'section' || raw === 'state' ? raw : null;
  })();
  const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, kpiFilter, sortColumn, sortDirection]);

  const handleSort = (column: 'name' | 'section' | 'state') => {
    const next = new URLSearchParams(searchParams);
    if (sortColumn === column) {
      next.set('dir', sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sort', column);
      next.set('dir', 'asc');
    }
    setSearchParams(next, { replace: false });
  };

  const courses = data?.courses ?? [];

  const sortedFilteredCourses = useMemo(() => {
    let result = courses;
    if (kpiFilter === 'active') {
      result = result.filter((c) => c.courseState === 'ACTIVE');
    } else if (kpiFilter === 'archived') {
      result = result.filter((c) => c.courseState === 'ARCHIVED');
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const section = (c.section || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        return name.includes(q) || section.includes(q) || id.includes(q);
      });
    }
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'name') {
          cmp = (a.name || '').localeCompare(b.name || '');
        } else if (sortColumn === 'section') {
          cmp = (a.section || '').localeCompare(b.section || '');
        } else if (sortColumn === 'state') {
          cmp = (a.courseState || '').localeCompare(b.courseState || '');
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [courses, kpiFilter, searchQuery, sortColumn, sortDirection]);

  const total = sortedFilteredCourses.length;
  const paginatedCourses = sortedFilteredCourses.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  // v0.137: eligibleIds 는 필터 결과 기반 (「전체 선택」 = 현재 보이는 eligible 만).
  // 이미 선택된 id 는 필터 밖으로 나가도 selectedIds 에 유지 — 사용자가 필터를
  // 바꿔가며 여러 배치를 골라 담을 수 있어야 함. Bulk 액션들은 selectedIds ∩
  // 실제 courses (필터 무관) 로 계산되므로 여전히 정확.
  const eligibleIds = useMemo(
    () =>
      new Set(
        sortedFilteredCourses
          .filter((c) => c.courseState === 'ACTIVE' || c.courseState === 'ARCHIVED')
          .map((c) => c.id),
      ),
    [sortedFilteredCourses],
  );
  const visibleSelectedCount = useMemo(
    () => sortedFilteredCourses.filter((c) => selectedIds.has(c.id)).length,
    [sortedFilteredCourses, selectedIds],
  );
  const selectedActive = useMemo(
    () => courses.filter((c) => selectedIds.has(c.id) && c.courseState === 'ACTIVE'),
    [courses, selectedIds],
  );
  const selectedArchived = useMemo(
    () => courses.filter((c) => selectedIds.has(c.id) && c.courseState === 'ARCHIVED'),
    [courses, selectedIds],
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        // 현재 필터 결과 안의 eligible 만 추가 (기존 선택은 유지).
        eligibleIds.forEach((id) => next.add(id));
      } else {
        // 현재 보이는 eligible 만 해제 (필터 밖 선택은 유지).
        eligibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };
  const bulkTargetCourses =
    bulkDirection === 'archive'
      ? selectedActive.map((c) => ({ id: c.id, name: c.name }))
      : bulkDirection === 'restore'
        ? selectedArchived.map((c) => ({ id: c.id, name: c.name }))
        : [];
  // v0.134b F118: Classroom REST v1 은 ARCHIVED 코스의 courseState 외 필드
  // 변경을 거부한다 (upstream 403/failed_precondition). 이름 변경 대상은
  // ACTIVE 만 허용하여 부분 실패를 사전 차단.
  const bulkRenameCourses = useMemo(
    () =>
      courses
        .filter((c) => selectedIds.has(c.id) && c.courseState === 'ACTIVE')
        .map((c) => ({ id: c.id, name: c.name })),
    [courses, selectedIds],
  );

  // v0.137: 「필터 초기화」 활성 판정 (실 필터 규칙 정규화).
  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    kpiFilter !== null ||
    sortColumn !== null;

  const setKpiFilter = (v: KpiFilter) => {
    const next = new URLSearchParams(searchParams);
    if (v === null) next.delete('filter');
    else next.set('filter', v);
    setSearchParams(next, { replace: false });
  };

  const setSearchQuery = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('q', v);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return <span aria-hidden="true"> {sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };
  const ariaSortFor = (column: SortColumn): 'ascending' | 'descending' | 'none' => {
    if (sortColumn !== column) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <p className="text-small text-fg-secondary">
          {data?.courses ? `${data.courses.length}개 코스` : '코스 목록'}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름·섹션·ID 로 검색"
            aria-label="클래스룸 검색"
            data-testid="classroom-search-input"
            className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
          <Button
            variant="secondary"
            onClick={() => setSearchParams(new URLSearchParams(), { replace: false })}
            disabled={!hasActiveFilter}
            data-testid="classroom-clear-filters-btn"
            title="검색·필터·정렬 초기화"
          >
            필터 초기화
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsPairOpen(true)}
            data-testid="classroom-pair-create-btn"
          >
            학급 통합 생성
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsBatchOpen(true)}
            data-testid="classroom-batch-create-btn"
          >
            학년/반 일괄 생성
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            data-testid="classroom-create-btn"
          >
            + 코스 추가
          </Button>
        </div>
      </div>
      {/* v0.137: KPI 필터 chips (활성/보관됨). AccountsTable KPI 카드 대칭. */}
      {data?.courses && data.courses.length > 0 && (
        <div
          role="group"
          aria-label="상태 필터"
          className="flex items-center gap-2"
          data-testid="classroom-kpi-filters"
        >
          <button
            type="button"
            onClick={() => setKpiFilter(null)}
            aria-pressed={kpiFilter === null}
            data-testid="classroom-kpi-all"
            className={`border px-3 py-1 text-small transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong ${
              kpiFilter === null
                ? 'border-fg-primary bg-fg-primary text-canvas'
                : 'border-border-subtle bg-canvas text-fg-primary hover:bg-surface'
            }`}
          >
            전체 ({data.courses.length})
          </button>
          <button
            type="button"
            onClick={() => setKpiFilter('active')}
            aria-pressed={kpiFilter === 'active'}
            data-testid="classroom-kpi-active"
            className={`border px-3 py-1 text-small transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong ${
              kpiFilter === 'active'
                ? 'border-fg-primary bg-fg-primary text-canvas'
                : 'border-border-subtle bg-canvas text-fg-primary hover:bg-surface'
            }`}
          >
            활성 ({data.courses.filter((c) => c.courseState === 'ACTIVE').length})
          </button>
          <button
            type="button"
            onClick={() => setKpiFilter('archived')}
            aria-pressed={kpiFilter === 'archived'}
            data-testid="classroom-kpi-archived"
            className={`border px-3 py-1 text-small transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong ${
              kpiFilter === 'archived'
                ? 'border-fg-primary bg-fg-primary text-canvas'
                : 'border-border-subtle bg-canvas text-fg-primary hover:bg-surface'
            }`}
          >
            보관됨 ({data.courses.filter((c) => c.courseState === 'ARCHIVED').length})
          </button>
        </div>
      )}
      {/* v0.115: bulk actions bar — 선택된 항목이 있을 때만 노출. */}
      {selectedIds.size > 0 && (
        <div
          className="flex justify-between items-center border border-border-subtle bg-elevated px-4 py-2"
          data-testid="classroom-bulk-actions"
        >
          <p className="text-small text-fg-primary">
            {selectedIds.size}개 선택됨 (ACTIVE {selectedActive.length} · ARCHIVED{' '}
            {selectedArchived.length})
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
              data-testid="classroom-bulk-clear-btn"
            >
              선택 해제
            </button>
            <Button
              variant="secondary"
              onClick={() => setBulkDirection('archive')}
              disabled={selectedActive.length === 0}
              data-testid="classroom-bulk-archive-btn"
            >
              선택 아카이브 ({selectedActive.length})
            </Button>
            <Button
              variant="secondary"
              onClick={() => setBulkDirection('restore')}
              disabled={selectedArchived.length === 0}
              data-testid="classroom-bulk-restore-btn"
            >
              선택 복구 ({selectedArchived.length})
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkRenameOpen(true)}
              disabled={bulkRenameCourses.length === 0}
              data-testid="classroom-bulk-rename-btn"
            >
              선택 이름 변경 ({bulkRenameCourses.length})
            </Button>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="classroom-list-loading">
          클래스룸 코스 목록을 불러오는 중...
        </div>
      )}
      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="classroom-list-error">
          클래스룸 코스 목록을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}
      {!isLoading && !isError && (!data?.courses || data.courses.length === 0) && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="classroom-list-empty">
          표시할 클래스룸 코스가 없습니다.
        </div>
      )}
      {!isLoading && !isError && data?.courses && data.courses.length > 0 && sortedFilteredCourses.length === 0 && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="classroom-search-empty">
          검색 결과가 없습니다.
        </div>
      )}
      {data?.courses && data.courses.length > 0 && sortedFilteredCourses.length > 0 && (
        <>
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="전체 선택"
                    data-testid="classroom-select-all"
                    checked={
                      eligibleIds.size > 0 &&
                      Array.from(eligibleIds).every((id) => selectedIds.has(id))
                    }
                    ref={(el) => {
                      if (el) {
                        const anyVisibleSelected = visibleSelectedCount > 0;
                        const allEligibleSelected =
                          eligibleIds.size > 0 &&
                          Array.from(eligibleIds).every((id) => selectedIds.has(id));
                        el.indeterminate = anyVisibleSelected && !allEligibleSelected;
                      }
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={eligibleIds.size === 0}
                  />
                </TableHead>
                <TableHead
                  onClick={() => handleSort('name')}
                  className="cursor-pointer select-none"
                  data-testid="classroom-sort-name"
                  aria-sort={ariaSortFor('name')}
                >
                  이름{renderSortIndicator('name')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('section')}
                  className="cursor-pointer select-none"
                  data-testid="classroom-sort-section"
                  aria-sort={ariaSortFor('section')}
                >
                  섹션{renderSortIndicator('section')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('state')}
                  className="cursor-pointer select-none"
                  data-testid="classroom-sort-state"
                  aria-sort={ariaSortFor('state')}
                >
                  상태{renderSortIndicator('state')}
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">링크</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCourses.map((c) => {
                const canSelect = c.courseState === 'ACTIVE' || c.courseState === 'ARCHIVED';
                return (
                  <TableRow key={c.id} data-testid={`classroom-row-${c.id}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`${c.name || c.id} 선택`}
                        data-testid={`classroom-select-${c.id}`}
                        checked={selectedIds.has(c.id)}
                        onChange={(e) => toggleOne(c.id, e.target.checked)}
                        disabled={!canSelect}
                      />
                    </TableCell>
                    <TableCell className="text-fg-primary">
                      <Link
                        to={`/admin/classrooms/${encodeURIComponent(c.id)}`}
                        data-testid={`classroom-detail-link-${c.id}`}
                        className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                      >
                        {c.name || <span className="text-fg-muted">(무제)</span>}
                      </Link>
                    </TableCell>
                    <TableCell className="text-small text-fg-secondary">{c.section || '-'}</TableCell>
                    <TableCell className="text-small text-fg-secondary">{translateCourseState(c.courseState)}</TableCell>
                    <TableCell className="font-mono text-small text-fg-secondary">{c.id}</TableCell>
                    <TableCell className="text-right">
                      {c.alternateLink ? (
                        <a
                          href={c.alternateLink}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`classroom-link-${c.id}`}
                          className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                        >
                          열기
                        </a>
                      ) : (
                        <span className="text-small text-fg-muted">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canSelect && (
                        <button
                          type="button"
                          onClick={() => setArchiveTarget({ id: c.id, name: c.name, currentState: c.courseState || '' })}
                          data-testid={`classroom-archive-btn-${c.id}`}
                          className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong mr-3"
                        >
                          {c.courseState === 'ACTIVE' ? '아카이브' : '복구'}
                        </button>
                      )}
                      {canTransferOwner && c.courseState === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() =>
                            setTransferTarget({
                              id: c.id,
                              name: c.name,
                              currentOwnerId: c.ownerId,
                            })
                          }
                          data-testid={`classroom-transfer-owner-btn-${c.id}`}
                          title="소유자 이관 (admin/super_admin 전용)"
                          className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong mr-3"
                        >
                          소유자 이관
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                        data-testid={`classroom-delete-btn-${c.id}`}
                        className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                      >
                        삭제
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-between items-center mt-4 text-small text-fg-secondary">
          <span data-testid="classroom-pagination-info">
            {total === 0
              ? '결과 없음'
              : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} / ${total}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              data-testid="classroom-pagination-prev"
              className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              data-testid="classroom-pagination-next"
              className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
            >
              다음
            </button>
          </div>
        </div>
        </>
      )}
      <ArchiveClassroomDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        target={archiveTarget}
      />
      <DeleteClassroomDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        target={deleteTarget}
      />
      <CreateClassroomDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
      <CourseBulkCreateDialog
        open={isBatchOpen}
        onOpenChange={setIsBatchOpen}
      />
      <ClassroomChatPairBulkCreateDialog
        open={isPairOpen}
        onOpenChange={setIsPairOpen}
      />
      {bulkDirection !== null && (
        <BulkArchiveClassroomDialog
          open={true}
          onOpenChange={(o) => !o && setBulkDirection(null)}
          courses={bulkTargetCourses}
          direction={bulkDirection}
          onDone={() => setSelectedIds(new Set())}
        />
      )}
      {isBulkRenameOpen && (
        <BulkRenameClassroomDialog
          open={true}
          onOpenChange={setIsBulkRenameOpen}
          courses={bulkRenameCourses}
          onDone={() => setSelectedIds(new Set())}
        />
      )}

      {transferTarget && (
        <TransferClassroomOwnerDialog
          open={true}
          onOpenChange={(o) => !o && setTransferTarget(null)}
          target={transferTarget}
        />
      )}
    </div>
  );
}
