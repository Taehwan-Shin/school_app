import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { AccountsTable } from './AccountsTable';

export function AdminPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="관리자">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 계정 목록</h2>
          </div>
          <AccountsTable />
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-elevated p-8 border border-border-subtle space-y-2">
            <h2 className="text-h3 font-semibold text-fg-primary">계정·그룹·챗·클래스룸 대시보드</h2>
            <p className="text-small text-fg-secondary">
              계정·그룹·챗·클래스룸 대시보드 자리 (일괄 생성, 변경, 삭제, 배정)
            </p>
          </section>

          <section className="bg-elevated p-8 border border-border-subtle space-y-2">
            <h2 className="text-h3 font-semibold text-fg-primary">기초값 관리</h2>
            <p className="text-small text-fg-secondary">
              기초값 관리 자리 (학년·반·부서 구조 정의 및 시트 동기화)
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
