import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

  const courses = data?.courses ?? [];
  const eligibleIds = useMemo(
    () => new Set(courses.filter((c) => c.courseState === 'ACTIVE' || c.courseState === 'ARCHIVED').map((c) => c.id)),
    [courses],
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
    if (checked) setSelectedIds(new Set(eligibleIds));
    else setSelectedIds(new Set());
  };
  const bulkTargetCourses =
    bulkDirection === 'archive'
      ? selectedActive.map((c) => ({ id: c.id, name: c.name }))
      : bulkDirection === 'restore'
        ? selectedArchived.map((c) => ({ id: c.id, name: c.name }))
        : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-small text-fg-secondary">
          {data?.courses ? `${data.courses.length}개 코스` : '코스 목록'}
        </p>
        <div className="flex items-center gap-2">
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
      {data?.courses && data.courses.length > 0 && (
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
                      eligibleIds.size > 0 && selectedIds.size === eligibleIds.size
                    }
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          selectedIds.size > 0 && selectedIds.size < eligibleIds.size;
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={eligibleIds.size === 0}
                  />
                </TableHead>
                <TableHead>이름</TableHead>
                <TableHead>섹션</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">링크</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.courses.map((c) => {
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
