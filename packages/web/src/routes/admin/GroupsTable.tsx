import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useColumnMenu } from '../../lib/useColumnMenu';
import { useLocalStorageState } from '../../lib/useLocalStorageState';
import { useAutoDismissBanner } from '../../lib/useAutoDismissBanner';
import { Banner } from '../../components/Banner';
import { ColumnMenu } from '../../components/ColumnMenu';
import {
  serializePageSize,
  makePageSizeDeserializer,
} from '../../lib/pageSizeStorage';
import {
  serializeVisibleColumns,
  makeVisibleColumnsDeserializer,
} from '../../lib/visibleColumnsStorage';
import { deserializeSort, type StoredSortPref } from '../../lib/sortStorage';
import { StorageKeys } from '../../lib/storageKeys';
import { useGroupsList, type GroupItem } from '../../api/groupsList';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EditGroupDialog, type EditGroupTarget } from './EditGroupDialog';
import { DeleteGroupDialog, type DeleteGroupTarget } from './DeleteGroupDialog';
import { BulkDeleteGroupDialog } from './BulkDeleteGroupDialog';
import { BulkUpdateGroupDescriptionDialog } from './BulkUpdateGroupDescriptionDialog';
import { sortHeaderKbdProps } from './sortHeader';

type SortColumn = 'email' | 'name' | 'directMembersCount' | null;
type SortDirection = 'asc' | 'desc';

// v0.194: 페이지 크기 셀렉터 (v0.193 AccountsTable 대칭).
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 25;
const PAGE_SIZE_STORAGE_KEY = StorageKeys.groups.pageSize;

// v0.220: useLocalStorageState 이식 · 커스텀 serialize (raw number string).
// v0.220 R1: shared `pageSizeStorage` 로 4 테이블 공통 (F-A: Number.isInteger 엄격 검증).
const deserializePageSize = makePageSizeDeserializer(PAGE_SIZE_OPTIONS);

// v0.161: 정렬 선호 localStorage 키 (v0.160 AccountsTable 대칭).
const SORT_STORAGE_KEY = StorageKeys.groups.sort;

// v0.200: 컬럼 표시 여부 (v0.199 AccountsTable 대칭). 선택/이메일/관리 3 개는 필수.
// name · description · aliases · directMembersCount 4 개는 사용자 토글.
type ToggleColumnKey = 'name' | 'description' | 'aliases' | 'directMembersCount';
const TOGGLEABLE_COLUMNS: readonly { key: ToggleColumnKey; label: string }[] = [
  { key: 'name', label: '이름' },
  { key: 'description', label: '설명' },
  { key: 'aliases', label: '별칭' },
  { key: 'directMembersCount', label: '멤버 수' },
];
const DEFAULT_VISIBLE_COLUMNS: readonly ToggleColumnKey[] = [
  'name',
  'description',
  'aliases',
  'directMembersCount',
];
const VISIBLE_COLUMNS_STORAGE_KEY = StorageKeys.groups.visibleColumns;

// v0.221: shared visibleColumnsStorage factory 사용.
const VALID_COLUMN_KEYS = TOGGLEABLE_COLUMNS.map((c) => c.key) as readonly ToggleColumnKey[];
const deserializeVisibleColumns = makeVisibleColumnsDeserializer<ToggleColumnKey>(
  VALID_COLUMN_KEYS,
  DEFAULT_VISIBLE_COLUMNS,
);

// v0.221 R1: `deserializeSort` 를 shared `sortStorage.ts` factory 로 이식.

