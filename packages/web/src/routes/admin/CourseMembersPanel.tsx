import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/Banner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  useClassroomTeachersList,
  type ClassroomTeacher,
} from '../../api/classroomTeachersList';
import {
  useClassroomStudentsList,
  type ClassroomStudent,
} from '../../api/classroomStudentsList';
import { useClassroomTeachersAdd } from '../../api/classroomTeachersAdd';
import { useClassroomTeachersDelete } from '../../api/classroomTeachersDelete';
import { useClassroomStudentsAdd } from '../../api/classroomStudentsAdd';
import { useClassroomStudentsDelete } from '../../api/classroomStudentsDelete';
import { ClassroomBulkInviteDialog } from './ClassroomBulkInviteDialog';

export interface CourseMembersPanelProps {
  courseId: string | null;
  courseName?: string;
  active?: boolean;
  onPendingChange?: (pending: boolean) => void;
}

export function CourseMembersPanel({
  courseId,
  courseName,
  active = true,
  onPendingChange,
}: CourseMembersPanelProps) {
  const [tab, setTab] = useState<'teachers' | 'students'>('teachers');
  const [addEmail, setAddEmail] = useState('');
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  // v0.156: 명단 선택 상태 (userId 기반). 선택 있으면 「선택 export」, 없으면
  // 기존 대로 전체 export.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const addTeacherMutation = useClassroomTeachersAdd();
  const deleteTeacherMutation = useClassroomTeachersDelete();
  const addStudentMutation = useClassroomStudentsAdd();
  const deleteStudentMutation = useClassroomStudentsDelete();

  const currentAdd = tab === 'teachers' ? addTeacherMutation : addStudentMutation;
  const currentDelete = tab === 'teachers' ? deleteTeacherMutation : deleteStudentMutation;

  const anyPending =
    addTeacherMutation.isPending ||
    deleteTeacherMutation.isPending ||
    addStudentMutation.isPending ||
    deleteStudentMutation.isPending;

  useEffect(() => {
    onPendingChange?.(anyPending);
  }, [anyPending, onPendingChange]);

  useEffect(() => {
    if (active && courseId) {
      setAddEmail('');
      setDeleteConfirmUserId(null);
      setTab('teachers');
      setBulkInviteOpen(false);
      addTeacherMutation.reset?.();
      deleteTeacherMutation.reset?.();
      addStudentMutation.reset?.();
      deleteStudentMutation.reset?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, courseId]);

  useEffect(() => {
    setDeleteConfirmUserId(null);
    // v0.156: 탭 (teachers ↔ students) 전환 시 선택 리셋 (다른 명단이므로 재선택).
    setSelectedIds(new Set());
  }, [tab]);

  const handleAdd = async () => {
    if (!courseId || !addEmail.trim()) return;
    try {
      await currentAdd.mutateAsync({ courseId, userId: addEmail.trim() });
      setAddEmail('');
    } catch {
      // 에러는 currentAdd.error 로 렌더
    }
  };

  const handleDelete = async (userId: string) => {
    if (!courseId) return;
    try {
      await currentDelete.mutateAsync({ courseId, userId });
      setDeleteConfirmUserId(null);
    } catch {
      // 에러는 currentDelete.error 로 렌더 (state 는 유지 · 사용자가 취소하거나 재시도 결정)
    }
  };

  const teachersQuery = useClassroomTeachersList(courseId, active);
  const studentsQuery = useClassroomStudentsList(courseId, active);

  const currentQuery = tab === 'teachers' ? teachersQuery : studentsQuery;
  const showLoading = !courseId || currentQuery.isLoading;
  const isError = !showLoading && currentQuery.isError;
  const error = currentQuery.error;

  const items: (ClassroomTeacher | ClassroomStudent)[] =
    tab === 'teachers'
      ? (teachersQuery.data?.teachers ?? [])
      : (studentsQuery.data?.students ?? []);

  return (
    <div>
      <div className="flex border-b border-border-subtle mb-4">
        <button
          type="button"
          onClick={() => setTab('teachers')}
          disabled={anyPending}
          data-testid="course-members-tab-teachers"
          className={`px-4 py-2 text-small font-medium border-b-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            tab === 'teachers'
              ? 'border-fg-primary text-fg-primary'
              : 'border-transparent text-fg-secondary hover:text-fg-primary'
          }`}
        >
          교사
        </button>
        <button
          type="button"
          onClick={() => setTab('students')}
          disabled={anyPending}
          data-testid="course-members-tab-students"
          className={`px-4 py-2 text-small font-medium border-b-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            tab === 'students'
              ? 'border-fg-primary text-fg-primary'
              : 'border-transparent text-fg-secondary hover:text-fg-primary'
          }`}
        >
          학생
        </button>
      </div>

      {courseId && (
        <div className="flex items-end gap-2 mb-4" data-testid="course-members-add-form">
          <div className="flex-1">
            <label
              htmlFor="course-members-add-email-input"
              className="text-small text-fg-secondary mb-1 block"
            >
              이메일 추가
            </label>
            <input
              id="course-members-add-email-input"
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="user@cam.hs.kr"
              disabled={anyPending}
              data-testid="course-members-add-email"
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={!addEmail.trim() || anyPending}
            data-testid="course-members-add-btn"
          >
            {currentAdd.isPending ? '추가 중...' : '추가'}
          </Button>
        </div>
      )}
      {/* v0.234: Banner 이식 · 원래 mb-4 유지. */}
      <div className={currentAdd.error ? 'mb-4' : ''}>
        <Banner
          variant="error"
          message={currentAdd.error ? `추가 실패: ${currentAdd.error.message}` : null}
          testId="course-members-add-error"
        />
      </div>
      <div className={currentDelete.error ? 'mb-4' : ''}>
        <Banner
          variant="error"
          message={currentDelete.error ? `삭제 실패: ${currentDelete.error.message}` : null}
          testId="course-members-delete-error"
        />
      </div>

      {showLoading && (
        <div
          className="py-8 text-center text-small text-fg-secondary"
          data-testid="course-members-loading"
        >
          로딩 중...
        </div>
      )}

      {/* v0.235: Banner 이식. */}
      <Banner
        variant="error"
        message={isError ? `오류: ${error?.message || '알 수 없는 오류'}` : null}
        testId="course-members-error"
      />

      {!showLoading && !isError && currentQuery.data && (
        <>
          {courseId && (
            <div className="flex justify-end gap-2 mb-2">
              {/* v0.148/v0.156: 현재 탭 명단 CSV 내보내기 (원본 「명단 확인」).
                  v0.156: 개별 체크박스 선택 있으면 그 항목만 export ·
                  파일명 접미사 -selected. AccountsTable v0.155 대칭. */}
              <Button
                variant="secondary"
                onClick={() => {
                  const exportItems =
                    selectedIds.size > 0
                      ? items.filter((m) => selectedIds.has(m.userId))
                      : items;
                  const isSelected = selectedIds.size > 0;
                  const header = ['이름', '이메일', 'userId'];
                  const rows = exportItems.map((m) => [
                    m.profile?.name?.fullName || '',
                    m.profile?.emailAddress || '',
                    m.userId,
                  ]);
                  const csv = [header, ...rows]
                    .map((row) =>
                      row
                        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                        .join(','),
                    )
                    .join('\n');
                  const blob = new Blob(['﻿' + csv], {
                    type: 'text/csv;charset=utf-8;',
                  });
                  const url = URL.createObjectURL(blob);
                  const safeName = (courseName || courseId).replace(/[\\/:*?"<>|]/g, '_');
                  const today = new Date().toISOString().split('T')[0];
                  const scopeSuffix = isSelected ? '-selected' : '';
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${safeName}-${tab === 'teachers' ? '교사' : '학생'}${scopeSuffix}-${today}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                disabled={
                  (selectedIds.size === 0 && items.length === 0) || anyPending
                }
                data-testid="course-members-export-csv-btn"
                title={
                  items.length === 0
                    ? '내보낼 명단이 없습니다.'
                    : selectedIds.size > 0
                      ? `선택 ${selectedIds.size}명 CSV 내보내기`
                      : `${items.length}명 CSV 내보내기`
                }
              >
                CSV 내보내기{' '}
                {selectedIds.size > 0
                  ? `(선택 ${selectedIds.size})`
                  : `(${items.length})`}
              </Button>
              {tab === 'students' && (
                <Button
                  variant="secondary"
                  onClick={() => setBulkInviteOpen(true)}
                  disabled={anyPending}
                  data-testid="course-members-bulk-invite-btn"
                >
                  학급 일괄 초대
                </Button>
              )}
            </div>
          )}
          <div
            className="max-h-96 overflow-y-auto border border-border-subtle"
            data-testid="course-members-scroll-container"
          >
            <Table aria-label="클래스룸 구성원">
              <TableHeader className="sticky top-0 bg-canvas">
                <TableRow>
                  {/* v0.156: 선택 checkbox column. header 는 「전체 선택」 (현재 items). */}
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      aria-label="전체 선택"
                      data-testid="course-members-select-all"
                      checked={
                        items.length > 0 &&
                        items.every((m) => selectedIds.has(m.userId))
                      }
                      ref={(el) => {
                        if (el) {
                          const any = items.some((m) => selectedIds.has(m.userId));
                          const all =
                            items.length > 0 &&
                            items.every((m) => selectedIds.has(m.userId));
                          el.indeterminate = any && !all;
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(items.map((m) => m.userId)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      disabled={items.length === 0}
                    />
                  </TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>userId</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-small text-fg-muted py-6"
                    >
                      {tab === 'teachers' ? '교사가 없습니다.' : '학생이 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((m) => (
                    <TableRow
                      key={m.userId}
                      data-testid={`course-member-row-${m.userId}`}
                    >
                      <TableCell className="w-8">
                        <input
                          type="checkbox"
                          aria-label={`${m.profile?.name?.fullName || m.userId} 선택`}
                          data-testid={`course-member-select-${m.userId}`}
                          checked={selectedIds.has(m.userId)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(m.userId);
                              else next.delete(m.userId);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-small text-fg-primary">
                        {m.profile?.name?.fullName || m.userId}
                      </TableCell>
                      <TableCell className="text-small text-fg-secondary">
                        {m.profile?.emailAddress || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-small text-fg-secondary">
                        {m.userId}
                      </TableCell>
                      <TableCell className="text-right">
                        {deleteConfirmUserId === m.userId ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleDelete(m.userId)}
                              disabled={currentDelete.isPending}
                              data-testid={`course-member-confirm-delete-btn-${m.userId}`}
                              className="text-state-danger font-semibold underline text-small cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {currentDelete.isPending ? '삭제 중...' : '정말 삭제?'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmUserId(null)}
                              disabled={currentDelete.isPending}
                              data-testid={`course-member-cancel-delete-btn-${m.userId}`}
                              className="text-fg-secondary underline text-small cursor-pointer disabled:opacity-40"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmUserId(m.userId)}
                            disabled={currentDelete.isPending || anyPending}
                            data-testid={`course-member-delete-btn-${m.userId}`}
                            className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                          >
                            삭제
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {courseId && (
        <ClassroomBulkInviteDialog
          open={bulkInviteOpen}
          onOpenChange={setBulkInviteOpen}
          courseId={courseId}
          courseName={courseName}
        />
      )}
    </div>
  );
}
