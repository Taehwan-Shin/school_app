import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { GroupsTable } from './GroupsTable';

export function GroupsPage() {
  const { role } = useAuth();
  return (
    <AppShell role={role} pageTitle="그룹">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 그룹 목록</h2>
          </div>
          <GroupsTable />
        </section>

        <section className="bg-elevated p-8 border border-border-subtle space-y-2">
          <h2 className="text-h3 font-semibold text-fg-primary">그룹 관리 (준비 중)</h2>
          <p className="text-small text-fg-secondary">
            그룹 생성·편집·삭제·멤버 관리 자리 (다음 슬라이스).
          </p>
        </section>
      </div>
    </AppShell>
  );
}
