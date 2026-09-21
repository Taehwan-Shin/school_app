import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useUsersList, type UserItem } from "../../api/usersList";
import { Button } from "../../components/ui/button";
import { sortHeaderKbdProps } from "./sortHeader";
import { useClickOutside } from "../../lib/useClickOutside";
import { useEscapeKey } from "../../lib/useEscapeKey";
import { useFocusTrap } from "../../lib/useFocusTrap";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { CreateUserDialog } from "./CreateUserDialog";
import { BatchCreateUsersDialog } from "./BatchCreateUsersDialog";
import { EditUserDialog, type EditUserTarget } from "./EditUserDialog";
import { EditUserRoleDialog, type EditUserRoleTarget } from "./EditUserRoleDialog";
import { DeleteUserDialog, type DeleteUserTarget } from "./DeleteUserDialog";
import { SuspendUserDialog, type SuspendUserTarget } from "./SuspendUserDialog";
import { ResetPasswordDialog, type ResetPasswordTarget } from "./ResetPasswordDialog";
import { BulkSuspendDialog } from "./BulkSuspendDialog";
import { BulkRestoreDialog } from "./BulkRestoreDialog";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { BulkMoveOuDialog } from "./BulkMoveOuDialog";
import { BulkResetPasswordDialog } from "./BulkResetPasswordDialog";
import { BulkUpdateRoleDialog } from "./BulkUpdateRoleDialog";

type SortColumn = 'email' | 'name' | 'orgUnitPath' | null;
type SortDirection = 'asc' | 'desc';

// v0.193: 페이지 크기 셀렉터. 사용자 선택은 localStorage 에 저장 (도메인 · 사용자 로컬).
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 25;
const PAGE_SIZE_STORAGE_KEY = 'accountsTable.pageSize.v1';

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

// v0.160: 정렬 선호 localStorage 키. URL 이 authoritative — localStorage 는 URL 이
// 비어있을 때만 default 로 hydrate. 손상된 값은 조용히 무시.
const SORT_STORAGE_KEY = 'accountsTable.sort.v1';

// v0.199: 컬럼 표시 여부 선택. 선택/이메일/관리 3 개는 필수 (항상 표시).
// 나머지 4개 (이름 · 조직 단위 · 관리자 · 정지) 는 사용자가 숨김/표시 가능.
type ToggleColumnKey = 'name' | 'orgUnitPath' | 'admin' | 'suspended';
const TOGGLEABLE_COLUMNS: readonly { key: ToggleColumnKey; label: string }[] = [
  { key: 'name', label: '이름' },
  { key: 'orgUnitPath', label: '조직 단위' },
  { key: 'admin', label: '관리자' },
  { key: 'suspended', label: '정지' },
];
const DEFAULT_VISIBLE_COLUMNS: ToggleColumnKey[] = ['name', 'orgUnitPath', 'admin', 'suspended'];
const VISIBLE_COLUMNS_STORAGE_KEY = 'accountsTable.visibleColumns.v1';

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

