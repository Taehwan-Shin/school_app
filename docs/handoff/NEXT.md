# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **KPI 필터 링크 v0.5** — 계정 표 UX v0.4 (`a836764`) 위에 KPI 카드 클릭 시 URL 쿼리 파라미터로 계정 표를 자동 필터링한다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/kpi-filter-link-v5`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**Designer 몫**: 이 슬라이스의 모든 스타일 값은 `docs/design/UI_SYSTEM.md` §4.3·§5 에 있다. 값을 그대로 옮긴다. 새 값 발명 금지.

## 기준 커밋

**Base**: `a836764` (계정 표 UX v0.4 병합 커밋)

## 지금 할 것 — KPI 카드 → 계정 표 URL 필터 링크

### 왜

v0.3 이 4-KPI 카드를 놓았고 v0.4 가 계정 표에 검색·정렬·페이지네이션을 놓았다. 지금 두 UI 는 시각적으로만 연결되어 있고, 「관리자만 보고 싶다」 → 검색 대신 카드 클릭이 자연스러운 흐름이지만 그 연결이 없다.

이 슬라이스가 세 가지를 한다:
1. **KPI 카드 클릭 → URL 쿼리 파라미터** 로 필터 상태 반영 (`/admin?filter=admin`).
2. **계정 표 URL 파라미터 읽어 자동 필터** (검색 인풋과 병합, KPI 필터 우선).
3. **활성 카드 시각 강조** (`border-strong` 대신 얇은 강조 링).

