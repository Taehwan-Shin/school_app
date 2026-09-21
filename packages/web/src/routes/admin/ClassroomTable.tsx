import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { userHasCap } from '@school-app/shared';
import { useClassroomList } from '../../api/classroomList';
import { useAuth } from '../../lib/auth';
import { useClickOutside } from '../../lib/useClickOutside';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
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
import { NeisCsvImportDialog } from './NeisCsvImportDialog';
import {
  BulkArchiveClassroomDialog,
  type BulkArchiveDirection,
} from './BulkArchiveClassroomDialog';
import { BulkRenameClassroomDialog } from './BulkRenameClassroomDialog';
import { BulkTransferClassroomOwnerDialog } from './BulkTransferClassroomOwnerDialog';
import {
  TransferClassroomOwnerDialog,
  type TransferClassroomOwnerTarget,
} from './TransferClassroomOwnerDialog';
import { Button } from '../../components/ui/button';
import { sortHeaderKbdProps } from './sortHeader';
import { translateCourseState } from '../../lib/courseState';

// v0.170: v0.137 에서 이 모듈에 정의됐던 `translateCourseState` 는 `lib/courseState`
// 로 승격. 기존 소비자 (classroomDetail.tsx) 는 아래 re-export 로 뒤호환.
export { translateCourseState };

type SortColumn = 'name' | 'section' | 'state' | null;
type SortDirection = 'asc' | 'desc';

// v0.162: 정렬 선호 localStorage 키 (v0.160/v0.161 대칭).
const SORT_STORAGE_KEY = 'classroomTable.sort.v1';

interface StoredSortPref {
  sort?: string;
  dir?: string;
}

function readStoredSortPref(): StoredSortPref | null {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    return {
      sort: typeof rec.sort === 'string' ? rec.sort : undefined,
      dir: typeof rec.dir === 'string' ? rec.dir : undefined,
    };
  } catch {
    return null;
  }
}
type KpiFilter = 'active' | 'archived' | null;

// v0.195: 페이지 크기 셀렉터 (v0.193/v0.194 대칭).
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 25;
const PAGE_SIZE_STORAGE_KEY = 'classroomTable.pageSize.v1';

function readStoredPageSize(): PageSize {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (!raw) return DEFAULT_PAGE_SIZE;
    const parsed = Number.parseInt(raw, 10);
    if (PAGE_SIZE_OPTIONS.includes(parsed as PageSize)) return parsed as PageSize;
    return DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

// v0.201: 컬럼 표시 여부 (v0.199/v0.200 대칭). 선택/관리 2 개는 필수. 5 필드 토글.
type ToggleColumnKey = 'name' | 'section' | 'state' | 'id' | 'link';
const TOGGLEABLE_COLUMNS: readonly { key: ToggleColumnKey; label: string }[] = [
  { key: 'name', label: '이름' },
  { key: 'section', label: '섹션' },
  { key: 'state', label: '상태' },
  { key: 'id', label: 'ID' },
  { key: 'link', label: '링크' },
];
const DEFAULT_VISIBLE_COLUMNS: ToggleColumnKey[] = ['name', 'section', 'state', 'id', 'link'];
const VISIBLE_COLUMNS_STORAGE_KEY = 'classroomTable.visibleColumns.v1';

function readStoredVisibleColumns(): Set<ToggleColumnKey> {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE_COLUMNS);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE_COLUMNS);
    const validKeys = TOGGLEABLE_COLUMNS.map((c) => c.key) as string[];
    const filtered = parsed.filter((k): k is ToggleColumnKey =>
      typeof k === 'string' && validKeys.includes(k),
    );
    return new Set(filtered);
  } catch {
    return new Set(DEFAULT_VISIBLE_COLUMNS);
  }
}

