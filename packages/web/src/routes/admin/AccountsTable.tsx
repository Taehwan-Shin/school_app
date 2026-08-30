import { useUsersList } from '../../api/usersList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export function AccountsTable() {
  const { data, isLoading, isError, error } = useUsersList();

  if (isLoading) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm" data-testid="accounts-loading">
        계정 목록을 불러오는 중...
      </div>
    );
  }

  if (isError) {
    const isPermissionDenied =
      error?.message?.includes('permission-denied') ||
      error?.message?.includes('PERMISSION_DENIED') ||
      error?.message?.includes('failed-precondition') ||
      error?.message?.includes('http_403');

    return (
      <div
        className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
        data-testid="accounts-error"
      >
        {isPermissionDenied
          ? '이 기능은 관리자만 사용할 수 있습니다.'
          : `계정 목록을 불러오지 못했습니다: ${error?.message || '알 수 없는 오류'}`}
      </div>
    );
  }

  const users = data?.users ?? [];

  if (users.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm" data-testid="accounts-empty">
        계정이 없습니다.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="font-semibold text-slate-700">Email</TableHead>
            <TableHead className="font-semibold text-slate-700">이름</TableHead>
            <TableHead className="font-semibold text-slate-700">조직 단위</TableHead>
            <TableHead className="font-semibold text-slate-700 text-center">관리자</TableHead>
            <TableHead className="font-semibold text-slate-700 text-center">정지</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const fullName = `${user.lastName}${user.firstName}`.trim() || '-';
            return (
              <TableRow key={user.email}>
                <TableCell className="font-medium text-slate-900">{user.email}</TableCell>
                <TableCell className="text-slate-700">{fullName}</TableCell>
                <TableCell className="text-slate-600 font-mono text-xs">
                  {user.orgUnitPath || '/'}
                </TableCell>
                <TableCell className="text-center">
                  {user.isAdmin ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      관리자
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      일반
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {user.isSuspended ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      정지됨
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      정상
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
