import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { useUsersList } from '../../api/usersList';
import { useGroupsList } from '../../api/groupsList';
import { useAuditLogSummary } from '../../api/auditLogSummary';
import { useAuditLogList } from '../../api/auditLogList';
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

  const summaryQuery = useAuditLogSummary({ atMin: todayStartMs });
  const todayCount = summaryQuery.data?.count ?? 0;
  const previewEntries = summaryQuery.data?.entries ?? [];

  const suspendedCount = users.data?.users?.filter((u) => u.isSuspended).length ?? 0;

  // v0.105 (b 갱신): role_split 감사 감시.
  // v0.100 getRole 은 Auth claim ≠ Firestore role 을 발견할 때만 users.read + error +
  // message = "role_split: ..." 을 기록한다 — 즉 아직 usersGetRole 이 호출된 적 없는
  // 계정은 감사에도 나타나지 않는다. Firestore 는 substring 필터를 지원 안 하므로
  // 서버 필터는 users.read + error 까지, message prefix 는 client 에서 걸러야 한다.
  //
  // 이 카드는 「전수 대조」 가 아니라 「최근 조회 sample 안에서의 감지」 이다. 따라서
  // sample size 를 표면에 노출하고, 결과 없음을 「동기 상태」 로 단정하지 않는다.
  const ROLE_SPLIT_SAMPLE_SIZE = 50;
  const roleSplitFeed = useAuditLogList(ROLE_SPLIT_SAMPLE_SIZE, {
    filterAction: 'users.read',
    filterResult: 'error',
  });
  const roleSplitEntries = useMemo(
    () =>
      roleSplitFeed.entries.filter((e) => (e.message ?? '').startsWith('role_split')),
    [roleSplitFeed.entries],
  );
  const roleSplitHasMore = roleSplitFeed.hasMore; // 다음 페이지에 더 있을 수 있음.

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
            value={summaryQuery.isError ? '—' : todayCount}
            loading={summaryQuery.isLoading}
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
                {summaryQuery.isLoading
                  ? '불러오는 중...'
                  : summaryQuery.isError
                  ? '오늘 이벤트를 불러오지 못했습니다.'
                  : todayCount > 0
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
          {summaryQuery.isLoading && (
            <div className="py-4 text-center text-small text-fg-secondary" data-testid="super-admin-preview-loading">
              불러오는 중...
            </div>
          )}
          {summaryQuery.isError && (
            <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="super-admin-preview-error">
              감사 로그를 불러오지 못했습니다: {summaryQuery.error?.message}
            </div>
          )}
          {!summaryQuery.isLoading && !summaryQuery.isError && previewEntries.length > 0 && (
            <ul className="space-y-2" data-testid="super-admin-recent-events">
              {previewEntries.slice(0, 5).map((e) => (
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

        {/* v0.105: role_split 경고 (Auth claim ≠ Firestore role) */}
        <section
          className="bg-elevated p-8 border border-border-subtle space-y-4"
          data-testid="super-admin-role-split-section"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle
                aria-hidden="true"
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  roleSplitEntries.length > 0 ? 'text-state-warning' : 'text-fg-muted'
                }`}
                strokeWidth={2}
              />
<div className="min-w-0">
                <h2 className="text-h2 font-semibold text-fg-primary">역할 불일치 감시</h2>
                <p className="text-small text-fg-secondary mt-1">
                  {roleSplitFeed.loading ? (
                    '불러오는 중...'
                  ) : roleSplitFeed.error ? (
                    '감시 데이터를 불러오지 못했습니다.'
                  ) : roleSplitEntries.length > 0 ? (
                    `최근 users.read/error 감사 이벤트 ${roleSplitFeed.entries.length}건 (샘플 최대 ${ROLE_SPLIT_SAMPLE_SIZE}) 중 role_split ${roleSplitEntries.length}건 감지. Auth 클레임과 Firestore role 이 다른 계정.`
                  ) : (
                    <>
                      최근 users.read/error 감사 이벤트 {roleSplitFeed.entries.length}건 (샘플 최대{' '}
                      {ROLE_SPLIT_SAMPLE_SIZE}) 중 role_split 감지 없음.{' '}
                      <strong className="font-semibold text-fg-primary">
                        전수 대조가 아니라 최근 조회 sample 안에서만
                      </strong>{' '}
                      — 조회된 적 없는 계정은 이 카드에서 확인되지 않는다.
                    </>
                  )}
                  {roleSplitHasMore && (
                    <span className="ml-1 text-fg-muted">
                      (더 이전 이벤트가 있음. 「전체 보기」 로 감사 페이지에서 pagination.)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              to="/super_admin/audit?action=users.read&result=error&q=role_split"
              className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors shrink-0"
              data-testid="super-admin-role-split-link"
            >
              전체 보기 →
            </Link>
          </div>
          {!roleSplitFeed.loading && !roleSplitFeed.error && roleSplitEntries.length > 0 && (
            <ul
              className="space-y-2 text-small"
              data-testid="super-admin-role-split-list"
            >
              {roleSplitEntries.slice(0, 3).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 p-2 -mx-2 hover:bg-surface transition-colors"
                  data-testid={`super-admin-role-split-item-${e.id}`}
                >
                  <span className="font-mono text-fg-secondary w-40 shrink-0">
                    {new Date(e.at).toLocaleString('ko-KR')}
                  </span>
                  <span className="font-mono text-fg-primary shrink-0">{e.target}</span>
                  <span className="text-fg-secondary">·</span>
                  <span className="text-state-warning font-mono truncate" title={e.message}>
                    {e.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 시스템 설정 shortcut */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h3 font-semibold text-fg-primary">시스템 설정</h2>
          <ul className="space-y-2 text-small">
            <li>
              <Link
                to="/super_admin/capabilities"
                className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary transition-colors"
                data-testid="super-admin-nav-capabilities"
              >
                역할·권한 매트릭스 →
              </Link>
              <span className="text-fg-secondary"> — 각 역할이 실행 가능한 서버 capability 를 표로 확인.</span>
            </li>
            <li className="text-fg-muted">
              역할 관리 UI · 기초값 · 배포 상태 (준비 중)
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

