import { Link } from 'react-router-dom';
import { useGroupsList } from '../../api/groupsList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export interface UserGroupsProps {
  userEmail: string;
}

export function UserGroups({ userEmail }: UserGroupsProps) {
  const { data, isLoading, isError, error } = useGroupsList(true, { userKey: userEmail });

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-groups-loading">
          소속 그룹을 불러오는 중...
        </div>
      )}
      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="user-groups-error">
          소속 그룹을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}
      {!isLoading && !isError && (!data?.groups || data.groups.length === 0) && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-groups-empty">
          이 사용자는 어떤 그룹에도 속하지 않습니다.
        </div>
      )}
      {data?.groups && data.groups.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>설명</TableHead>
                <TableHead className="text-right">멤버 수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.groups.map((g) => (
                <TableRow key={g.email} data-testid={`user-group-row-${g.email}`}>
                  <TableCell className="font-mono text-small">
                    <Link
                      to={`/admin/groups/${encodeURIComponent(g.email)}`}
                      className="text-fg-primary hover:underline"
                    >
                      {g.email}
                    </Link>
                  </TableCell>
                  <TableCell className="text-fg-primary">{g.name}</TableCell>
                  <TableCell className="text-small text-fg-secondary max-w-xs truncate" title={g.description}>
                    {g.description || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-small text-fg-primary">
                    {g.directMembersCount}
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
