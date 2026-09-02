# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Groups KPI 필터 링크 v0.20** — v0.19 의 KPI 카드를 클릭 가능하게 하고 URL 필터 (`?filter=`) 로 표를 자동 필터. accounts v0.5 패턴 그대로.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-kpi-filter-v20`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `fdca595` (Groups KPI 카드 v0.19)

## 지금 할 것 — Groups KPI 카드 클릭 시 표 필터

### 왜

v0.19 로 4-KPI 카드를 놓았지만 클릭 안 됨. Accounts 는 v0.5 로 KPI 카드 클릭 → URL 필터 → 표 자동 필터가 붙어있음. Groups 도 같은 UX 필요.

**하지 않는 것**: 새 KPI 종류 추가. 새 필터 종류. URL search/sort 는 v0.18 로 이미 구현됨 (`?q`, `?sort`, `?dir`), 이번엔 `?filter` 만 추가.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/components/dashboard/GroupKpiCardRow.tsx` — 각 카드에 `href` + `active` + `onClick` 넘김. accounts `KpiCardRow.tsx` 미러.
- `packages/web/src/routes/admin/GroupsTable.tsx` — `useSearchParams` 에서 `filter` 읽고 필터 로직 병합 (기존 검색·정렬과 함께).
- `packages/web/tests/GroupKpiCardRow.test.tsx` — active/href 시나리오 2 추가.
- `packages/web/tests/GroupsTable.test.tsx` — URL filter 시나리오 2 추가.

**신규 파일**: 없음.

**손대지 마라**:
- `KpiCard.tsx` — 이미 href/active/onClick prop 지원 (v0.5 에서 추가).
- 백엔드 · API 클라이언트 · 다른 라우트 — 이 슬라이스 밖.

### 세부 요구

#### 1. `GroupKpiCardRow.tsx` — 클릭 가능 카드 3 개

**추가**:
```ts
import { useSearchParams } from 'react-router-dom';

export function GroupKpiCardRow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFilter = searchParams.get('filter');
  const { data, isLoading, isError } = useGroupsList();
  
  const handleCardClick = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (currentFilter === value) {
      next.delete('filter');
    } else {
      next.set('filter', value);
    }
    setSearchParams(next, { replace: false });
  };

  ...  // KPI 계산 (v0.19 그대로)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard label="총 그룹" value={totalGroups} loading={isLoading} href={undefined} />
      <KpiCard label="멤버 있는 그룹" value={withMembers} loading={isLoading}
        href="with-members" active={currentFilter === 'with-members'}
        onClick={() => handleCardClick('with-members')} />
      <KpiCard label="빈 그룹" value={empty} loading={isLoading}
        href="empty" active={currentFilter === 'empty'}
        onClick={() => handleCardClick('empty')} />
      <KpiCard label="평균 멤버 수" value={avg} loading={isLoading} href={undefined} />
    </div>
  );
}
```

**주의**:
- 「총 그룹」 · 「평균 멤버 수」 는 `href={undefined}` 유지 (클릭 불가, 총 관점).
- 「멤버 있는 그룹」 · 「빈 그룹」 만 클릭 가능 필터 카드.

#### 2. `GroupsTable.tsx` — 필터 병합

**KPI 필터 값 정의**:
- `'with-members'`: `group.directMembersCount > 0`
- `'empty'`: `group.directMembersCount === 0`
- 기타 값 (미지): 자연 매칭 없음 → 검색 결과 0 상태.

**변경 위치** — `useSearchParams` 에서 `filter` 도 읽고, `sortedFilteredGroups` (또는 accounts 와 동일한 이름의 useMemo) 안에서 첫 번째 필터로:

```ts
const kpiFilter = searchParams.get('filter');

const sortedFilteredGroups = useMemo(() => {
  if (!data?.groups) return [];
  let result = data.groups;

  // KPI 필터 먼저
  if (kpiFilter === 'with-members') {
    result = result.filter((g) => g.directMembersCount > 0);
  } else if (kpiFilter === 'empty') {
    result = result.filter((g) => g.directMembersCount === 0);
  }

  // 검색어 필터 (기존)
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter(/* 기존 코드 그대로 */);
  }

  // 정렬 (기존)
  if (sortColumn) { /* ... */ }

  return result;
}, [data?.groups, kpiFilter, searchQuery, sortColumn, sortDirection]);
```

**페이지 리셋 트리거 확장**:
```ts
useEffect(() => {
  setPage(0);
}, [searchQuery, kpiFilter, sortColumn, sortDirection]);
```
(정렬 변경 시에도 리셋 — accounts 와 동일 규칙)

#### 3. `GroupKpiCardRow.test.tsx` 신규 2

기존 3 유지, 다음 2 추가 (`MemoryRouter` 필요):
1. **href + active** — `?filter=with-members` 초기 URL → 「멤버 있는 그룹」 카드에 `data-active="true"`, `<button>` 태그.
2. **onClick 호출** — 카드 클릭 → URL 이 `?filter=with-members` 로 바뀌는 것 확인 (`useLocation` 스파이).

#### 4. `GroupsTable.test.tsx` 신규 2

기존 유지, 다음 2 추가 (`MemoryRouter` 초기 경로):
1. **URL filter=with-members 초기 로드** — `initialEntries={['/admin/groups?filter=with-members']}` + 4 그룹 (2 개 멤버 있음, 2 개 빈) → 표에 멤버 있는 2 개만.
2. **KPI 필터 + 검색 병합** — `?filter=empty` + 검색어 → 빈 그룹 중 검색 매칭만.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 346 + 신규 4 = 350 근처.
5. dev 서버 확인:
   - `/admin/groups` 「멤버 있는 그룹」 카드 클릭 → URL `/admin/groups?filter=with-members` → 표에 멤버 있는 그룹만
   - 다시 클릭 → 필터 해제
   - 「빈 그룹」 카드 클릭 → 빈 그룹만
   - 「총 그룹」 · 「평균 멤버 수」 클릭 불가 (커서 default)
   - 활성 카드 `border-border-strong` 강조
   - 검색·정렬과 병합 자연 작동
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **필터 값 확장** (예: OWNER 가 있는 그룹 등) — 별도 slice.
- **다중 필터** — 카드 하나만 활성 규칙 유지.
- **실 워크스페이스 그룹 KPI 실측** — 배포 후 사용자 확인.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): GroupKpiCardRow 에 URL 필터 상태 반영 (useSearchParams)`
2. `feat(web): GroupsTable KPI 필터 + 검색 필터 병합`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/groups-kpi-filter-v20`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
