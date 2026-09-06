import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
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

export interface CourseMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  courseName?: string;
}

export function CourseMembersDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
}: CourseMembersDialogProps) {
  const [tab, setTab] = useState<'teachers' | 'students'>('teachers');
  const [addEmail, setAddEmail] = useState('');
  const addMutation = useClassroomTeachersAdd();
  const deleteMutation = useClassroomTeachersDelete();

  const handleAddTeacher = async () => {
    if (!courseId || !addEmail.trim()) return;
    try {
      await addMutation.mutateAsync({ courseId, userId: addEmail.trim() });
      setAddEmail('');
    } catch {
      // 에러는 addMutation.error 로 렌더
    }
  };

  const handleDeleteTeacher = async (userId: string) => {
    if (!courseId) return;
    try {
      await deleteMutation.mutateAsync({ courseId, userId });
    } catch {
      // 에러는 deleteMutation.error 로 렌더 (삭제는 alert 대신 hook error 사용)
    }
  };

  const teachersQuery = useClassroomTeachersList(courseId, open);
  const studentsQuery = useClassroomStudentsList(courseId, open);

  const currentQuery = tab === 'teachers' ? teachersQuery : studentsQuery;
  const showLoading = !courseId || currentQuery.isLoading;
  const isError = !showLoading && currentQuery.isError;
  const error = currentQuery.error;

  const items: (ClassroomTeacher | ClassroomStudent)[] =
    tab === 'teachers'
      ? (teachersQuery.data?.teachers ?? [])
      : (studentsQuery.data?.students ?? []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{courseName || courseId} 멤버</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{courseId}</span> 코스의 교사 및 학생 명단.
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border-subtle mb-4">
          <button
            type="button"
            onClick={() => setTab('teachers')}
            data-testid="course-members-tab-teachers"
            className={`px-4 py-2 text-small font-medium border-b-2 cursor-pointer transition-colors ${
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
            data-testid="course-members-tab-students"
            className={`px-4 py-2 text-small font-medium border-b-2 cursor-pointer transition-colors ${
              tab === 'students'
                ? 'border-fg-primary text-fg-primary'
                : 'border-transparent text-fg-secondary hover:text-fg-primary'
            }`}
          >
            학생
          </button>
        </div>

        {tab === 'teachers' && courseId && (
          <div className="flex items-end gap-2 mb-4" data-testid="course-members-add-form">
            <div className="flex-1">
              <label className="text-small text-fg-secondary mb-1 block">이메일 추가</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@cam.hs.kr"
                data-testid="course-members-add-email"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
            </div>
            <Button
              onClick={handleAddTeacher}
              disabled={!addEmail.trim() || addMutation.isPending}
              data-testid="course-members-add-btn"
            >
              {addMutation.isPending ? '추가 중...' : '추가'}
            </Button>
          </div>
        )}
        {addMutation.error && (
          <div className="border border-state-danger p-2 text-small text-state-danger mb-4" data-testid="course-members-add-error">
            추가 실패: {addMutation.error.message}
          </div>
        )}
        {deleteMutation.error && (
          <div className="border border-state-danger p-2 text-small text-state-danger mb-4" data-testid="course-members-delete-error">
            삭제 실패: {deleteMutation.error.message}
          </div>
        )}

        {showLoading && (
          <div
            className="py-8 text-center text-small text-fg-secondary"
            data-testid="course-members-loading"
          >
            로딩 중...
          </div>
        )}

        {isError && (
          <div
            className="border border-state-danger p-4 text-small text-state-danger"
            data-testid="course-members-error"
          >
            오류: {error?.message || '알 수 없는 오류'}
          </div>
        )}

        {!showLoading && !isError && currentQuery.data && (
          <div
            className="max-h-96 overflow-y-auto border border-border-subtle"
            data-testid="course-members-scroll-container"
          >
            <Table>
              <TableHeader className="sticky top-0 bg-canvas">
                <TableRow>
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
                      colSpan={4}
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
                        {tab === 'teachers' ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(m.userId)}
                            disabled={deleteMutation.isPending && deleteMutation.variables?.userId === m.userId}
                            data-testid={`course-member-delete-btn-${m.userId}`}
                            className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                          >
                            삭제
                          </button>
                        ) : (
                          <span className="text-fg-muted text-small">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
