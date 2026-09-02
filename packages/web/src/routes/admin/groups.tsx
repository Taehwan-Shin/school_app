import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { GroupKpiCardRow } from '../../components/dashboard/GroupKpiCardRow';
import { GroupsTable } from './GroupsTable';

export function GroupsPage() {
  const { role } = useAuth();
  return (
    <AppShell role={role} pageTitle="그룹">
      <div className="space-y-8">
        <GroupKpiCardRow />

        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 그룹 목록</h2>
          </div>
          <GroupsTable />
        </section>
      </div>
    </AppShell>
  );
}
