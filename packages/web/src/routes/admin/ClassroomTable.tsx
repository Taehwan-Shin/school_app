import { useClassroomList } from '../../api/classroomList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

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
  const { data, isLoading, isError, error } = useClassroomList();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-small text-fg-secondary">
          {data?.courses ? `${data.courses.length}개 코스` : '코스 목록'}
        </p>
      </div>
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
                <TableHead>이름</TableHead>
                <TableHead>섹션</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">링크</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.courses.map((c) => (
                <TableRow key={c.id} data-testid={`classroom-row-${c.id}`}>
                  <TableCell className="text-fg-primary">
                    {c.name || <span className="text-fg-muted">(무제)</span>}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
