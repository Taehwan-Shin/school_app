import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useUsersList, type UserItem } from "../../api/usersList";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { CreateUserDialog } from "./CreateUserDialog";
import { EditUserDialog, type EditUserTarget } from "./EditUserDialog";
import { DeleteUserDialog, type DeleteUserTarget } from "./DeleteUserDialog";
import { SuspendUserDialog, type SuspendUserTarget } from "./SuspendUserDialog";
import { ResetPasswordDialog, type ResetPasswordTarget } from "./ResetPasswordDialog";
import { BulkSuspendDialog } from "./BulkSuspendDialog";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { BulkMoveOuDialog } from "./BulkMoveOuDialog";

type SortColumn = 'email' | 'name' | 'orgUnitPath' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 25;

export function AccountsTable() {
  const { user: currentUser } = useAuth();
  const { data, isLoading, isError, error } = useUsersList();
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiFilter = searchParams.get('filter');
  const searchQuery = searchParams.get('q') ?? '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteUserTarget | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<SuspendUserTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditUserTarget | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const sortColumn: SortColumn = (() => {
    const raw = searchParams.get('sort');
    return raw === 'email' || raw === 'name' || raw === 'orgUnitPath' ? raw : null;
  })();
  const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const [page, setPage] = useState(0);

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isBulkMoveOuOpen, setIsBulkMoveOuOpen] = useState(false);
  const [isBulkSuspendOpen, setIsBulkSuspendOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

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
  const paginatedUsers = sortedFilteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const isSelf = (email: string) =>
    Boolean(currentUser?.email) && currentUser!.email!.toLowerCase() === email.toLowerCase();

  const eligibleEmails = paginatedUsers
    .filter((u) => !isSelf(u.email))
    .map((u) => u.email);

  const isAllEligibleSelected =
    eligibleEmails.length > 0 && eligibleEmails.every((e) => selectedEmails.has(e));
  const isSomeEligibleSelected =
    eligibleEmails.some((e) => selectedEmails.has(e)) && !isAllEligibleSelected;

  const handleExportCsv = () => {
    const header = ['이메일', '이름', '조직 단위', '관리자', '상태'];
    const rows = sortedFilteredUsers.map((u) => [
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
    a.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`;
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
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            data-testid="accounts-export-csv-btn"
            disabled={sortedFilteredUsers.length === 0}
          >
            CSV 내보내기
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            data-testid="add-account-btn"
          >
            + 계정 추가
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
                      className="cursor-pointer select-none"
                      data-testid="accounts-sort-email"
                      aria-sort={sortColumn === 'email' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('name')}
                      className="cursor-pointer select-none"
                      data-testid="accounts-sort-name"
                      aria-sort={sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      이름 {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('orgUnitPath')}
                      className="cursor-pointer select-none"
                      data-testid="accounts-sort-orgUnitPath"
                      aria-sort={sortColumn === 'orgUnitPath' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      조직 단위 {sortColumn === 'orgUnitPath' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-center">관리자</TableHead>
                    <TableHead className="text-center">정지</TableHead>
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
                        <TableCell className="text-fg-primary">{fullName}</TableCell>
                        <TableCell className="font-mono text-small text-fg-secondary">
                          {user.orgUnitPath || "/"}
                        </TableCell>
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
              {total === 0 ? '결과 없음' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="flex gap-2">
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
                disabled={(page + 1) * PAGE_SIZE >= total}
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

      <EditUserDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        user={editTarget}
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

      <BulkDeleteDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        emails={Array.from(selectedEmails)}
        onDone={() => setSelectedEmails(new Set())}
      />
    </div>
  );
}