export function ClassroomTable() {
  const { role: currentRole } = useAuth();
  const canTransferOwner = userHasCap(currentRole, 'classroom.transfer_owner');
  const { data, isLoading, isError, error } = useClassroomList();
  const [archiveTarget, setArchiveTarget] = useState<ArchiveClassroomTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteClassroomTarget | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isPairOpen, setIsPairOpen] = useState(false);
  const [isNeisOpen, setIsNeisOpen] = useState(false);
  // v0.115: 다중 선택 + bulk archive/restore.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDirection, setBulkDirection] = useState<BulkArchiveDirection | null>(null);
  // v0.116: 소유자 이관.
  const [transferTarget, setTransferTarget] = useState<TransferClassroomOwnerTarget | null>(null);
  // v0.134: 일괄 이름 변경.
  const [isBulkRenameOpen, setIsBulkRenameOpen] = useState(false);
  const [isBulkTransferOwnerOpen, setIsBulkTransferOwnerOpen] = useState(false);

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
  // v0.195: 페이지 크기 선택 (v0.193/v0.194 대칭).
  const [pageSize, setPageSize] = useState<PageSize>(() => readStoredPageSize());

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(0);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      // localStorage disabled → no-op.
    }
  };

  // v0.201: 컬럼 표시 여부 (v0.199/v0.200 대칭).
  const [visibleColumns, setVisibleColumns] = useState<Set<ToggleColumnKey>>(
    () => readStoredVisibleColumns(),
  );
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  // v0.202: outside-click auto-close.
  const columnMenuBtnRef = useRef<HTMLButtonElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const closeColumnMenu = useCallback(() => setIsColumnMenuOpen(false), []);
  useClickOutside([columnMenuBtnRef, columnMenuRef], closeColumnMenu, isColumnMenuOpen);
  useEscapeKey(closeColumnMenu, isColumnMenuOpen);
  useFocusTrap(columnMenuRef, isColumnMenuOpen);

  const toggleColumn = (key: ToggleColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(
          VISIBLE_COLUMNS_STORAGE_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // localStorage disabled → no-op.
      }
      return next;
    });
  };

  // v0.204: 전체 표시 / 전체 숨김 quick actions.
  const setAllVisible = (visible: boolean) => {
    const next: Set<ToggleColumnKey> = visible
      ? new Set(TOGGLEABLE_COLUMNS.map((c) => c.key))
      : new Set();
    setVisibleColumns(next);
    try {
      localStorage.setItem(
        VISIBLE_COLUMNS_STORAGE_KEY,
        JSON.stringify(Array.from(next)),
      );
    } catch {
      // localStorage disabled → no-op.
    }
  };

  // v0.205: 「간결」 preset — 이름 컬럼만 표시.
  const applyMinimalPreset = () => {
    const next: Set<ToggleColumnKey> = new Set(['name']);
    setVisibleColumns(next);
    try {
      localStorage.setItem(
        VISIBLE_COLUMNS_STORAGE_KEY,
        JSON.stringify(Array.from(next)),
      );
    } catch {
      // localStorage disabled → no-op.
    }
  };
  const isMinimalActive =
    visibleColumns.size === 1 && visibleColumns.has('name');

  // v0.207: 「선호 초기화」 — sort · pageSize · visibleColumns 모두 default 로.
  // v0.209: 실수 방지 confirm.
  const resetUserPreferences = () => {
    const ok = window.confirm(
      '저장된 선호 (정렬 · 페이지 크기 · 컬럼 표시) 를 모두 기본값으로 초기화하시겠습니까?',
    );
    if (!ok) return;
    try {
      localStorage.removeItem(SORT_STORAGE_KEY);
      localStorage.removeItem(PAGE_SIZE_STORAGE_KEY);
      localStorage.removeItem(VISIBLE_COLUMNS_STORAGE_KEY);
    } catch {
      // localStorage disabled → no-op.
    }
    setPageSize(DEFAULT_PAGE_SIZE);
    setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS));
    const next = new URLSearchParams(searchParams);
    next.delete('sort');
    next.delete('dir');
    setSearchParams(next, { replace: false });
    setPage(0);
    setIsColumnMenuOpen(false);
  };

  useEffect(() => {
    setPage(0);
  }, [searchQuery, kpiFilter, sortColumn, sortDirection]);

  // v0.162: 첫 mount 에서 URL 이 sort 없으면 localStorage 저장값을 URL 로 hydrate.
  // URL 이 authoritative → 이미 URL 에 sort 있으면 (deep link) 저장값 무시.
  useEffect(() => {
    if (searchParams.has('sort')) return;
    const stored = readStoredSortPref();
    if (!stored) return;
    const next = new URLSearchParams(searchParams);
    if (stored.sort === 'name' || stored.sort === 'section' || stored.sort === 'state') {
      next.set('sort', stored.sort);
    }
    if (stored.dir === 'asc' || stored.dir === 'desc') {
      next.set('dir', stored.dir);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // Mount-only hydrate: intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v0.162: sortColumn/sortDirection 변경 시 localStorage 저장. null 이면 삭제.
  useEffect(() => {
    try {
      if (sortColumn) {
        localStorage.setItem(
          SORT_STORAGE_KEY,
          JSON.stringify({ sort: sortColumn, dir: sortDirection }),
        );
      } else {
        localStorage.removeItem(SORT_STORAGE_KEY);
      }
    } catch {
      // localStorage disabled or quota exceeded → no-op.
    }
  }, [sortColumn, sortDirection]);

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

  // v0.141: `data?.courses ?? []` 는 매 렌더 새 참조 (falsy path) 라 하위
  // useMemo 의 dep array 가 안정되지 않는다. useMemo 로 감싸 data.courses 가
  // 실제로 바뀔 때만 새 배열 생성 (v0.140 lint 도입으로 표면화된 warning fix).
  // 남은 v0.142+ 스코프: missing dep 5 (addMutation · deleteMutation ·
  // resetForm · auditLogList filters ×2) + complex expression 2 (auditLogList).
  const courses = useMemo(() => data?.courses ?? [], [data?.courses]);

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
    page * pageSize,
    (page + 1) * pageSize,
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
  // v0.164: 소유자 이관도 ACTIVE 만 (Classroom API 는 ARCHIVED 코스의 patch 를 거부).
  const bulkTransferOwnerCourses = useMemo(
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

  // v0.177: CSV/JSON export (AccountsTable v0.152/v0.155 · GroupsTable v0.157 대칭).
  // 선택 있으면 그것만 export · 없으면 sortedFilteredCourses. selectedIds 는 필터
  // 밖 선택도 유지하므로 export 는 필터 결과 안의 선택 교집합만 반영 (bulk 작업과
  // 동일한 규칙 — 필터 밖 선택으로 실행되지 않도록).
  const exportCourses = useMemo(() => {
    if (selectedIds.size === 0) return sortedFilteredCourses;
    return sortedFilteredCourses.filter((c) => selectedIds.has(c.id));
  }, [sortedFilteredCourses, selectedIds]);
  const exportScope: 'selected' | 'filtered' =
    selectedIds.size > 0 ? 'selected' : 'filtered';

  const handleExportCsv = () => {
    const header = [
      'id',
      '이름',
      '섹션',
      '상태',
      '설명',
      '링크',
      '소유자 id',
      '생성 시각',
      '수정 시각',
    ];
    const rows = exportCourses.map((c) => [
      c.id,
      c.name || '-',
      c.section || '-',
      translateCourseState(c.courseState),
      c.description || '-',
      c.alternateLink || '-',
      c.ownerId || '-',
      c.creationTime || '-',
      c.updateTime || '-',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const scopeSuffix = exportScope === 'selected' ? '-selected' : '';
    a.href = url;
    a.download = `classrooms${scopeSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scope: exportScope,
      filters: {
        q: searchQuery.trim(),
        filter: kpiFilter,
        sort: sortColumn,
        dir: sortDirection,
      },
      totalCount: exportCourses.length,
      courses: exportCourses.map((c) => ({
        id: c.id,
        name: c.name ?? '',
        section: c.section ?? '',
        courseState: c.courseState ?? '',
        description: c.description ?? '',
        alternateLink: c.alternateLink ?? '',
        ownerId: c.ownerId ?? '',
        creationTime: c.creationTime ?? '',
        updateTime: c.updateTime ?? '',
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const scopeSuffix = exportScope === 'selected' ? '-selected' : '';
    a.href = url;
    a.download = `classrooms${scopeSuffix}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
            onClick={handleExportCsv}
            data-testid="classroom-export-csv-btn"
            disabled={exportCourses.length === 0}
            title={
              exportCourses.length === 0
                ? '내보낼 코스가 없습니다.'
                : exportScope === 'selected'
                  ? `선택 ${exportCourses.length}개 코스 CSV 다운로드`
                  : `필터 결과 ${exportCourses.length}개 코스 CSV 다운로드`
            }
          >
            CSV 내보내기{exportScope === 'selected' ? ` (선택 ${exportCourses.length})` : ''}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportJson}
            data-testid="classroom-export-json-btn"
            disabled={exportCourses.length === 0}
            title={
              exportCourses.length === 0
                ? '내보낼 코스가 없습니다.'
                : exportScope === 'selected'
                  ? `선택 ${exportCourses.length}개 코스 JSON 다운로드 (scope=selected)`
                  : '현재 필터 반영 JSON 다운로드 (exportedAt · filters 메타 포함)'
            }
          >
            JSON 내보내기{exportScope === 'selected' ? ` (선택 ${exportCourses.length})` : ''}
          </Button>
          {/* v0.201: 컬럼 표시 토글 (v0.199/v0.200 대칭). */}
          <div className="relative">
            <Button
              ref={columnMenuBtnRef}
              variant="secondary"
              onClick={() => setIsColumnMenuOpen((prev) => !prev)}
              data-testid="classroom-column-menu-btn"
              aria-expanded={isColumnMenuOpen}
              aria-haspopup="menu"
              title="컬럼 표시 여부 선택"
            >
              컬럼 표시 ({visibleColumns.size} / {TOGGLEABLE_COLUMNS.length})
            </Button>
            {isColumnMenuOpen && (
              <div
                ref={columnMenuRef}
                role="menu"
                aria-label="컬럼 표시"
                data-testid="classroom-column-menu"
                className="absolute right-0 mt-1 z-10 border border-border-subtle bg-canvas shadow-lg py-2 min-w-40"
              >
                {/* v0.204/v0.205: 전체 표시 · 간결 · 전체 숨김 quick actions. */}
                <div className="flex flex-wrap gap-1 px-3 pb-2 border-b border-border-subtle mb-1">
                  <button
                    type="button"
                    onClick={() => setAllVisible(true)}
                    disabled={visibleColumns.size === TOGGLEABLE_COLUMNS.length}
                    data-testid="classroom-column-show-all"
                    className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    전체 표시
                  </button>
                  <span className="text-micro text-fg-muted" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={applyMinimalPreset}
                    disabled={isMinimalActive}
                    data-testid="classroom-column-preset-minimal"
                    className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                    title="이름 컬럼만 표시 (다른 선택 컬럼 숨김)"
                  >
                    간결
                  </button>
                  <span className="text-micro text-fg-muted" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setAllVisible(false)}
                    disabled={visibleColumns.size === 0}
                    data-testid="classroom-column-hide-all"
                    className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    전체 숨김
                  </button>
                </div>
                {TOGGLEABLE_COLUMNS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-1 text-small text-fg-primary cursor-pointer hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(key)}
                      onChange={() => toggleColumn(key)}
                      data-testid={`classroom-column-toggle-${key}`}
                      className="cursor-pointer"
                    />
                    {label}
                  </label>
                ))}
                {/* v0.207: 선호 초기화. */}
                <div className="border-t border-border-subtle mt-1 pt-2 px-3">
                  <button
                    type="button"
                    onClick={resetUserPreferences}
                    data-testid="classroom-reset-user-prefs"
                    className="text-micro text-fg-primary underline hover:text-fg-secondary"
                    title="이 테이블의 정렬 · 페이지 크기 · 컬럼 표시 선호를 모두 기본값으로"
                  >
                    선호 초기화
                  </button>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsPairOpen(true)}
            data-testid="classroom-pair-create-btn"
          >
            학급 통합 생성
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsNeisOpen(true)}
            data-testid="classroom-neis-import-btn"
          >
            나이스 CSV 일괄 생성
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
            <Button
              variant="secondary"
              onClick={() => setIsBulkTransferOwnerOpen(true)}
              disabled={bulkTransferOwnerCourses.length === 0}
              data-testid="classroom-bulk-transfer-owner-btn"
            >
              선택 소유자 이관 ({bulkTransferOwnerCourses.length})
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
      {/* v0.137b F122: pagination 은 원본 courses 가 존재하는 한 항상 렌더 —
          필터 결과 0 이어도 「이전/다음」 disabled 상태로 노출해 사용자가 필터를
          되돌리지 않고도 컨트롤을 인지할 수 있게. AccountsTable/GroupsTable 대칭. */}
      {data?.courses && data.courses.length > 0 && sortedFilteredCourses.length === 0 && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="classroom-search-empty">
          검색 결과가 없습니다.
        </div>
      )}
      {data?.courses && data.courses.length > 0 && sortedFilteredCourses.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas" data-testid="classroom-table-wrap">
          <Table aria-label="클래스룸 목록">
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
                        // v0.137b F121: 필터 밖 선택만 남은 경우도 「일부 선택」
                        // 상태로 표시해야 사용자가 checkbox 만 보고 「선택 없음」
                        // 으로 오해하지 않는다. selectedIds 전체를 참고.
                        const hasAnySelection = selectedIds.size > 0;
                        const allEligibleSelected =
                          eligibleIds.size > 0 &&
                          Array.from(eligibleIds).every((id) => selectedIds.has(id));
                        el.indeterminate = hasAnySelection && !allEligibleSelected;
                      }
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={eligibleIds.size === 0}
                  />
                </TableHead>
                {visibleColumns.has('name') && (
                  <TableHead
                    onClick={() => handleSort('name')}
                    {...sortHeaderKbdProps(() => handleSort('name'))}
                    data-testid="classroom-sort-name"
                    aria-sort={ariaSortFor('name')}
                  >
                    이름{renderSortIndicator('name')}
                  </TableHead>
                )}
                {visibleColumns.has('section') && (
                  <TableHead
                    onClick={() => handleSort('section')}
                    {...sortHeaderKbdProps(() => handleSort('section'))}
                    data-testid="classroom-sort-section"
                    aria-sort={ariaSortFor('section')}
                  >
                    섹션{renderSortIndicator('section')}
                  </TableHead>
                )}
                {visibleColumns.has('state') && (
                  <TableHead
                    onClick={() => handleSort('state')}
                    {...sortHeaderKbdProps(() => handleSort('state'))}
                    data-testid="classroom-sort-state"
                    aria-sort={ariaSortFor('state')}
                  >
                    상태{renderSortIndicator('state')}
                  </TableHead>
                )}
                {visibleColumns.has('id') && <TableHead>ID</TableHead>}
                {visibleColumns.has('link') && <TableHead className="text-right">링크</TableHead>}
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody striped>
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
                    {visibleColumns.has('name') && (
                      <TableCell className="text-fg-primary">
                        <Link
                          to={`/admin/classrooms/${encodeURIComponent(c.id)}`}
                          data-testid={`classroom-detail-link-${c.id}`}
                          className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                        >
                          {c.name || <span className="text-fg-muted">(무제)</span>}
                        </Link>
                      </TableCell>
                    )}
                    {visibleColumns.has('section') && (
                      <TableCell className="text-small text-fg-secondary">{c.section || '-'}</TableCell>
                    )}
                    {visibleColumns.has('state') && (
                      <TableCell className="text-small text-fg-secondary">{translateCourseState(c.courseState)}</TableCell>
                    )}
                    {visibleColumns.has('id') && (
                      <TableCell className="font-mono text-small text-fg-secondary">{c.id}</TableCell>
                    )}
                    {visibleColumns.has('link') && (
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
                    )}
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
      )}
      {data?.courses && data.courses.length > 0 && (
        <div className="flex justify-between items-center mt-4 text-small text-fg-secondary">
          <span data-testid="classroom-pagination-info">
            {total === 0
              ? '결과 없음'
              : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} / ${total} (${page + 1} / ${Math.max(1, Math.ceil(total / pageSize))} 페이지)`}
          </span>
          <div className="flex items-center gap-2">
            {/* v0.195: 페이지 크기 선택 (v0.193/v0.194 대칭). */}
            <label htmlFor="classroom-page-size" className="text-small text-fg-secondary">
              페이지 크기:
            </label>
            <select
              id="classroom-page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
              data-testid="classroom-page-size-select"
              className="border border-border-subtle bg-canvas text-fg-primary px-2 py-1 text-small focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
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
              disabled={(page + 1) * pageSize >= total}
              data-testid="classroom-pagination-next"
              className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
            >
              다음
            </button>
          </div>
        </div>
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
      {isNeisOpen && (
        <NeisCsvImportDialog open={true} onOpenChange={setIsNeisOpen} />
      )}
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

      {isBulkTransferOwnerOpen && (
        <BulkTransferClassroomOwnerDialog
          open={true}
          onOpenChange={setIsBulkTransferOwnerOpen}
          courses={bulkTransferOwnerCourses}
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
