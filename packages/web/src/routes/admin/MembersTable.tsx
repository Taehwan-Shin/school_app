import { useState, useMemo } from 'react';
import { useGroupMembersList, type GroupMemberItem } from '../../api/groupsMembersList';
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
import { AddMemberDialog } from './AddMemberDialog';
import { RemoveMemberDialog } from './RemoveMemberDialog';
import { EditMemberRoleDialog } from './EditMemberRoleDialog';

export interface MembersTableProps {
  groupEmail: string;
}

export function MembersTable({ groupEmail }: MembersTableProps) {
  const { members, loading, error, hasMore, loadMore, reload } = useGroupMembersList(groupEmail);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GroupMemberItem | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<GroupMemberItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'MANAGER' | 'MEMBER'>('ALL');

  const filteredMembers = useMemo(() => {
    let result = members;
    if (roleFilter !== 'ALL') {
      result = result.filter((m) => m.role === roleFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((m) => m.email.toLowerCase().includes(q));
    }
    return result;
  }, [members, searchQuery, roleFilter]);

  return (
    <div className="space-y-4">
      {/* 상단 요약 + 액션 */}
      <div className="flex justify-between items-center gap-4">
        <p className="text-small text-fg-secondary">
          {filteredMembers.length !== members.length
            ? `${filteredMembers.length}명 표시됨 / 전체 ${members.length}명`
            : `${members.length}명 멤버`}
        </p>
        <Button onClick={() => setIsAddOpen(true)} data-testid="add-member-btn">
          + 멤버 추가
        </Button>
      </div>

      {/* 필터 로우 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="멤버 이메일 검색"
          aria-label="멤버 검색"
          data-testid="members-search-input"
          className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
        />
        <div className="flex items-center gap-2" role="group" aria-label="역할 필터">
          {(['ALL', 'OWNER', 'MANAGER', 'MEMBER'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              data-testid={`members-role-chip-${r}`}
              className={cn(
                'px-3 py-1 text-small border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
                roleFilter === r
                  ? 'bg-fg-primary text-canvas border-fg-primary'
                  : 'bg-canvas text-fg-primary border-border-subtle hover:border-border-strong',
              )}
            >
              {r === 'ALL' ? '전체' : r}
            </button>
          ))}
        </div>
      </div>

      {loading && members.length === 0 && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="members-loading">
          멤버 목록을 불러오는 중...
        </div>
      )}

      {error && (
        <div
          className="border border-state-danger p-4 text-small text-state-danger"
          data-testid="members-error"
        >
          {error.message?.includes('permission-denied') ||
          error.message?.includes('PERMISSION_DENIED') ||
          error.message?.includes('http_403')
            ? '멤버 목록을 조회할 권한이 없거나 스코프가 부족합니다.'
            : `멤버 목록을 불러오지 못했습니다: ${error.message || '알 수 없는 오류'}`}
        </div>
      )}

      {!loading && !error && members.length === 0 && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="members-empty">
          멤버가 없습니다.
        </div>
      )}

      {!loading && !error && members.length > 0 && filteredMembers.length === 0 && (
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="members-search-empty">
          검색·필터에 맞는 멤버가 없습니다.
        </div>
      )}

      {filteredMembers.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>타입</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.email} data-testid={`member-row-${member.email}`}>
                  <TableCell className="font-mono text-small text-fg-primary">
                    {member.email}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-micro',
                      member.role === 'OWNER'
                        ? 'font-medium text-fg-primary'
                        : 'text-fg-secondary'
                    )}
                  >
                    {member.role}
                  </TableCell>
                  <TableCell className="text-micro text-fg-secondary">
                    {member.type}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRoleEditTarget(member)}
                      data-testid={`edit-role-btn-${member.email}`}
                    >
                      역할 변경
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(member)}
                      data-testid={`remove-member-${member.email}`}
                      className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      제거
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore && (
        <div className="pt-2 text-center">
          <Button
            variant="secondary"
            onClick={loadMore}
            disabled={loading}
            data-testid="load-more-btn"
          >
            {loading ? '불러오는 중...' : '더 보기'}
          </Button>
        </div>
      )}

      <AddMemberDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        groupEmail={groupEmail}
        onSuccess={reload}
      />

      <RemoveMemberDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        groupEmail={groupEmail}
        member={removeTarget}
        onSuccess={reload}
      />

      {roleEditTarget && (
        <EditMemberRoleDialog
          open={Boolean(roleEditTarget)}
          onOpenChange={(open) => {
            if (!open) setRoleEditTarget(null);
          }}
          groupEmail={groupEmail}
          memberEmail={roleEditTarget.email}
          currentRole={roleEditTarget.role}
          onSuccess={reload}
        />
      )}
    </div>
  );
}
