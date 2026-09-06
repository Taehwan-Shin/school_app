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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
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
