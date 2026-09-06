import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { useUsersList } from '../../api/usersList';
import { useGroupsList } from '../../api/groupsList';
import { useAuditLogList } from '../../api/auditLogList';
import { useAuditLogCount } from '../../api/auditLogCount';
import { useNavigate, Link } from 'react-router-dom';

export function SuperAdminPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const users = useUsersList();
  const groups = useGroupsList();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const yyyy = todayStart.getFullYear();
  const mm = String(todayStart.getMonth() + 1).padStart(2, '0');
  const dd = String(todayStart.getDate()).padStart(2, '0');
  const todayIso = `${yyyy}-${mm}-${dd}`;

  const todayCountQuery = useAuditLogCount({ atMin: todayStartMs });
  const todayCount = todayCountQuery.data?.count ?? 0;

  // preview 는 최근 5개 → list hook (limit 5) 유지
  const todayAudit = useAuditLogList(5, { atMin: todayStartMs });

  const suspendedCount = users.data?.users?.filter((u) => u.isSuspended).length ?? 0;

  return (
    <AppShell role={role} pageTitle="슈퍼 관리자">
      <div className="space-y-8">
        {/* KPI 로우 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="총 사용자"
            value={users.data?.users?.length ?? 0}
            loading={users.isLoading}
            href="nav"
            onClick={() => navigate('/admin')}
          />
          <KpiCard
            label="총 그룹"
            value={groups.data?.groups?.length ?? 0}
            loading={groups.isLoading}
            href="nav"
            onClick={() => navigate('/admin/groups')}
          />
          <KpiCard
            label="정지된 계정"
            value={suspendedCount}
            loading={users.isLoading}
            href="nav"
            onClick={() => navigate('/admin?filter=suspended')}
          />
          <KpiCard
            label="오늘 이벤트"
            value={todayCountQuery.isError ? '—' : todayCount}
            loading={todayCountQuery.isLoading}
            href="nav"
            onClick={() => navigate(`/super_admin/audit?atMin=${todayIso}`)}
          />
        </div>

        {/* 감사 로그 shortcut */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-h2 font-semibold text-fg-primary">오늘 감사 이벤트</h2>
              <p className="text-small text-fg-secondary mt-1">
                {todayCount > 0
                  ? `오늘 ${todayCount}건의 이벤트가 기록되었습니다.`
                  : '오늘 이벤트가 없습니다.'}
              </p>
            </div>
            <Link
              to="/super_admin/audit"
              className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors"
            >
              감사 로그 전체 보기 →
            </Link>
          </div>
          {/* 최근 5 개 이벤트만 미리보기 */}
          {todayAudit.loading && (
            <div className="py-4 text-center text-small text-fg-secondary" data-testid="super-admin-preview-loading">
              미리보기 불러오는 중...
            </div>
          )}
          {todayAudit.error && !todayAudit.loading && (
            <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="super-admin-preview-error">
              미리보기를 불러오지 못했습니다: {todayAudit.error.message}
            </div>
          )}
          {!todayAudit.loading && !todayAudit.error && todayAudit.entries.length > 0 && (
            <ul className="space-y-2" data-testid="super-admin-recent-events">
              {todayAudit.entries.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/super_admin/audit?actor=${encodeURIComponent(e.actor)}`}
                    className="flex items-center gap-3 text-small hover:bg-surface p-2 -mx-2 transition-colors"
                    data-testid={`super-admin-recent-event-${e.id}`}
                  >
                    <span className="font-mono text-fg-secondary w-40 shrink-0">
                      {new Date(e.at).toLocaleString('ko-KR')}
                    </span>
                    <span className="font-mono text-fg-primary">{e.action}</span>
                    <span className="text-fg-secondary">·</span>
                    <span className="font-mono text-fg-primary">{e.actor}</span>
                    <span className="text-fg-secondary">·</span>
                    <span
                      className={
                        e.result === 'ok'
                          ? 'text-fg-primary'
                          : e.result === 'error'
                          ? 'text-state-danger'
                          : 'text-state-warning'
                      }
                    >
                      {e.result}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 시스템 설정 shortcut */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-2">
          <h2 className="text-h3 font-semibold text-fg-primary">시스템 설정 (준비 중)</h2>
          <p className="text-small text-fg-secondary">
            역할 관리 · 캡 매트릭스 · 기초값 · 배포 상태 등. 다음 슬라이스에서 붙습니다.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

