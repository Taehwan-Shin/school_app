import { useGroupsList, type GroupItem } from '../../api/groupsList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export function GroupsTable() {
  const { data, isLoading, isError, error } = useGroupsList();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <p className="text-small text-fg-secondary">
          조직 내 등록된 Google Workspace 그룹 및 멤버 현황
        </p>
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
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>별칭</TableHead>
                <TableHead className="text-right">멤버 수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.groups.map((group: GroupItem) => {
                const aliasText =
                  group.aliases && group.aliases.length > 0 ? group.aliases.join(', ') : '-';

                return (
                  <TableRow key={group.email} data-testid={`group-row-${group.email}`}>
                    <TableCell className="font-mono text-small text-fg-primary">
                      {group.email}
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