export function GroupsTable() {
  const { data, isLoading, isError, error } = useGroupsList();
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiFilter = searchParams.get('filter');
  const searchQuery = searchParams.get('q') ?? '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditGroupTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);
  // v0.165: 선택 상태 (bulk delete 대상). 필터 밖 선택은 유지 —
  // 사용자가 여러 필터로 나눠 담을 수 있어야 함 (AccountsTable v0.155 대칭).
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkUpdateDescriptionOpen, setIsBulkUpdateDescriptionOpen] = useState(false);
  // v0.225: 「선호 초기화」 성공 배너 · v0.226: shared hook (unmount cleanup 안전).
  const { message: successBanner, show: showSuccessBanner } =
    useAutoDismissBanner();
  const sortColumn: SortColumn = (() => {
    const raw = searchParams.get('sort');
    return raw === 'email' || raw === 'name' || raw === 'directMembersCount' ? raw : null;
  })();
  const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const [page, setPage] = useState(0);
  // v0.194: 페이지 크기 선택 (v0.193 AccountsTable 대칭). v0.220: useLocalStorageState 이식.
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>(
    PAGE_SIZE_STORAGE_KEY,
    DEFAULT_PAGE_SIZE,
    serializePageSize,
    deserializePageSize,
  );
  // v0.221: sort 선호 useLocalStorageState 이식 (AccountsTable 대칭).
  const [storedSort, setStoredSort] = useLocalStorageState<StoredSortPref | null>(
    SORT_STORAGE_KEY,
    null,
    undefined,
    deserializeSort,
  );

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(0);
  };

  // v0.200: 컬럼 표시 여부 (v0.199 AccountsTable 대칭). v0.221: useLocalStorageState 이식.
  const [visibleColumns, setVisibleColumns] = useLocalStorageState<Set<ToggleColumnKey>>(
    VISIBLE_COLUMNS_STORAGE_KEY,
    new Set(DEFAULT_VISIBLE_COLUMNS),
    serializeVisibleColumns,
    deserializeVisibleColumns,
  );
  // v0.289: 컬럼 메뉴 popover 상태 + 4 hook 배선 shared.
  const {
    isOpen: isColumnMenuOpen,
    close: closeColumnMenu,
    toggle: toggleColumnMenu,
    buttonRef: columnMenuBtnRef,
    menuRef: columnMenuRef,
  } = useColumnMenu();

  const toggleColumn = (key: ToggleColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // v0.204: 전체 표시 / 전체 숨김 quick actions.
  const setAllVisible = (visible: boolean) => {
    setVisibleColumns(
      visible ? new Set(TOGGLEABLE_COLUMNS.map((c) => c.key)) : new Set(),
    );
  };

  // v0.205: 「간결」 preset — 이름 컬럼만 표시.
  const applyMinimalPreset = () => {
    setVisibleColumns(new Set(['name']));
  };
  const isMinimalActive =
    visibleColumns.size === 1 && visibleColumns.has('name');

  // v0.207: 「선호 초기화」 — sort · pageSize · visibleColumns 모두 default 로.
  // v0.209: 실수 방지 confirm. v0.220/v0.221/v0.222: 모두 hook 이 저장.
  // v0.221 R1 F-B 방어: sort 는 removeItem 도 시도 (setItem("null") quota 실패 방어).
  const resetUserPreferences = () => {
    const ok = window.confirm(
      '저장된 선호 (정렬 · 페이지 크기 · 컬럼 표시) 를 모두 기본값으로 초기화하시겠습니까?',
    );
    if (!ok) return;
    try {
      localStorage.removeItem(SORT_STORAGE_KEY);
    } catch {
      // localStorage disabled → no-op.
    }
    setPageSize(DEFAULT_PAGE_SIZE);
    setStoredSort(null);
    setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS));
    const next = new URLSearchParams(searchParams);
    next.delete('sort');
    next.delete('dir');
    setSearchParams(next, { replace: false });
    setPage(0);
    closeColumnMenu();
    // v0.225: 초기화 확인 배너 · v0.226: shared hook.
    showSuccessBanner('저장된 선호가 초기화되었습니다.');
  };

  useEffect(() => {
    setPage(0);
  }, [searchQuery, kpiFilter, sortColumn, sortDirection]);

  // v0.165: 필터/검색/정렬 변경 시 selection 리셋 (AccountsTable v0.155 대칭 UX).
  // bulk 작업이 필터 밖 그룹에 실행되는 것을 방지.
  useEffect(() => {
    setSelectedEmails(new Set());
  }, [searchQuery, kpiFilter, sortColumn, sortDirection]);

  // v0.161: 첫 mount 에서 URL 이 sort 없으면 localStorage 저장값을 URL 로 hydrate.
  // v0.221: hook 이 storedSort 를 mount 시 hydrate.
  useEffect(() => {
    if (searchParams.has('sort')) return;
    if (!storedSort) return;
    const next = new URLSearchParams(searchParams);
    if (
      storedSort.sort === 'email' ||
      storedSort.sort === 'name' ||
      storedSort.sort === 'directMembersCount'
    ) {
      next.set('sort', storedSort.sort);
    }
    if (storedSort.dir === 'asc' || storedSort.dir === 'desc') {
      next.set('dir', storedSort.dir);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // Mount-only hydrate: intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v0.161: sortColumn/sortDirection 변경 시 localStorage 저장.
  // v0.221: hook setter 사용 · null 은 「null」 저장 (semantic 동일).
  useEffect(() => {
    if (sortColumn) {
      setStoredSort({ sort: sortColumn, dir: sortDirection });
    } else {
      setStoredSort(null);
    }
  }, [sortColumn, sortDirection, setStoredSort]);

  const handleSort = (column: 'email' | 'name' | 'directMembersCount') => {
    const next = new URLSearchParams(searchParams);
    if (sortColumn === column) {
      next.set('dir', sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sort', column);
      next.set('dir', 'asc');
    }
    setSearchParams(next, { replace: false });
  };

  const sortedFilteredGroups = useMemo(() => {
    if (!data?.groups) return [];
    let result = data.groups;

    // KPI 필터 먼저. v0.127b F105: allowlist 밖 filter 는 fail-open (필터
     // 미적용) 로 처리 — v0.125 AccountsTable 대칭. 이전에는 fail-closed 라
     // `?filter=weird` 로 목록이 사라졌고 「필터 초기화」 버튼도 disabled
     // (allowlist 밖) 라 사용자가 복구할 수 없었음.
    if (kpiFilter === 'with-members') {
      result = result.filter((g: GroupItem) => (g.directMembersCount ?? 0) > 0);
    } else if (kpiFilter === 'empty') {
      result = result.filter((g: GroupItem) => (g.directMembersCount ?? 0) === 0);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((group: GroupItem) => {
        const email = (group.email || '').toLowerCase();
        const name = (group.name || '').toLowerCase();
        const description = (group.description || '').toLowerCase();
        return email.includes(q) || name.includes(q) || description.includes(q);
      });
    }
    if (sortColumn) {
      result = [...result].sort((a: GroupItem, b: GroupItem) => {
        let cmp = 0;
        if (sortColumn === 'email') {
          cmp = (a.email || '').localeCompare(b.email || '');
        } else if (sortColumn === 'name') {
          cmp = (a.name || '').localeCompare(b.name || '');
        } else if (sortColumn === 'directMembersCount') {
          cmp = (a.directMembersCount ?? 0) - (b.directMembersCount ?? 0);
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data?.groups, kpiFilter, searchQuery, sortColumn, sortDirection]);

  const total = sortedFilteredGroups.length;
  const paginatedGroups = sortedFilteredGroups.slice(page * pageSize, (page + 1) * pageSize);

  // v0.165: 전체 선택 / indeterminate 계산 (현재 필터 결과 내 eligible).
  const eligibleEmails = useMemo(
    () => sortedFilteredGroups.map((g) => g.email),
    [sortedFilteredGroups],
  );
  const selectedInFilter = eligibleEmails.filter((e) => selectedEmails.has(e));
  const allSelectedInFilter =
    eligibleEmails.length > 0 && selectedInFilter.length === eligibleEmails.length;
  const someSelectedInFilter =
    selectedInFilter.length > 0 && selectedInFilter.length < eligibleEmails.length;

  const toggleOne = (email: string, checked: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (checked) next.add(email);
      else next.delete(email);
      return next;
    });
  };
  const toggleAllInFilter = (checked: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (checked) eligibleEmails.forEach((e) => next.add(e));
      else eligibleEmails.forEach((e) => next.delete(e));
      return next;
    });
  };

  const handleExportCsv = () => {
    const header = ['이메일', '이름', '설명', '멤버 수'];
    const rows = sortedFilteredGroups.map((g) => [
      g.email,
      g.name || '-',
      g.description || '-',
      String(g.directMembersCount ?? 0),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groups-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // v0.157: JSON \uB0B4\uBCF4\uB0B4\uAE30 (AccountsTable v0.152 \uB300\uCE6D). exportedAt \u00B7 filters \u00B7
  // totalCount \u00B7 groups[] (email \u00B7 name \u00B7 description \u00B7 directMembersCount \u00B7 aliases).
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: {
        q: searchQuery.trim(),
        filter: kpiFilter,
        sort: sortColumn,
        dir: sortDirection,
      },
      totalCount: sortedFilteredGroups.length,
      groups: sortedFilteredGroups.map((g) => ({
        email: g.email,
        name: g.name ?? '',
        description: g.description ?? '',
        directMembersCount: g.directMembersCount ?? 0,
        aliases: g.aliases ?? [],
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groups-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* v0.225: 「선호 초기화」 성공 배너 · v0.287: Banner variant=success 직접 사용. */}
      <Banner variant="success" message={successBanner} testId="groups-success-banner" />
      <div className="flex justify-between items-center gap-4">
        <p className="text-small text-fg-secondary">
          조직 내 등록된 Google Workspace 그룹 및 멤버 현황
        </p>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              const v = e.target.value;
              if (v) next.set('q', v); else next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            placeholder="이메일, 이름 또는 설명으로 검색"
            aria-label="그룹 검색"
            data-testid="groups-search-input"
            className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
          {/* v0.127: 필터 초기화 — v0.125 AccountsTable · v0.112 AuditLogTable 대칭.
              활성 판정은 실제 필터 적용 규칙 기준으로 정규화: q trim non-empty ·
              kpiFilter allowlist (with-members/empty) · sortColumn 이미 normalize
              된 non-null · dir 단독 제외. */}
          <Button
            variant="secondary"
            onClick={() => setSearchParams(new URLSearchParams(), { replace: false })}
            disabled={
              searchQuery.trim().length === 0 &&
              kpiFilter !== 'with-members' &&
              kpiFilter !== 'empty' &&
              sortColumn === null
            }
            data-testid="groups-clear-filters-btn"
            title="검색·필터·정렬 초기화"
          >
            필터 초기화
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            data-testid="groups-export-csv-btn"
            disabled={sortedFilteredGroups.length === 0}
          >
            CSV 내보내기
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportJson}
            data-testid="groups-export-json-btn"
            disabled={sortedFilteredGroups.length === 0}
            title={
              sortedFilteredGroups.length === 0
                ? '내보낼 그룹이 없습니다.'
                : '현재 필터 반영 JSON 다운로드 (exportedAt · filters 메타 포함)'
            }
          >
            JSON 내보내기
          </Button>
          {/* v0.200: 컬럼 표시 토글. v0.291: shared ColumnMenu 컴포넌트. */}
          <ColumnMenu
            buttonRef={columnMenuBtnRef}
            menuRef={columnMenuRef}
            isOpen={isColumnMenuOpen}
            onToggle={toggleColumnMenu}
            columns={TOGGLEABLE_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            onShowAll={() => setAllVisible(true)}
            onHideAll={() => setAllVisible(false)}
            minimalPreset={{ onApply: applyMinimalPreset, isActive: isMinimalActive }}
            onResetPreferences={resetUserPreferences}
            testIdPrefix="groups"
          />
          <Button
            onClick={() => setIsCreateOpen(true)}
            data-testid="add-group-btn"
          >
            + 그룹 추가
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="groups-loading">
          그룹 목록을 불러오는 중...
        </div>
      )}

      {/* v0.244: Banner 이식. */}
      <Banner
        variant="error"
        message={
          isError
            ? error?.message?.includes('permission-denied') ||
              error?.message?.includes('PERMISSION_DENIED') ||
              error?.message?.includes('failed-precondition') ||
              error?.message?.includes('http_403')
              ? '이 기능은 관리자만 사용할 수 있습니다.'
              : `그룹 목록을 불러오지 못했습니다: ${error?.message || '알 수 없는 오류'}`
            : null
        }
        testId="groups-error"
      />

      {!isLoading && !isError && (!data?.groups || data.groups.length === 0) && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="groups-empty">
          등록된 그룹이 없습니다.
        </div>
      )}

      {!isLoading && !isError && data?.groups && data.groups.length > 0 && (
        <>
          {/* v0.165: bulk actions bar — 선택된 그룹이 있을 때만 노출 (AccountsTable 대칭). */}
          {selectedEmails.size > 0 && (
            <div
              className="flex justify-between items-center border border-border-subtle bg-elevated px-4 py-2"
              data-testid="groups-bulk-actions"
            >
              <p className="text-small text-fg-primary">
                <strong className="font-mono">{selectedEmails.size}</strong>개 선택됨
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedEmails(new Set())}
                  className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
                  data-testid="groups-bulk-clear-btn"
                >
                  선택 해제
                </button>
                <Button
                  variant="secondary"
                  onClick={() => setIsBulkUpdateDescriptionOpen(true)}
                  data-testid="groups-bulk-update-description-btn"
                >
                  선택 설명 변경
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  data-testid="groups-bulk-delete-btn"
                  className="text-state-danger"
                >
                  선택 삭제
                </Button>
              </div>
            </div>
          )}

          {sortedFilteredGroups.length === 0 ? (
            <div className="py-12 text-center text-small text-fg-secondary" data-testid="groups-search-empty">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
              <Table aria-label="그룹 목록">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={allSelectedInFilter}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelectedInFilter;
                        }}
                        onChange={(e) => toggleAllInFilter(e.target.checked)}
                        aria-label="전체 선택 (현재 필터 결과)"
                        data-testid="groups-bulk-check-all"
                      />
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('email')}
                      {...sortHeaderKbdProps(() => handleSort('email'))}
                      data-testid="groups-sort-email"
                      aria-sort={sortColumn === 'email' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      이메일 {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    {visibleColumns.has('name') && (
                      <TableHead
                        onClick={() => handleSort('name')}
                        {...sortHeaderKbdProps(() => handleSort('name'))}
                        data-testid="groups-sort-name"
                        aria-sort={sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        이름 {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                    )}
                    {visibleColumns.has('description') && <TableHead>설명</TableHead>}
                    {visibleColumns.has('aliases') && <TableHead>별칭</TableHead>}
                    {visibleColumns.has('directMembersCount') && (
                      <TableHead
                        onClick={() => handleSort('directMembersCount')}
                        {...sortHeaderKbdProps(() => handleSort('directMembersCount'), 'text-right')}
                        data-testid="groups-sort-directMembersCount"
                        aria-sort={sortColumn === 'directMembersCount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        멤버 수 {sortColumn === 'directMembersCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                    )}
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {paginatedGroups.map((group: GroupItem) => {
                const aliasText =
                  group.aliases && group.aliases.length > 0 ? group.aliases.join(', ') : '-';

                return (
                  <TableRow key={group.email} data-testid={`group-row-${group.email}`}>
                    <TableCell className="w-8">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(group.email)}
                        onChange={(e) => toggleOne(group.email, e.target.checked)}
                        aria-label={`선택: ${group.email}`}
                        data-testid={`groups-bulk-check-${group.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-small text-fg-primary">
                      <Link
                        to={`/admin/groups/${encodeURIComponent(group.email)}`}
                        className="text-fg-primary hover:underline"
                      >
                        {group.email}
                      </Link>
                    </TableCell>
                    {visibleColumns.has('name') && (
                      <TableCell className="text-fg-primary">
                        {group.name || '-'}
                      </TableCell>
                    )}
                    {visibleColumns.has('description') && (
                      <TableCell
                        truncate
                        className="text-small text-fg-secondary"
                        title={group.description || ''}
                      >
                        {group.description || '-'}
                      </TableCell>
                    )}
                    {visibleColumns.has('aliases') && (
                      <TableCell className="text-small font-mono text-fg-secondary">
                        {aliasText}
                      </TableCell>
                    )}
                    {visibleColumns.has('directMembersCount') && (
                      <TableCell className="text-right font-mono text-small text-fg-primary">
                        {group.directMembersCount}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditTarget({
                              email: group.email,
                              name: group.name,
                              description: group.description || '',
                            })
                          }
                          data-testid={`edit-group-${group.email}`}
                          className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        >
                          편집
                        </button>
                        <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              email: group.email,
                              name: group.name,
                            })
                          }
                          data-testid={`delete-group-${group.email}`}
                          className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        >
                          삭제
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-between items-center mt-4 text-small text-fg-secondary">
            <span data-testid="groups-pagination-info">
              {total === 0
                ? '결과 없음'
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total} (${page + 1} / ${Math.max(1, Math.ceil(total / pageSize))} 페이지)`}
            </span>
            <div className="flex items-center gap-2">
              {/* v0.194: 페이지 크기 선택 (v0.193 AccountsTable 대칭). */}
              <label htmlFor="groups-page-size" className="text-small text-fg-secondary">
                페이지 크기:
              </label>
              <select
                id="groups-page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
                data-testid="groups-page-size-select"
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
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="groups-pagination-prev"
                className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= total}
                data-testid="groups-pagination-next"
                className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                다음
              </button>
            </div>
          </div>
        </>
      )}

      <CreateGroupDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <EditGroupDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        group={editTarget}
      />

      <DeleteGroupDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        group={deleteTarget}
      />

      {isBulkDeleteOpen && (
        <BulkDeleteGroupDialog
          open={true}
          onOpenChange={setIsBulkDeleteOpen}
          emails={Array.from(selectedEmails)}
          onDone={() => setSelectedEmails(new Set())}
        />
      )}

      {isBulkUpdateDescriptionOpen && (
        <BulkUpdateGroupDescriptionDialog
          open={true}
          onOpenChange={setIsBulkUpdateDescriptionOpen}
          emails={Array.from(selectedEmails)}
          onDone={() => setSelectedEmails(new Set())}
        />
      )}
    </div>
  );
}