export function AccountsTable() {
  const { user: currentUser, role: currentRole } = useAuth();
  const { data, isLoading, isError, error } = useUsersList();
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiFilter = searchParams.get('filter');
  const searchQuery = searchParams.get('q') ?? '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBatchCreateOpen, setIsBatchCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteUserTarget | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<SuspendUserTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditUserTarget | null>(null);
  const [editRoleTarget, setEditRoleTarget] = useState<EditUserRoleTarget | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const sortColumn: SortColumn = (() => {
    const raw = searchParams.get('sort');
    return raw === 'email' || raw === 'name' || raw === 'orgUnitPath' ? raw : null;
  })();
  const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const [page, setPage] = useState(0);
  // v0.193: 페이지 크기 선택 (25/50/100). localStorage hydrate + 저장.
  const [pageSize, setPageSize] = useState<PageSize>(() => readStoredPageSize());
  // v0.199: 컬럼 표시 여부. lazy init from localStorage.
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

  // v0.205: 「간결」 preset — 이름 컬럼만 표시 (이메일 + 관리 는 필수라 항상 있음).
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

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(0);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      // localStorage disabled → no-op.
    }
  };

  // v0.160: 첫 mount 에서 URL 이 sort 없으면 localStorage 저장값을 URL 로 hydrate.
  // URL 이 authoritative → 이미 URL 에 sort 있으면 (deep link 등) 저장값 무시.
  useEffect(() => {
    if (searchParams.has('sort')) return;
    const stored = readStoredSortPref();
    if (!stored) return;
    const next = new URLSearchParams(searchParams);
    if (stored.sort === 'email' || stored.sort === 'name' || stored.sort === 'orgUnitPath') {
      next.set('sort', stored.sort);
    }
    if (stored.dir === 'asc' || stored.dir === 'desc') {
      next.set('dir', stored.dir);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // Mount-only hydrate: intentionally empty deps. searchParams / setSearchParams
    // 는 매 렌더 신규 참조라 dep 에 넣으면 무한 loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v0.160: sortColumn/sortDirection 변경 시 localStorage 저장. null 이면 삭제
  // (「필터 초기화」 후 재방문에서 다시 정렬 안 씌우게).
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

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isBulkMoveOuOpen, setIsBulkMoveOuOpen] = useState(false);
  const [isBulkSuspendOpen, setIsBulkSuspendOpen] = useState(false);
  const [isBulkRestoreOpen, setIsBulkRestoreOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkResetPasswordOpen, setIsBulkResetPasswordOpen] = useState(false);
  const [isBulkUpdateRoleOpen, setIsBulkUpdateRoleOpen] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, kpiFilter, sortColumn, sortDirection]);

  useEffect(() => {
    setSelectedEmails(new Set());
  }, [page, searchQuery, kpiFilter, sortColumn, sortDirection]);

  const handleSort = (column: 'email' | 'name' | 'orgUnitPath') => {
    const next = new URLSearchParams(searchParams);
    if (sortColumn === column) {
      // 같은 컬럼: 방향 토글
      next.set('dir', sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 컬럼: 그 컬럼으로 asc
      next.set('sort', column);
      next.set('dir', 'asc');
    }
    setSearchParams(next, { replace: false });
  };

  const sortedFilteredUsers = useMemo(() => {
    if (!data?.users) return [];
    let result = data.users;

    // KPI 필터 먼저 (검색어와 독립적으로 적용)
    if (kpiFilter === 'admin') {
      result = result.filter((u: UserItem) => u.isAdmin);
    } else if (kpiFilter === 'suspended') {
      result = result.filter((u: UserItem) => u.isSuspended);
    } else if (kpiFilter === 'normal') {
      result = result.filter((u: UserItem) => !u.isAdmin && !u.isSuspended);
    }

    // 검색어 필터
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((user: UserItem) => {
        const email = (user.email || "").toLowerCase();
        const fullName = `${user.lastName || ""}${user.firstName || ""}`.toLowerCase();
        return email.includes(q) || fullName.includes(q);
      });
    }

    // 정렬 (기존 코드 그대로)
    if (sortColumn) {
      result = [...result].sort((a: UserItem, b: UserItem) => {
        let cmp = 0;
        if (sortColumn === 'email') {
          cmp = (a.email || '').localeCompare(b.email || '');
        } else if (sortColumn === 'name') {
          const nameA = `${a.lastName || ''}${a.firstName || ''}`;
          const nameB = `${b.lastName || ''}${b.firstName || ''}`;
          cmp = nameA.localeCompare(nameB);
        } else if (sortColumn === 'orgUnitPath') {
          cmp = (a.orgUnitPath || '/').localeCompare(b.orgUnitPath || '/');
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data?.users, kpiFilter, searchQuery, sortColumn, sortDirection]);

  const total = sortedFilteredUsers.length;
  const paginatedUsers = sortedFilteredUsers.slice(page * pageSize, (page + 1) * pageSize);

  const isSelf = (email: string) =>
    Boolean(currentUser?.email) && currentUser!.email!.toLowerCase() === email.toLowerCase();

  const eligibleEmails = paginatedUsers
    .filter((u) => !isSelf(u.email))
    .map((u) => u.email);

  const isAllEligibleSelected =
    eligibleEmails.length > 0 && eligibleEmails.every((e) => selectedEmails.has(e));
  const isSomeEligibleSelected =
    eligibleEmails.some((e) => selectedEmails.has(e)) && !isAllEligibleSelected;

  // v0.155: 선택된 계정 있으면 그것만 export · 없으면 sortedFilteredUsers.
  // 주의: 위 effect 가 필터/검색/정렬 변경 시 선택을 리셋하므로 export 는 현재
  // 필터 결과 안의 선택만 반영 (필터를 바꾸면 선택도 지워짐). 이는 bulk 작업이
  // 필터 밖 계정에 실행되는 것을 방지하는 기존 UX 계약 (v0.113 이전 도입).
  const exportUsers = useMemo(() => {
    if (selectedEmails.size === 0) return sortedFilteredUsers;
    return sortedFilteredUsers.filter((u) => selectedEmails.has(u.email));
  }, [sortedFilteredUsers, selectedEmails]);
  const exportScope: 'selected' | 'filtered' =
    selectedEmails.size > 0 ? 'selected' : 'filtered';

  const handleExportCsv = () => {
    const header = ['이메일', '이름', '조직 단위', '관리자', '상태'];
    const rows = exportUsers.map((u) => [
      u.email,
      `${u.lastName ?? ''}${u.firstName ?? ''}`.trim() || '-',
      u.orgUnitPath || '/',
      u.isAdmin ? '관리자' : '일반',
      u.isSuspended ? '정지됨' : '정상',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // v0.155: \uC120\uD0DD \uC2A4\uCF54\uD504\uBA74 \uD30C\uC77C\uBA85\uC5D0 -selected \uC811\uBBF8\uC0AC.
    const scopeSuffix = exportScope === 'selected' ? '-selected' : '';
    a.download = `accounts${scopeSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // v0.152: JSON \uB0B4\uBCF4\uB0B4\uAE30 (\uB85C\uB4DC\uB9F5 B-6). CSV \uB294 \uC0AC\uB78C\uC774 \uC5F4\uB78C\uC6A9, JSON \uC740 \uC790\uB3D9\uD654/
  // \uAC10\uC0AC\u00B7\uC7AC\uC801\uC7AC\uC6A9. sortedFilteredUsers (\uAC80\uC0C9\u00B7\uC815\uB82C\u00B7\uD544\uD130 \uBC18\uC601) \u00B7 exportedAt \uBA54\uD0C0
  // \uD3EC\uD568. AuditLogTable v0.108 export \uB300\uCE6D.
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      // v0.155: scope 필드 추가 · selected 인 경우 filters 는 참고용.
      scope: exportScope,
      filters: {
        q: searchQuery.trim(),
        filter: kpiFilter,
        sort: sortColumn,
        dir: sortDirection,
      },
      totalCount: exportUsers.length,
      users: exportUsers.map((u) => ({
        email: u.email,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        orgUnitPath: u.orgUnitPath || '/',
        isAdmin: !!u.isAdmin,
        isSuspended: !!u.isSuspended,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const scopeSuffix = exportScope === 'selected' ? '-selected' : '';
    a.download = `accounts${scopeSuffix}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <p className="text-small text-fg-secondary">
          조직 내 등록된 사용자 계정 및 권한 상태
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
            placeholder="이메일 또는 이름으로 검색"
            aria-label="계정 검색"
            data-testid="accounts-search-input"
            className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
          {/* v0.125 / v0.125b F101: 필터 초기화 — v0.112 AuditLogTable 대칭.
              활성 판정은 「실제 필터 적용 규칙」 기준: q 는 trim 후 non-empty,
              kpiFilter 는 allowlist (admin/suspended/normal), sortColumn 은 이미
              normalize 된 non-null, dir 는 sort 가 있을 때만 유효. 이렇게 하면
              URL 의 공백-only q · 잘못된 filter · dir 단독 등 효과 없는 param
              에서는 disabled 유지. */}
          <Button
            variant="secondary"
            onClick={() => setSearchParams(new URLSearchParams(), { replace: false })}
            disabled={
              searchQuery.trim().length === 0 &&
              kpiFilter !== 'admin' &&
              kpiFilter !== 'suspended' &&
              kpiFilter !== 'normal' &&
              sortColumn === null
            }
            data-testid="accounts-clear-filters-btn"
            title="검색·필터·정렬 초기화"
          >
            필터 초기화
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            data-testid="accounts-export-csv-btn"
            disabled={exportUsers.length === 0}
            title={
              exportScope === 'selected'
                ? `선택 ${exportUsers.length}개 계정 CSV 다운로드`
                : `필터 결과 ${exportUsers.length}개 계정 CSV 다운로드`
            }
          >
            CSV 내보내기{exportScope === 'selected' ? ` (선택 ${exportUsers.length})` : ''}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportJson}
            data-testid="accounts-export-json-btn"
            disabled={exportUsers.length === 0}
            title={
              exportUsers.length === 0
                ? '내보낼 계정이 없습니다.'
                : exportScope === 'selected'
                  ? `선택 ${exportUsers.length}개 계정 JSON 다운로드 (scope=selected)`
                  : '현재 필터 반영 JSON 다운로드 (exportedAt · filters 메타 포함)'
            }
          >
            JSON 내보내기{exportScope === 'selected' ? ` (선택 ${exportUsers.length})` : ''}
          </Button>
          {/* v0.199: 컬럼 표시 토글. 클릭 시 checkbox 목록 pop. localStorage 저장. */}
          <div className="relative">
            <Button
              ref={columnMenuBtnRef}
              variant="secondary"
              onClick={() => setIsColumnMenuOpen((prev) => !prev)}
              data-testid="accounts-column-menu-btn"
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
                data-testid="accounts-column-menu"
                className="absolute right-0 mt-1 z-10 border border-border-subtle bg-canvas shadow-lg py-2 min-w-40"
              >
                {/* v0.204: 전체 표시/전체 숨김 quick actions. v0.205: 「간결」 preset. */}
                <div className="flex flex-wrap gap-1 px-3 pb-2 border-b border-border-subtle mb-1">
                  <button
                    type="button"
                    onClick={() => setAllVisible(true)}
                    disabled={visibleColumns.size === TOGGLEABLE_COLUMNS.length}
                    data-testid="accounts-column-show-all"
                    className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    전체 표시
                  </button>
                  <span className="text-micro text-fg-muted" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={applyMinimalPreset}
                    disabled={isMinimalActive}
                    data-testid="accounts-column-preset-minimal"
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
                    data-testid="accounts-column-hide-all"
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
                      data-testid={`accounts-column-toggle-${key}`}
                      className="cursor-pointer"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            data-testid="add-account-btn"
          >
            + 계정 추가
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsBatchCreateOpen(true)}
            data-testid="add-batch-accounts-btn"
          >
            + 전입생 일괄 추가
          </Button>
        </div>
      </div>

      {successBanner && (
        <div
          className="border border-state-success bg-surface p-4 text-small text-state-success"
          data-testid="accounts-success-banner"
        >
          {successBanner}
        </div>
      )}

      {selectedEmails.size > 0 && (
        <div
          className="flex items-center justify-between bg-surface border border-border-strong p-4"
          data-testid="bulk-action-bar"
        >
          <div className="text-small text-fg-primary">
            <strong className="font-mono">{selectedEmails.size}</strong>명 선택됨
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedEmails(new Set())}
              className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
              data-testid="bulk-clear-btn"
            >
              선택 해제
            </button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkMoveOuOpen(true)}
              data-testid="bulk-move-ou-btn"
            >
              선택 조직 이동
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkSuspendOpen(true)}
              data-testid="bulk-suspend-btn"
            >
              선택 정지
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkRestoreOpen(true)}
              data-testid="bulk-restore-btn"
            >
              선택 복구
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkResetPasswordOpen(true)}
              data-testid="bulk-reset-password-btn"
            >
              선택 비밀번호 변경
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkUpdateRoleOpen(true)}
              data-testid="bulk-update-role-btn"
            >
              선택 역할 변경
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsBulkDeleteOpen(true)}
              data-testid="bulk-delete-btn"
              className="text-state-danger"
            >
              선택 삭제
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="accounts-loading">
          계정 목록을 불러오는 중...
        </div>
      )}

      {isError && (
        <div
          className="border border-state-danger p-4 text-small text-state-danger"
          data-testid="accounts-error"
        >
          {error?.message?.includes("permission-denied") ||
          error?.message?.includes("PERMISSION_DENIED") ||
          error?.message?.includes("failed-precondition") ||
          error?.message?.includes("http_403")
            ? "이 기능은 관리자만 사용할 수 있습니다."
            : `계정 목록을 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`}
        </div>
      )}

      {!isLoading && !isError && (!data?.users || data.users.length === 0) && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="accounts-empty">
          등록된 계정이 없습니다.
        </div>
      )}

      {!isLoading && !isError && data?.users && data.users.length > 0 && (
        <>
          {sortedFilteredUsers.length === 0 ? (
            <div className="py-12 text-center text-small text-fg-secondary" data-testid="accounts-search-empty">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={isAllEligibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeEligibleSelected;
                        }}
                        disabled={eligibleEmails.length === 0}
                        onChange={(e) => {
                          const next = new Set(selectedEmails);
                          if (e.target.checked) {
                            eligibleEmails.forEach((email) => next.add(email));
                          } else {
                            eligibleEmails.forEach((email) => next.delete(email));
                          }
                          setSelectedEmails(next);
                        }}
                        aria-label="전체 선택"
                        data-testid="bulk-check-all"
                        className="cursor-pointer disabled:cursor-not-allowed"
                      />
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('email')}
                      {...sortHeaderKbdProps(() => handleSort('email'))}
                      data-testid="accounts-sort-email"
                      aria-sort={sortColumn === 'email' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    {visibleColumns.has('name') && (
                      <TableHead
                        onClick={() => handleSort('name')}
                        {...sortHeaderKbdProps(() => handleSort('name'))}
                        data-testid="accounts-sort-name"
                        aria-sort={sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        이름 {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                    )}
                    {visibleColumns.has('orgUnitPath') && (
                      <TableHead
                        onClick={() => handleSort('orgUnitPath')}
                        {...sortHeaderKbdProps(() => handleSort('orgUnitPath'))}
                        data-testid="accounts-sort-orgUnitPath"
                        aria-sort={sortColumn === 'orgUnitPath' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        조직 단위 {sortColumn === 'orgUnitPath' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                    )}
                    {visibleColumns.has('admin') && <TableHead className="text-center">관리자</TableHead>}
                    {visibleColumns.has('suspended') && <TableHead className="text-center">정지</TableHead>}
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user: UserItem) => {
                    const fullName = `${user.lastName}${user.firstName}`.trim() || "-";
                    const userIsSelf = isSelf(user.email);

                    return (
                      <TableRow key={user.email}>
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(user.email)}
                            disabled={userIsSelf}
                            onChange={(e) => {
                              const next = new Set(selectedEmails);
                              if (e.target.checked) next.add(user.email);
                              else next.delete(user.email);
                              setSelectedEmails(next);
                            }}
                            aria-label={`${user.email} 선택`}
                            data-testid={`bulk-check-${user.email}`}
                            className="cursor-pointer disabled:cursor-not-allowed"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-small">
                          <Link to={`/admin/users/${encodeURIComponent(user.email)}`} className="text-fg-primary hover:underline">
                            {user.email}
                          </Link>
                        </TableCell>
                        {visibleColumns.has('name') && (
                          <TableCell className="text-fg-primary">{fullName}</TableCell>
                        )}
                        {visibleColumns.has('orgUnitPath') && (
                          <TableCell className="font-mono text-small text-fg-secondary">
                            {user.orgUnitPath || "/"}
                          </TableCell>
                        )}
                        {visibleColumns.has('admin') && (
                          <TableCell className="text-center">
                            {user.isAdmin ? (
                              <span className="text-micro font-medium text-fg-primary">
                                관리자
                              </span>
                            ) : (
                              <span className="text-micro text-fg-muted">
                                일반
                              </span>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.has('suspended') && (
                          <TableCell className="text-center">
                            {user.isSuspended ? (
                              <span className="text-micro font-medium text-state-danger">
                                정지됨
                              </span>
                            ) : (
                              <span className="text-micro text-fg-muted">
                                정상
                              </span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setEditTarget({
                                  email: user.email,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                  orgUnitPath: user.orgUnitPath || "/",
                                })
                              }
                              data-testid={`edit-user-${user.email}`}
                              className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                            >
                              편집
                            </button>
                            {currentRole === 'super_admin' && (
                              <>
                                <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditRoleTarget({
                                      email: user.email,
                                    })
                                  }
                                  data-testid={`edit-user-role-${user.email}`}
                                  title="역할 변경 (super_admin 전용)"
                                  className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                                >
                                  역할
                                </button>
                              </>
                            )}
                            <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                            <button
                              type="button"
                              disabled={userIsSelf}
                              title={userIsSelf ? "자기 계정 비밀번호는 여기서 재설정할 수 없습니다" : "비밀번호 재설정"}
                              onClick={() =>
                                setResetTarget({
                                  email: user.email,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                })
                              }
                              data-testid={`reset-password-${user.email}`}
                              className={
                                userIsSelf
                                  ? "text-fg-muted cursor-not-allowed no-underline text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                                  : "text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                              }
                            >
                              비밀번호
                            </button>
                            <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                            <button
                              type="button"
                              disabled={userIsSelf}
                              title={userIsSelf ? "자기 계정은 정지·복구할 수 없습니다" : (user.isSuspended ? "계정 복구" : "계정 정지")}
                              onClick={() =>
                                setSuspendTarget({
                                  email: user.email,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                  isSuspended: user.isSuspended,
                                })
                              }
                              data-testid={`suspend-user-${user.email}`}
                              className={
                                userIsSelf
                                  ? "text-fg-muted cursor-not-allowed no-underline text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                                  : user.isSuspended
                                  ? "text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                                  : "text-state-warning underline decoration-transparent hover:decoration-state-warning text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                              }
                            >
                              {user.isSuspended ? "복구" : "정지"}
                            </button>
                            <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                            <button
                              type="button"
                              disabled={userIsSelf}
                              title={userIsSelf ? "자기 계정은 삭제할 수 없습니다" : "계정 삭제"}
                              onClick={() =>
                                setDeleteTarget({
                                  email: user.email,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                })
                              }
                              data-testid={`delete-user-${user.email}`}
                              className={
                                // 포커스 링은 UI_SYSTEM §5 공통 토큰 (`ring-border-strong`) 로 통일.
                                // 액션 색(붉은 밑줄)과 포커스 색은 분리하는 것이 승인 스펙.
                                userIsSelf
                                  ? "text-fg-muted cursor-not-allowed no-underline text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                                  : "text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                              }
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
            <span data-testid="accounts-pagination-info">
              {total === 0
                ? '결과 없음'
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total} (${page + 1} / ${Math.max(1, Math.ceil(total / pageSize))} 페이지)`}
            </span>
            <div className="flex items-center gap-2">
              {/* v0.193: 페이지 크기 선택 (25/50/100). 변경 시 page=0 리셋 · localStorage 저장. */}
              <label htmlFor="accounts-page-size" className="text-small text-fg-secondary">
                페이지 크기:
              </label>
              <select
                id="accounts-page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
                data-testid="accounts-page-size-select"
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
                data-testid="accounts-pagination-prev"
                className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= total}
                data-testid="accounts-pagination-next"
                className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                다음
              </button>
            </div>
          </div>
        </>
      )}

      <CreateUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <BatchCreateUsersDialog
        open={isBatchCreateOpen}
        onOpenChange={setIsBatchCreateOpen}
      />

      <EditUserDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        user={editTarget}
      />

      <EditUserRoleDialog
        open={Boolean(editRoleTarget)}
        onOpenChange={(open) => {
          if (!open) setEditRoleTarget(null);
        }}
        user={editRoleTarget}
      />

      <DeleteUserDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        user={deleteTarget}
      />

      <SuspendUserDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => {
          if (!open) setSuspendTarget(null);
        }}
        user={suspendTarget}
      />

      <ResetPasswordDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        user={resetTarget}
        onSuccess={() => {
          setSuccessBanner("비밀번호가 재설정되었습니다.");
          setTimeout(() => {
            setSuccessBanner(null);
          }, 3000);
        }}
      />

      <BulkMoveOuDialog
        open={isBulkMoveOuOpen}
        onOpenChange={setIsBulkMoveOuOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />

      <BulkSuspendDialog
        open={isBulkSuspendOpen}
        onOpenChange={setIsBulkSuspendOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />

      <BulkRestoreDialog
        open={isBulkRestoreOpen}
        onOpenChange={setIsBulkRestoreOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />

      <BulkDeleteDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />

      <BulkResetPasswordDialog
        open={isBulkResetPasswordOpen}
        onOpenChange={setIsBulkResetPasswordOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />

      <BulkUpdateRoleDialog
        open={isBulkUpdateRoleOpen}
        onOpenChange={setIsBulkUpdateRoleOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />
    </div>
  );
}

