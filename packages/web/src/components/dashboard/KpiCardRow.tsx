import { useUsersList } from '../../api/usersList';
import { KpiCard } from './KpiCard';

export function KpiCardRow() {
  const { data, isLoading, isError } = useUsersList();

  if (isError) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="총 사용자" value="—" loading={false} />
        <KpiCard label="관리자" value="—" loading={false} />
        <KpiCard label="정지된 계정" value="—" loading={false} />
        <KpiCard label="일반 사용자" value="—" loading={false} />
      </div>
    );
  }

  const users = data?.users;
  const totalUsers = users ? users.length : 0;
  const adminUsers = users ? users.filter((u) => u.isAdmin).length : 0;
  const suspendedUsers = users ? users.filter((u) => u.isSuspended).length : 0;
  const normalUsers = users
    ? users.filter((u) => !u.isAdmin && !u.isSuspended).length
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard label="총 사용자" value={totalUsers} loading={isLoading} />
      <KpiCard label="관리자" value={adminUsers} loading={isLoading} />
      <KpiCard label="정지된 계정" value={suspendedUsers} loading={isLoading} />
      <KpiCard label="일반 사용자" value={normalUsers} loading={isLoading} />
    </div>
  );
}
