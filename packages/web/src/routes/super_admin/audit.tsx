import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { AuditLogTable } from './AuditLogTable';

export function AuditLogPage() {
  const { role } = useAuth();
  return (
    <AppShell role={role} pageTitle="감사 로그">
      <div className="space-y-6">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">감사 로그</h2>
            <p className="text-small text-fg-secondary mt-1">
              시스템 내 발생한 모든 관리자 행위의 감사 기록입니다. 최근 항목부터 표시됩니다.
            </p>
          </div>
          <AuditLogTable />
        </section>
      </div>
    </AppShell>
  );
}
