# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **super_admin KPI 클릭 nav v0.39** — 4 개 KPI 카드에 클릭 시 대상 페이지 nav 추가. 프론트엔드 only.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/super-kpi-nav-v39`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `d573260` (super_admin 대시보드 v0.38)

## 지금 할 것 — super_admin KPI 4 개 클릭 nav

### 왜

v0.38 로 super_admin 최근 이벤트 행에는 클릭 nav 를 붙였지만 KPI 카드 4 개는 여전히 display-only. AccountsTable 의 KpiCardRow 는 각 KPI 를 클릭하면 URL 필터가 토글됨 (`packages/web/src/components/dashboard/KpiCardRow.tsx`). super_admin 도 클릭 nav 로 오퍼레이션 페이지에 바로 이동시키면 대시보드 → 관리 흐름이 원클릭.

**하지 않는 것**: KpiCard 컴포넌트 자체 수정 (button 렌더 로직 재설계는 별도 slice). 새 라우트. 새 필터 유형.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/super_admin/index.tsx` — 4 개 KPI 에 `href`(dummy) + `onClick` (useNavigate) 추가
- `packages/web/tests/SuperAdminPage.test.tsx` — 시나리오 4 추가 (KPI 각 1개씩 클릭 → navigate mock 호출 확인)

**손대지 마라**:
- `KpiCard` 컴포넌트 자체 — 그대로 (dummy href 로 button 렌더 유도).
- `KpiCardRow` — 그대로 (admin 페이지 URL 토글 로직 계속 사용).
- 백엔드 · 다른 라우트.

### 세부 요구

#### 1. `super_admin/index.tsx` — useNavigate 추가

```ts
import { useNavigate, Link } from 'react-router-dom';
// ...
const navigate = useNavigate();
```

#### 2. KPI 각 카드 nav 로직

**오늘 자정 계산** (최근 24시간 이벤트 nav 용):
```ts
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const yyyy = todayStart.getFullYear();
const mm = String(todayStart.getMonth() + 1).padStart(2, '0');
const dd = String(todayStart.getDate()).padStart(2, '0');
const todayIso = `${yyyy}-${mm}-${dd}`;
```

**KpiCard 확장** (기존 4 카드 전부):
```tsx
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
  label="최근 24시간 이벤트"
  value={recentEvents.length}
  loading={audit.loading}
  href="nav"
  onClick={() => navigate(`/super_admin/audit?atMin=${todayIso}`)}
/>
```

주의:
- `href="nav"` 은 dummy — KpiCard 내부 `if (href)` 체크로 button 렌더링만 유도 (`packages/web/src/components/dashboard/KpiCard.tsx:45`).
- 실제 nav 는 `onClick` 이 처리.
- `active` prop 은 pass 하지 않음 (super_admin 대시보드에서 활성 상태 없음).

#### 3. 테스트

**web `SuperAdminPage.test.tsx`** (4 신규 시나리오 — 기존 확장):

Mock `useNavigate`:
```ts
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});
```

시나리오:
1. `kpi-card-총 사용자` 클릭 → `navigateMock('/admin')` 호출.
2. `kpi-card-총 그룹` 클릭 → `navigateMock('/admin/groups')`.
3. `kpi-card-정지된 계정` 클릭 → `navigateMock('/admin?filter=suspended')`.
4. `kpi-card-최근 24시간 이벤트` 클릭 → `navigateMock('/super_admin/audit?atMin=YYYY-MM-DD')` (오늘 자정 iso).

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 475 + 신규 4 = 479 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/super_admin` KPI 카드 4 개 모두 hover 시 border 강조 + 클릭 시 해당 페이지로 nav
   - 정지된 계정 클릭 → `/admin?filter=suspended` (KPI 필터 활성)
   - 최근 24시간 이벤트 클릭 → `/super_admin/audit?atMin=YYYY-MM-DD` (오늘 자정 이후 이벤트)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **KpiCard 리팩터 (button + Link 통합)** — 별도 slice.
- **KPI 활성 상태 (active prop)** — super_admin 대시보드에서 「어떤 필터가 활성인지」 개념 없음 (여기선 nav 만).

### 커밋 규칙

**1 커밋**:
- `feat(web): super_admin KPI 카드 4 개 클릭 시 대상 페이지 nav`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/super-kpi-nav-v39`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
