# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **super_admin 대시보드 재설계 v0.25** — 현재 shadcn 스타일 placeholder 인 `/super_admin` 페이지를 UI_SYSTEM 톤 + 실 KPI (총 사용자·총 그룹·최근 24 시간 감사 이벤트) + 감사 로그 shortcut 로 재작성.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/super-admin-dashboard-v25`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

**Designer 몫**: `docs/design/UI_SYSTEM.md` §4.3 (KPI 카드) + §4.5 (버튼) + accounts KpiCard 재사용.

## 기준 커밋

**Base**: `5d28514` (감사 로그 v3 v0.24)

## 지금 할 것 — /super_admin 대시보드 재작성

### 왜

`/super_admin` 페이지는 v0.1 이전의 shadcn 기본 스타일 (bg-white·rounded-lg·shadow-sm·text-slate-*) 그대로 남아있고 placeholder 문구가 실 기능과 어긋남 (「감사 로그 자리」 라고 하지만 이미 `/super_admin/audit` 가 실 뷰).

이 슬라이스가 사용자 역할별 진입 페이지를 재작성.

**하지 않는 것**: `/teacher` 재작성 (다음 slice). 새 백엔드 (기존 hook 재사용). 상세 통계 그래프 (별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/super_admin/index.tsx` — 재작성.

**신규 파일**:
- `packages/web/tests/SuperAdminPage.test.tsx` — 신규 시나리오 3.

**손대지 마라**:
- `AuditLogTable` · KPI 컴포넌트 · 다른 라우트.
- 백엔드.
- teacher 페이지 (별도 slice).

### 세부 요구

#### 1. `super_admin/index.tsx` 재작성

**참고**: `useUsersList` + `useGroupsList` + `useAuditLogList` 이미 있음. 모두 재사용.

**레이아웃**:
```tsx
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { useUsersList } from '../../api/usersList';
import { useGroupsList } from '../../api/groupsList';
import { useAuditLogList } from '../../api/auditLogList';
import { Link } from 'react-router-dom';

export function SuperAdminPage() {
  const { role } = useAuth();
  const users = useUsersList();
  const groups = useGroupsList();
  const audit = useAuditLogList(50);  // 최근 50 개만 KPI 계산용

  // 최근 24 시간 감사 이벤트 수
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const recentEvents = audit.entries.filter((e) => e.at >= dayAgo);

  return (
    <AppShell role={role} pageTitle="슈퍼 관리자">
      <div className="space-y-8">
        {/* KPI 로우 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="총 사용자"
            value={users.data?.users?.length ?? 0}
            loading={users.isLoading}
          />
          <KpiCard
            label="총 그룹"
            value={groups.data?.groups?.length ?? 0}
            loading={groups.isLoading}
          />
          <KpiCard
            label="최근 24시간 이벤트"
            value={recentEvents.length}
            loading={audit.loading}
          />
        </div>

        {/* 감사 로그 shortcut */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-h2 font-semibold text-fg-primary">최근 감사 이벤트</h2>
              <p className="text-small text-fg-secondary mt-1">
                {recentEvents.length > 0
                  ? `최근 24시간에 ${recentEvents.length}건의 이벤트가 기록되었습니다.`
                  : '최근 24시간에 이벤트가 없습니다.'}
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
          {recentEvents.length > 0 && (
            <ul className="space-y-2" data-testid="super-admin-recent-events">
              {recentEvents.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center gap-3 text-small">
                  <span className="font-mono text-fg-secondary w-40 shrink-0">
                    {new Date(e.at).toLocaleString('ko-KR')}
                  </span>
                  <span className="font-mono text-fg-primary">{e.action}</span>
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
```

**주의**:
- `useAuditLogList(50)` — 초기 50 개만 로드 (KPI 계산 + 프리뷰 5 개 용). 「더 보기」 없음.
- `useUsersList` / `useGroupsList` — 모두 병렬 (React Query 병렬 fetch).
- KPI 로우: 3 개 (accounts 4 개와 다름, super_admin 관점).
- 감사 shortcut 섹션 하단 프리뷰 5 개 (event.result 색상 구분).

**하단 「시스템 설정」 섹션**: shadcn 스타일 유지하지 마라. UI_SYSTEM 톤 (bg-elevated + border-border-subtle + text-h3).

#### 2. `SuperAdminPage.test.tsx` 신규 3

`MemoryRouter` 래퍼 + hook mock 시나리오:

1. **KPI 로우 렌더** — mock users.data.users=[5개], groups.data.groups=[3개], audit.entries=[10개 (5개는 24시간 이내)] → 3 KPI 카드 값 (5·3·5).
2. **최근 이벤트 프리뷰** — audit.entries 로 5 개 렌더, 각 `super-admin-recent-events` 아래에 이벤트 표시.
3. **빈 이벤트 상태** — audit.entries=[] → 「최근 24시간에 이벤트가 없습니다.」

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 390 + 신규 3 = 393 근처.
5. dev 서버 확인:
   - `admin2@cam.hs.kr` 로 로그인 → `/super_admin` 자동 이동
   - 3 KPI 카드 (총 사용자·총 그룹·최근 24시간 이벤트) 큰 숫자 렌더
   - 「최근 감사 이벤트」 섹션에 최근 5 개 이벤트 프리뷰
   - 「감사 로그 전체 보기 →」 클릭 시 `/super_admin/audit` 로 이동
   - 다크 모드 자연 전환
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **`/teacher` 대시보드** — 다음 slice.
- **역할 관리 UI** — 별도 slice (`system.manage_roles` cap 이미 정의됨).
- **상세 통계 그래프** — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): SuperAdminPage 재작성 (UI_SYSTEM 톤 + 실 KPI + 감사 shortcut)`
2. `test(web): SuperAdminPage 시나리오 3 추가`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/super-admin-dashboard-v25`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
