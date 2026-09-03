import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

type SortColumn = 'email' | 'name' | 'directMembersCount' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 25;

export function GroupsTable() {
  const { data, isLoading, isError, error } = useGroupsList();
  const [searchParams, setSearchParams] = useSearchParams();
  const kpiFilter = searchParams.get('filter');
  const searchQuery = searchParams.get('q') ?? '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditGroupTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);
  const sortColumn: SortColumn = (() => {
    const raw = searchParams.get('sort');
    return raw === 'email' || raw === 'name' || raw === 'directMembersCount' ? raw : null;
  })();
  const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, kpiFilter, sortColumn, sortDirection]);

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

    // KPI 필터 먼저
    if (kpiFilter === 'with-members') {
      result = result.filter((g: GroupItem) => (g.directMembersCount ?? 0) > 0);
    } else if (kpiFilter === 'empty') {
      result = result.filter((g: GroupItem) => (g.directMembersCount ?? 0) === 0);
    } else if (kpiFilter) {
      result = [];
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
  const paginatedGroups = sortedFilteredGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  return (
    <div className="space-y-4">
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
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            data-testid="groups-export-csv-btn"
            disabled={sortedFilteredGroups.length === 0}
          >
            CSV 내보내기
          </Button>
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

      {isError && (
        <div
          className="border border-state-danger p-4 text-small text-state-danger"
          data-testid="groups-error"
        >
          {error?.message?.includes('permission-denied') ||
          error?.message?.includes('PERMISSION_DENIED') ||
          error?.message?.includes('failed-precondition') ||
          error?.message?.includes('http_403')
            ? '이 기능은 관리자만 사용할 수 있습니다.'
            : `그룹 목록을 불러오지 못했습니다: ${error?.message || '알 수 없는 오류'}`}
        </div>
      )}

      {!isLoading && !isError && (!data?.groups || data.groups.length === 0) && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="groups-empty">
          등록된 그룹이 없습니다.
        </div>
      )}

      {!isLoading && !isError && data?.groups && data.groups.length > 0 && (
        <>
          {sortedFilteredGroups.length === 0 ? (
            <div className="py-12 text-center text-small text-fg-secondary" data-testid="groups-search-empty">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      onClick={() => handleSort('email')}
                      className="cursor-pointer select-none"
                      data-testid="groups-sort-email"
                      aria-sort={sortColumn === 'email' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      이메일 {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort('name')}
                      className="cursor-pointer select-none"
                      data-testid="groups-sort-name"
                      aria-sort={sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      이름 {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>별칭</TableHead>
                    <TableHead
                      onClick={() => handleSort('directMembersCount')}
                      className="text-right cursor-pointer select-none"
                      data-testid="groups-sort-directMembersCount"
                      aria-sort={sortColumn === 'directMembersCount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      멤버 수 {sortColumn === 'directMembersCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGroups.map((group: GroupItem) => {
                const aliasText =
                  group.aliases && group.aliases.length > 0 ? group.aliases.join(', ') : '-';

                return (
                  <TableRow key={group.email} data-testid={`group-row-${group.email}`}>
                    <TableCell className="font-mono text-small text-fg-primary">
                      <Link
                        to={`/admin/groups/${encodeURIComponent(group.email)}`}
                        className="text-fg-primary hover:underline"
                      >
                        {group.email}
                      </Link>
                    </TableCell>
                    <TableCell className="text-fg-primary">
                      {group.name || '-'}
                    </TableCell>
                    <TableCell
                      className="text-small text-fg-secondary truncate max-w-xs"
                      title={group.description || ''}
                    >
                      {group.description || '-'}
                    </TableCell>
                    <TableCell className="text-small font-mono text-fg-secondary">
                      {aliasText}
                    </TableCell>
                    <TableCell className="text-right font-mono text-small text-fg-primary">
                      {group.directMembersCount}
                    </TableCell>
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
              {total === 0 ? '결과 없음' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="flex gap-2">
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
                disabled={(page + 1) * PAGE_SIZE >= total}
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
    </div>
  );
}
