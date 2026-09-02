import { useGroupsList } from '../../api/groupsList';
import { KpiCard } from './KpiCard';

export function GroupKpiCardRow() {
  const { data, isLoading, isError } = useGroupsList();

  if (isError) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="총 그룹" value="—" loading={false} />
        <KpiCard label="멤버 있는 그룹" value="—" loading={false} />
        <KpiCard label="빈 그룹" value="—" loading={false} />
        <KpiCard label="평균 멤버 수" value="—" loading={false} />
      </div>
    );
  }

  const groups = data?.groups;
  const totalGroups = groups ? groups.length : 0;
  const withMembersGroups = groups
    ? groups.filter((g) => g.directMembersCount > 0).length
    : 0;
  const emptyGroups = groups
    ? groups.filter((g) => g.directMembersCount === 0).length
    : 0;
  const totalMembers = groups
    ? groups.reduce((sum, g) => sum + (g.directMembersCount || 0), 0)
    : 0;
  const averageMembers =
    totalGroups > 0 ? Math.round(totalMembers / totalGroups) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard
        label="총 그룹"
        value={totalGroups}
        loading={isLoading}
        href={undefined}
      />
      <KpiCard
        label="멤버 있는 그룹"
        value={withMembersGroups}
        loading={isLoading}
        href={undefined}
      />
      <KpiCard
        label="빈 그룹"
        value={emptyGroups}
        loading={isLoading}
        href={undefined}
      />
      <KpiCard
        label="평균 멤버 수"
        value={averageMembers}
        loading={isLoading}
        href={undefined}
      />
    </div>
  );
}