**하지 않는 것**: 서버 왕복. KPI 카드 외의 다른 필터 (예: orgUnitPath 별 카운트). URL sort 파라미터 반영 (다음 슬라이스). 검색 인풋 값도 URL 파라미터 반영 (다음 슬라이스).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/components/dashboard/KpiCard.tsx` — `href?: string` (URL 파라미터 값) 과 `active?: boolean` prop 추가. `<button>` 으로 감싸서 클릭 가능하게. active 시 `border-strong`.
- `packages/web/src/components/dashboard/KpiCardRow.tsx` — `useSearchParams` 로 현재 filter 읽어 각 카드에 `active` 넘김. 카드 클릭 시 setSearchParams. 활성 카드 다시 클릭 시 필터 해제.
- `packages/web/src/routes/admin/AccountsTable.tsx` — `useSearchParams` 로 filter 읽고 `sortedFilteredUsers` 계산 시 KPI 필터 먼저 적용, 그 다음 검색 필터.
- `packages/web/tests/KpiCard.test.tsx` — `href/active` prop 시나리오 추가.
- `packages/web/tests/AccountsTable.test.tsx` — URL 필터 시나리오 추가.

**신규 파일**: 없음.

**손대지 마라**:
- `packages/web/src/routes/admin/index.tsx` · `CreateUserDialog.tsx` · `DeleteUserDialog.tsx` — 이 슬라이스 밖
- `packages/web/src/components/shell/*` · `components/ui/*` — 이전 슬라이스 결과 그대로
- `packages/web/src/api/usersList.ts` — 로직 손대지 마라
- `packages/web/tailwind.config.js` · `src/index.css` — 이미 토큰 다 있음

### 세부 요구

#### 1. `KpiCard.tsx` 개편

```tsx
export interface KpiCardProps {
  label: string;
  value: number | string;
  loading?: boolean;
  href?: string;      // URL param value 예: 'admin', 'suspended', 'normal'. undefined 면 클릭 불가 (총 사용자 카드는 항상 undefined 로 두어서 「전체」 관점을 유지하는 대신, 클릭 시 필터 해제 규칙은 KpiCardRow 에서).
  active?: boolean;   // 현재 URL filter 와 일치 시 true
  onClick?: () => void;
}
```

- 컨테이너 클래스 변경 (`href` 있으면 `button`, 없으면 `div`):
  - 공통: `bg-surface p-8 text-left`
  - 비활성: `border border-border-subtle rounded-none`
  - 활성 (`active === true`): `border border-border-strong rounded-none`
  - 클릭 가능 (`href` 있음): 추가 `hover:border-border-strong transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`
- `href` 있으면 `<button type="button" onClick={onClick}>` 로 감싸기. 없으면 `<div>` 그대로.
- 라벨·값 마크업은 그대로 (`text-micro uppercase tracking-wide text-fg-secondary` / `text-display font-mono text-fg-primary mt-4`).
- `data-testid` 는 그대로 `kpi-card-{label}`. active 상태 검증용 `data-active={active ? 'true' : 'false'}` 추가.

#### 2. `KpiCardRow.tsx` 개편

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const currentFilter = searchParams.get('filter'); // 'admin' | 'suspended' | 'normal' | null

const handleCardClick = (value: string) => {
  const next = new URLSearchParams(searchParams);
  if (currentFilter === value) {
    next.delete('filter');
  } else {
    next.set('filter', value);
  }
  setSearchParams(next, { replace: false });
};
```

- 각 카드에 `href` 와 `active` 넘김:
  - 「총 사용자」: `href={undefined}` (클릭 불가, 전체 관점 유지). 하지만 UX 편의: 「총 사용자」 카드에 `href="all"` 대신 별도 「필터 해제」 로직 안 넣음 — 다른 활성 카드를 다시 눌러 해제한다.
  - 「관리자」: `href="admin"`, `active={currentFilter === "admin"}`
  - 「정지된 계정」: `href="suspended"`, `active={currentFilter === "suspended"}`
  - 「일반 사용자」: `href="normal"`, `active={currentFilter === "normal"}`
- 카드 onClick 은 `handleCardClick(href)`.
- `import { useSearchParams } from 'react-router-dom';`

#### 3. `AccountsTable.tsx` 필터 병합

```tsx
const [searchParams] = useSearchParams();
const kpiFilter = searchParams.get('filter'); // 'admin' | 'suspended' | 'normal' | null

const sortedFilteredUsers = useMemo(() => {
  if (!data?.users) return [];
  let result = data.users;

  // KPI 필터 먼저 (검색어와 독립적으로 적용)
  if (kpiFilter === 'admin') {
    result = result.filter((u) => u.isAdmin);
  } else if (kpiFilter === 'suspended') {
    result = result.filter((u) => u.isSuspended);
  } else if (kpiFilter === 'normal') {
    result = result.filter((u) => !u.isAdmin && !u.isSuspended);
  }

  // 검색어 필터
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter(/* 기존 코드 그대로 */);
  }

  // 정렬 (기존 코드 그대로)
  if (sortColumn) { /* ... */ }

  return result;
}, [data?.users, kpiFilter, searchQuery, sortColumn, sortDirection]);
```

- KPI 필터 변경 시에도 페이지 0 리셋: `useEffect(() => setPage(0), [searchQuery, kpiFilter]);` (기존 `searchQuery` 만이던 것 확장).
- 검색·KPI 필터 둘 다 매칭 0 → 기존 「검색 결과가 없습니다」 상태 그대로 (별도 문구 안 만듦).

#### 4. `KpiCard.test.tsx` 신규 시나리오 2

기존 5 유지. 다음 2 케이스 추가:

1. **href + active** — `href="admin"`, `active={true}` → 컨테이너에 `border-border-strong` 클래스, `data-active="true"`, `<button>` 태그로 렌더링.
2. **onClick 호출** — `href="admin"`, `onClick={mockFn}` → 클릭 시 `mockFn` 1 회 호출.

#### 5. `AccountsTable.test.tsx` 신규 시나리오 2

기존 12 유지. 다음 2 케이스 추가 (`MemoryRouter` 로 초기 경로 지정):

1. **URL filter=admin 초기 로드** — `<MemoryRouter initialEntries={['/admin?filter=admin']}>` + 5 users (2 admin) → 표에 admin 2 명만.
2. **KPI 필터 + 검색 병합** — `?filter=admin` + 검색어 `admin1` → admin 이면서 이름/이메일 매칭 1 명만.

**주의**: 기존 `AccountsTable.test.tsx` 는 `MemoryRouter` 없이 렌더할 수도 있음. `useSearchParams` 추가로 인해 모든 테스트가 `MemoryRouter` 래퍼 필요. 헬퍼 함수 신설:

```tsx
function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/admin']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}
```

기존 render 호출들을 `renderWithRouter` 로 교체. `KpiCardRow.test.tsx` 도 동일 (내부에서 `useSearchParams` 사용).

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 121 + 신규 4 = 125 근처 유지. `MemoryRouter` 래퍼 추가로 기존 테스트 손상 없음 확인.
5. dev 서버로 로컬 눈 확인 목록:
   - `/admin` 에서 「관리자」 카드 클릭 → URL 이 `/admin?filter=admin` 으로 바뀌고 카드 테두리 강조, 표에 관리자만 렌더
   - 「관리자」 카드 다시 클릭 → URL 이 `/admin` 으로 돌아가고 필터 해제, 표 전체 복원
   - 「관리자」 필터 상태에서 검색어 「1」 입력 → admin 이면서 「1」 매칭 행만
   - 「총 사용자」 카드는 클릭 불가 (hover 시 커서 default, 포커스 링 없음)
   - 다크 모드 토글 시 활성 카드 강조 (`border-border-strong`) 자연 전환
   - 카드 키보드 포커스 (Tab) 시 링 표시, Enter/Space 로 활성화
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **URL sort/search 파라미터 반영** — 이번 슬라이스 밖 (검색·정렬은 컴포넌트 상태 유지). 다음 슬라이스에서 판단.
- **다중 필터** (「관리자 AND 정지됨」) — 카드 단일 선택 원칙 유지, 다음 슬라이스에서 판단.
- **URL 쿼리 잘못된 값 처리** — `?filter=xyz` 같은 미지 값은 `admin/suspended/normal` 하나가 아니므로 자연히 매칭 없음 → 검색 결과 0 상태. 별도 에러 처리 안 함.
- **실 계정 조작** — 사용자 콘솔 조치 후 실측.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): KpiCard 에 href · active · onClick prop 추가 (링크 기능)`
2. `feat(web): KpiCardRow 에 URL 필터 상태 반영 (useSearchParams)`
3. `feat(web): AccountsTable KPI 필터 + 검색 필터 병합`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/kpi-filter-link-v5`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
