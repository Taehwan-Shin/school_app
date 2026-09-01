import { useSearchParams } from 'react-router-dom';
import { useUsersList } from '../../api/usersList';
import { KpiCard } from './KpiCard';

export function KpiCardRow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFilter = searchParams.get('filter');

  const handleCardClick = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (currentFilter === value) {
      next.delete('filter');
    } else {
      next.set('filter', value);
    }
    setSearchParams(next, { replace: false });
  };

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
      <KpiCard
        label="총 사용자"
        value={totalUsers}
        loading={isLoading}
        href={undefined}
      />
      <KpiCard
        label="관리자"
        value={adminUsers}
        loading={isLoading}
        href="admin"
        active={currentFilter === 'admin'}
        onClick={() => handleCardClick('admin')}
      />
      <KpiCard
        label="정지된 계정"
        value={suspendedUsers}
        loading={isLoading}
        href="suspended"
        active={currentFilter === 'suspended'}
        onClick={() => handleCardClick('suspended')}
      />
      <KpiCard
        label="일반 사용자"
        value={normalUsers}
        loading={isLoading}
        href="normal"
        active={currentFilter === 'normal'}
        onClick={() => handleCardClick('normal')}
      />
    </div>
  );
}
