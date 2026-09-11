import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { useUsersList } from '../../api/usersList';
import { useGroupsList } from '../../api/groupsList';
import { useAuditLogSummary } from '../../api/auditLogSummary';
import { useAuditLogUnresolvedRoleSplits } from '../../api/auditLogUnresolvedRoleSplits';
import { useUsersResolveRoleSplit } from '../../api/usersResolveRoleSplit';
import { useUsersRecheckRoleSplit } from '../../api/usersRecheckRoleSplit';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
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

  // v0.122: 액션별 breakdown 위젯의 window 를 사용자 선택 (오늘 / 이번 주 / 이번 달).
  // 「오늘 이벤트」 KpiCard 와 「오늘 감사 이벤트」 preview 는 항상 today 지표로
  // 유지 (headline metric 안정성). breakdown 만 별도 query 로 전환.
  type BreakdownWindow = 'today' | 'week' | 'month';
  const [breakdownWindow, setBreakdownWindow] = useState<BreakdownWindow>('today');

  // 주 시작 = 이번 주 월요일 00:00 (ISO 8601). Sunday=0 이라 (day+6)%7 로 월요일 offset.
  const weekStart = new Date(todayStart);
  const dayOfWeek = weekStart.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  const weekStartMs = weekStart.getTime();
  const weekIso = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

  // 월 시작 = 이번 달 1일 00:00.
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1, 0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();
  const monthIso = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;

  const breakdownAtMin =
    breakdownWindow === 'today'
      ? todayStartMs
      : breakdownWindow === 'week'
        ? weekStartMs
        : monthStartMs;
  const breakdownAtIso =
    breakdownWindow === 'today' ? todayIso : breakdownWindow === 'week' ? weekIso : monthIso;
  const breakdownLabel =
    breakdownWindow === 'today' ? '오늘' : breakdownWindow === 'week' ? '이번 주' : '이번 달';

  // v0.126: exact aggregation toggle. 기본 false — sampleTruncated=true 상황
  // 에서 사용자가 「정확 카운트」 버튼 눌러야 서버 count() 28 aggregation.
  // v0.126b F104: window 를 바꿀 때는 setBreakdownWindow 를 직접 호출하지 않고
  // handleWindowChange 를 통해 exact=false 와 함께 원자적 (같은 event handler
  // 안, React batched update) 으로 갱신 — 새 window 로 exact=true 요청이
  // 발화하는 중간 상태 방지.
  const [exactAggregation, setExactAggregation] = useState(false);
  const handleWindowChange = (w: BreakdownWindow) => {
    setExactAggregation(false);
    setBreakdownWindow(w);
  };

  // window=today 인 경우 상단 summaryQuery 를 재사용해 network 절약 (React Query
  // 는 같은 queryKey 를 공유). 다른 window 는 별도 query.
  const breakdownSummaryQuery = useAuditLogSummary({
    atMin: breakdownAtMin,
    exact: exactAggregation,
  });

  const suspendedCount = users.data?.users?.filter((u) => u.isSuspended).length ?? 0;

  // v0.106: role_split 감사 감시 — server 필터로 전환.
  // v0.100 getRole 은 Auth claim ≠ Firestore role 을 발견할 때 감사를 기록한다. v0.106 부터
  // 전용 action `system.role_split_detected` 로 기록해서 server 필터 하나로 정확히 셀 수 있다
  // (이전엔 users.read/error 로 기록되어 client 에서 message prefix 로 걸러야 했음).
  //
  // 남은 제약 — getRole 은 EditUserRoleDialog 열 때만 호출되므로, 아직 조회된 적 없는
  // 계정은 이 카드에서 감지되지 않는다. 이는 sample-scope (표시 최대 N건) 와 다른, 트리거
  // 범위의 제약이다. hasMore 는 감지된 splits 자체가 N건을 초과할 때만 나타난다.
  // v0.107c F44: 서버 aggregation callable 로 target 별 최신 상태 집계 (result=ok resolved 만
  // 인정 · 두 feed pagination 결함 소거). client 는 자체 reconcile 하지 않고 결과만 렌더.
  const unresolvedQuery = useAuditLogUnresolvedRoleSplits({ scanLimit: 500 });
  const roleSplitEntries = unresolvedQuery.data?.entries ?? [];
  // hasMore 는 서버가 detected/resolved 두 window 중 하나라도 초과했다고 알린 경우.
  const scanIncomplete =
    (unresolvedQuery.data?.detectedHasMore ?? false) ||
    (unresolvedQuery.data?.resolvedHasMore ?? false);
  const qc = useQueryClient();
  // reload 헬퍼: 서버 aggregation query 무효화 → refetch.
  const reloadUnresolved = () =>
    qc.invalidateQueries({ queryKey: ['audit', 'unresolvedRoleSplits'] });

  // v0.107: 감지된 split 을 super_admin 이 한 클릭으로 Firestore = Auth 로 동기화.
  // v0.107b F42: message 에서 auth/firestore 기대치 파싱 → CAS 로 서버가 stale write 방지.
  // v0.107f F51: auth=unknown row 는 recheck mutation 으로 대체 (parsable role 로 재기록).
  const resolveMutation = useUsersResolveRoleSplit();
  const recheckMutation = useUsersRecheckRoleSplit();
  const [resolvingUid, setResolvingUid] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const parseSplitMessage = (
    message: string | undefined,
  ): { auth: 'super_admin' | 'admin' | 'teacher' | 'null'; firestore: 'super_admin' | 'admin' | 'teacher' | 'null' } | null => {
    if (!message) return null;
    const m = message.match(/role_split:\s*auth=(\S+)\s+firestore=(\S+)/);
    if (!m) return null;
    const valid = (v: string): v is 'super_admin' | 'admin' | 'teacher' | 'null' =>
      v === 'super_admin' || v === 'admin' || v === 'teacher' || v === 'null';
    if (!valid(m[1]) || !valid(m[2])) return null;
    return { auth: m[1], firestore: m[2] };
  };

  // v0.107f F51: message 에 unknown 마커 (auth=unknown 또는 firestore=unknown) 있으면
  // recheck 흐름으로 분기. resolve 는 parsable role 만 지원.
  const isRecheckNeeded = (message: string | undefined): boolean => {
    if (!message) return false;
    return /(?:auth|firestore)=unknown/.test(message);
  };

  const handleResolve = (entry: { target: string; message: string }) => {
    const uid = entry.target.startsWith('users/') ? entry.target.slice(6) : entry.target;
    if (!uid) return;
    const parsed = parseSplitMessage(entry.message);
    if (!parsed) {
      setResolveError('감사 메시지에서 auth/firestore role 을 파싱할 수 없음 — 옛 형식 이벤트일 수 있음');
      return;
    }
    if (
      !window.confirm(
        `Firestore role 을 Auth 원본으로 덮어씁니다.\nuid=${uid}\nauth=${parsed.auth}, firestore=${parsed.firestore}\n\n계속하시겠습니까?`,
      )
    ) {
      return;
    }
    setResolvingUid(uid);
    setResolveError(null);
    resolveMutation.mutate(
      { uid, expectedAuthRole: parsed.auth, expectedFirestoreRole: parsed.firestore },
      {
        onSuccess: () => {
          setResolvingUid(null);
          reloadUnresolved();
        },
        onError: (err) => {
          setResolvingUid(null);
          setResolveError(err.message);
          // v0.107e F49: 서버가 aborted 로 새 detected 를 기록했을 수 있음. 클라이언트도
          // unresolved cache 를 즉시 무효화해서 옛 CAS row 를 재시도하지 않도록.
          reloadUnresolved();
        },
      },
    );
  };

  // v0.107f F51: 상태 재확인 handler. 서버가 Auth/Firestore 재조회 후 새 감사 이벤트 기록.
  // v0.109b F56: hook 이 자동 invalidate 안 하므로 여기서 명시적 invalidate.
  const handleRecheck = (entryTarget: string) => {
    const uid = entryTarget.startsWith('users/') ? entryTarget.slice(6) : entryTarget;
    if (!uid) return;
    setResolvingUid(uid);
    setResolveError(null);
    recheckMutation.mutate(
      { uid },
      {
        onSuccess: () => {
          setResolvingUid(null);
          qc.invalidateQueries({ queryKey: ['audit', 'unresolvedRoleSplits'] });
        },
        onError: (err) => {
          setResolvingUid(null);
          setResolveError(err.message);
          qc.invalidateQueries({ queryKey: ['audit', 'unresolvedRoleSplits'] });
        },
      },
    );
  };

  // v0.109: unknown row 자동 재확인. F48 로 남긴 auth=unknown detected 는 UI 파서가 처리 못
  // 하므로 super_admin 이 매번 「상태 재확인」 을 눌러야 했는데, 카드 mount 시 자동으로
  // 트리거. session-scoped Set (useRef) 로 무한 루프 방지 — 같은 uid 를 한 번 이상 auto-recheck
  // 하지 않음. Recheck 후에도 여전히 unknown 이면 수동 버튼으로 재시도.
  //
  // v0.109b F56: 한 mount 당 처리량 상한 (N unknown 이 있어도 최대 5개만 자동 trigger).
  // batch 전체 settle 후 한 번만 invalidate 해서 Functions 증폭 · aggregation refetch 폭주
  // 방지. 초과분은 수동 버튼으로.
  //
  // v0.109c F57: TanStack Query 는 같은 mutation observer 에 consecutive `mutate` 호출 시
  // 마지막 per-call callback 만 실행 (공식 문서). `mutateAsync` + `Promise.allSettled` 로
  // batch 완료를 기다린 뒤 한 번만 invalidate.
  // 참고: https://tanstack.com/query/latest/docs/framework/react/guides/mutations#consecutive-mutations
  //
  // v0.109d F58: `autoRecheckedUids` Set 만으로는 「mount 당 최대 5개」 계약을 못 지켰음.
  // invalidate → refetch → useEffect 재실행 시 Set 에 없는 다음 5개 UID 가 발화. 예:
  // 10 unknown → 첫 batch 5개 → invalidate → 나머지 5개 UID 가 다음 사이클에 발화.
  // 이제 mount-scoped `autoRecheckBudget` (useRef<number>) 로 총량 상한: 한 mount 동안 최대
  // AUTO_RECHECK_BATCH_LIMIT 회 발화. 초과분은 수동 버튼 유지.
  const AUTO_RECHECK_BATCH_LIMIT = 5;
  const autoRecheckedUids = useRef<Set<string>>(new Set());
  const autoRecheckBudget = useRef<number>(AUTO_RECHECK_BATCH_LIMIT);
  useEffect(() => {
    if (unresolvedQuery.isLoading || unresolvedQuery.isError) return;
    if (autoRecheckBudget.current <= 0) return;
    // batch 대상 uid 수집 (남은 budget 만큼).
    const targets: string[] = [];
    for (const e of roleSplitEntries) {
      if (targets.length >= autoRecheckBudget.current) break;
      if (!isRecheckNeeded(e.message)) continue;
      const uid = e.target.startsWith('users/') ? e.target.slice(6) : e.target;
      if (!uid || autoRecheckedUids.current.has(uid)) continue;
      autoRecheckedUids.current.add(uid);
      targets.push(uid);
    }
    if (targets.length === 0) return;
    autoRecheckBudget.current -= targets.length;
    Promise.allSettled(
      targets.map((uid) => recheckMutation.mutateAsync({ uid })),
    ).then(() => {
      qc.invalidateQueries({ queryKey: ['audit', 'unresolvedRoleSplits'] });
    });
    // recheckMutation 은 안정 참조 (React Query), roleSplitEntries 만 dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleSplitEntries, unresolvedQuery.isLoading, unresolvedQuery.isError]);

  return (
    <AppShell role={role} pageTitle="슈퍼 관리자">
      <div className="space-y-8">
        {/* KPI 로우 */}
        {/* v0.110: 미해결 role_split KPI 추가. 클릭 시 같은 페이지의 role_split section 으로
            anchor scroll.
            v0.110b F60: md 폭 (사이드바 240px + 좌우 padding 32px 차감) 은 5열 감당 못 함.
            반응형 breakpoint 를 md 2열 · lg 3열 · xl 5열 로 조정해 카드 폭 확보. */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
          {/* v0.110c F61: scanIncomplete 방향 분리 표기.
              - detectedHasMore=true & resolvedHasMore=false: 「최소 N건」 확정 → `N+` (하한).
              - resolvedHasMore=true: 스캔 밖 resolved 가 현재 unresolved 를 실제로 해결
                했을 수 있음 → N 이 과대. 방향 불확실 → `N?`.
              - 둘 다 완전: 확정 count. */}
          <KpiCard
            label="미해결 role_split"
            value={
              unresolvedQuery.isError
                ? '—'
                : (() => {
                    const count = unresolvedQuery.data?.entries.length ?? 0;
                    const detectedMore = unresolvedQuery.data?.detectedHasMore ?? false;
                    const resolvedMore = unresolvedQuery.data?.resolvedHasMore ?? false;
                    if (resolvedMore) return `${count}?`;
                    if (detectedMore) return `${count}+`;
                    return count;
                  })()
            }
            loading={unresolvedQuery.isLoading}
            href="nav"
            onClick={() => {
              const el = document.getElementById('role-split-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
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

        {/* v0.120/v0.122: 액션별 breakdown 위젯. auditLogSummary sample (최대 500)
            기준 in-memory grouping — sampleTruncated=true 이면 최신 sample 만 반영.
            v0.122: 사용자가 오늘/이번 주/이번 달 window 를 선택. */}
        <section
          className="bg-elevated p-8 border border-border-subtle space-y-4"
          data-testid="super-admin-action-breakdown"
        >
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <h2 className="text-h2 font-semibold text-fg-primary">{breakdownLabel} 액션별</h2>
              <p className="text-small text-fg-secondary mt-1">
                {breakdownLabel} 감사 이벤트를 액션 종류별로 집계했습니다. 클릭하면 감사
                로그에서 해당 액션만 필터링해 볼 수 있습니다.
              </p>
            </div>
            <div
              className="flex border border-border-subtle"
              role="group"
              aria-label="breakdown window 선택"
              data-testid="super-admin-breakdown-window"
            >
              {(['today', 'week', 'month'] as BreakdownWindow[]).map((w) => {
                const label = w === 'today' ? '오늘' : w === 'week' ? '이번 주' : '이번 달';
                const active = breakdownWindow === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleWindowChange(w)}
                    aria-pressed={active}
                    data-testid={`super-admin-breakdown-window-${w}`}
                    className={
                      'px-3 py-1 text-small border-r last:border-r-0 border-border-subtle transition-colors ' +
                      (active
                        ? 'bg-fg-primary text-canvas'
                        : 'bg-canvas text-fg-primary hover:bg-surface')
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {breakdownSummaryQuery.isLoading && (
            <div
              className="py-4 text-center text-small text-fg-secondary"
              data-testid="super-admin-breakdown-loading"
            >
              불러오는 중...
            </div>
          )}
          {breakdownSummaryQuery.isError && (
            <div
              className="border border-state-danger p-4 text-small text-state-danger"
              data-testid="super-admin-breakdown-error"
            >
              집계를 불러오지 못했습니다: {breakdownSummaryQuery.error?.message}
            </div>
          )}
          {!breakdownSummaryQuery.isLoading && !breakdownSummaryQuery.isError && (() => {
            // v0.120b F97: 구 Functions 응답 (필드 미제공) 과 실제 빈 집계 ({})
            // 를 구분한다. undefined 이면 「집계 미제공」 안내로 노출.
            // v0.126: exactActionCounts (요청 시 서버 count() aggregation) 가 오면
            // 우선. 없으면 sample-scope actionCounts.
            const sampleActionCounts = breakdownSummaryQuery.data?.actionCounts;
            const exactActionCounts = breakdownSummaryQuery.data?.exactActionCounts;
            const displayCounts = exactActionCounts ?? sampleActionCounts;
            if (displayCounts === undefined) {
              return (
                <p
                  className="text-small text-fg-muted"
                  data-testid="super-admin-breakdown-unavailable"
                >
                  집계 정보를 아직 제공하지 않는 서버 버전입니다. 잠시 후 새로고침하세요.
                </p>
              );
            }
            const sortedActions = Object.entries(displayCounts).sort((a, b) => b[1] - a[1]);
            const maxCount = sortedActions[0]?.[1] ?? 0;
            const sampleTruncated = breakdownSummaryQuery.data?.sampleTruncated ?? false;
            const sampleSize = breakdownSummaryQuery.data?.sampleSize ?? 0;
            const breakdownCount = breakdownSummaryQuery.data?.count ?? 0;
            // v0.126: exactActionCounts 응답이 온 경우 sample-scope 경고는 무의미.
            const showTruncatedBanner = sampleTruncated && exactActionCounts === undefined;

            if (sortedActions.length === 0) {
              return (
                <p
                  className="text-small text-fg-muted"
                  data-testid="super-admin-breakdown-empty"
                >
                  {breakdownLabel} 기록된 이벤트가 없습니다.
                </p>
              );
            }

            return (
              <>
                {showTruncatedBanner && (
                  <div
                    className="flex items-center justify-between gap-3 flex-wrap text-small"
                    data-testid="super-admin-breakdown-truncated-row"
                  >
                    <p
                      className="text-state-warning"
                      data-testid="super-admin-breakdown-truncated"
                    >
                      ⚠︎ {breakdownLabel} 이벤트 <strong>{breakdownCount}</strong>건 중 최신{' '}
                      <strong>{sampleSize}</strong>건만 집계에 반영. 전체 합계와 다를 수
                      있음.
                    </p>
                    <button
                      type="button"
                      onClick={() => setExactAggregation(true)}
                      data-testid="super-admin-breakdown-exact-btn"
                      className="text-fg-primary underline underline-offset-2 hover:text-fg-secondary"
                      title="Firestore count() aggregation 으로 각 action 을 정확히 재조회 (추가 서버 부담)"
                    >
                      정확 카운트 보기
                    </button>
                  </div>
                )}
                {exactActionCounts !== undefined && (() => {
                  // v0.126b F103: 서버가 `_other` bucket 을 반환하면 카탈로그 밖
                  // action 이 존재. 「전부」 대신 실제 상태를 안내.
                  const otherCount = exactActionCounts._other ?? 0;
                  return (
                    <p
                      className="text-small text-state-success"
                      data-testid="super-admin-breakdown-exact-on"
                    >
                      ✓ {breakdownLabel} 이벤트 <strong>{breakdownCount}</strong>건 action
                      별로 정확히 집계했습니다
                      {otherCount > 0 && (
                        <>
                          {' '}
                          (카탈로그 밖 action <strong>{otherCount}</strong>건은 「기타」로
                          집계)
                        </>
                      )}
                      .
                    </p>
                  );
                })()}
                <ul className="space-y-2" data-testid="super-admin-breakdown-list">
                  {sortedActions.map(([action, count]) => {
                    const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                    // v0.126b F103: `_other` 는 catalog 밖 action 총합 — 액션
                    // 필터 링크 대신 「기타」 label 로 표시하되 클릭은 비활성 (특정
                    // action 을 지정할 수 없음).
                    const isOther = action === '_other';
                    const label = isOther ? '기타 (카탈로그 밖)' : action;
                    const href = isOther
                      ? undefined
                      : `/super_admin/audit?action=${encodeURIComponent(action)}&atMin=${breakdownAtIso}`;
                    const content = (
                      <>
                        <span className="font-mono text-fg-primary w-48 shrink-0">{label}</span>
                        <span
                          className="flex-1 bg-canvas h-2 border border-border-subtle relative"
                          aria-hidden="true"
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-fg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="font-mono text-fg-primary w-12 text-right">
                          {count}
                        </span>
                      </>
                    );
                    return (
                      <li key={action}>
                        {href ? (
                          <Link
                            to={href}
                            className="flex items-center gap-3 text-small hover:bg-surface p-2 -mx-2 transition-colors"
                            data-testid={`super-admin-breakdown-row-${action}`}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div
                            className="flex items-center gap-3 text-small p-2 -mx-2 text-fg-muted"
                            data-testid={`super-admin-breakdown-row-${action}`}
                            title="카탈로그 (AUDIT_ACTIONS) 밖 action 들의 총합 — 특정 action 필터로 연결 불가"
                          >
                            {content}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
        </section>

        {/* v0.106: role_split 경고 (Auth claim ≠ Firestore role) — server-side action 필터 */}
        <section
          id="role-split-section"
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
                  {unresolvedQuery.isLoading ? (
                    '불러오는 중...'
                  ) : unresolvedQuery.isError ? (
                    '감시 데이터를 불러오지 못했습니다.'
                  ) : roleSplitEntries.length > 0 ? (
                    <>
                      미해결 role_split {roleSplitEntries.length}건 — Auth 클레임과 Firestore role 이 다른 계정.
                    </>
                  ) : (
                    <>
                      미해결 role_split 없음.{' '}
                      <strong className="font-semibold text-fg-primary">
                        역할 편집 대화상자를 열어본 계정에서만 감지
                      </strong>{' '}
                      — 아직 조회된 적 없는 계정은 확인되지 않는다.
                    </>
                  )}
                  {/* v0.107c F44: 서버 aggregation 이 detected/resolved 두 스캔 window 중 하나
                      라도 초과했음을 알린 경우 — 결과 신뢰성 저하 경고. */}
                  {!unresolvedQuery.isLoading && !unresolvedQuery.isError && scanIncomplete && (
                    <span className="ml-1 text-state-warning" data-testid="super-admin-role-split-scan-incomplete">
                      (스캔 window 초과 · 일부 상태 반영 안 됐을 수 있음. 감사 페이지에서 target 별 pagination 로 검증 권장.)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              to="/super_admin/audit?action=system.role_split_detected"
              className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors shrink-0"
              data-testid="super-admin-role-split-link"
            >
              전체 보기 →
            </Link>
          </div>
          {!unresolvedQuery.isLoading && !unresolvedQuery.isError && roleSplitEntries.length > 0 && (
            <ul
              className="space-y-2 text-small"
              data-testid="super-admin-role-split-list"
            >
              {roleSplitEntries.slice(0, 3).map((e) => {
                const uid = e.target.startsWith('users/') ? e.target.slice(6) : e.target;
                const isThisRowResolving = resolvingUid === uid;
                // v0.107f F51: unknown 마커 있으면 recheck 흐름으로 분기.
                const needsRecheck = isRecheckNeeded(e.message);
                const pending =
                  isThisRowResolving || resolveMutation.isPending || recheckMutation.isPending;
                return (
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
                    <span className="text-state-warning font-mono truncate flex-1" title={e.message}>
                      {e.message}
                    </span>
                    {needsRecheck ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRecheck(e.target)}
                        disabled={pending}
                        data-testid={`super-admin-role-split-recheck-${e.id}`}
                        title="Auth/Firestore 재조회로 실제 상태를 새 감사 이벤트로 기록"
                      >
                        {isThisRowResolving ? '확인 중...' : '상태 재확인'}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResolve({ target: e.target, message: e.message ?? '' })}
                        disabled={pending}
                        data-testid={`super-admin-role-split-resolve-${e.id}`}
                        title="Firestore role 을 Auth 원본으로 덮어씀"
                      >
                        {isThisRowResolving ? '동기화 중...' : '복구'}
                      </Button>
                    )}
                  </li>
                );
              })}
              {resolveError && (
                <li
                  className="text-small text-state-danger px-2"
                  data-testid="super-admin-role-split-resolve-error"
                >
                  복구 실패: {resolveError}
                </li>
              )}
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

