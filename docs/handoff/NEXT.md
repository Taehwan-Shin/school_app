# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **UI 재구성 v0.3 — KPI 카드 로우** — UI accounts v0.2 (`157c1c7`) 위에 관리자 대시보드 상단에 4-KPI 카드 로우를 추가하고 `/admin` 라우트의 상위 컨테이너를 UI_SYSTEM 토큰으로 정리한다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/kpi-cards-v3`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**Designer 몫**: 이 슬라이스의 모든 스타일 값은 `docs/design/UI_SYSTEM.md` §4.3 에 있다. 값을 그대로 옮긴다. 새 값 발명 금지.

## 기준 커밋

**Base**: `157c1c7` (UI accounts v0.2 병합 커밋)

## 지금 할 것 — 관리자 대시보드에 KPI 카드 로우 추가

### 왜

UI accounts v0.2 가 계정 표·다이얼로그·버튼을 UI_SYSTEM 값으로 옮겼다. 그런데 `/admin` 라우트의 **상위 컨테이너 (`routes/admin/index.tsx`) 는 여전히 shadcn 기본** — `bg-white` · `rounded-lg` · `shadow-sm` · `text-slate-*` 토큰이다. 다크 모드에서 어색하고 UI_SYSTEM 톤과 어긋난다. 그리고 대시보드 최상단이 계정 표부터 바로 시작해서 「지금 조직이 어떻게 되어 있는지」 요약 시각이 없다.

이 슬라이스가 두 가지를 한다:
1. **KPI 카드 4 개 로우** 를 대시보드 최상단에 추가 (총 사용자·관리자·정지된 계정·일반 사용자). UI_SYSTEM §4.3 값 그대로.
2. **`routes/admin/index.tsx` 컨테이너 스타일 정리** — shadcn slate 토큰 → UI_SYSTEM 토큰.

**하지 않는 것**: 새 라우트. 새 callable. 새 API 호출. KPI 는 이미 있는 `useUsersList` 데이터에서 계산 (추가 서버 왕복 없음). 히스토리컬 델타 (「지난 주 대비 +12」) 는 데이터 없어서 이번 슬라이스 밖.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/index.tsx` — shadcn 컨테이너 스타일 (`bg-white`·`rounded-lg`·`shadow-sm`·`text-slate-*`) 을 UI_SYSTEM 토큰으로. 최상단에 `<KpiCardRow />` 추가.
- `packages/web/src/components/dashboard/KpiCard.tsx` — **신규**. UI_SYSTEM §4.3 카드 컴포넌트.
- `packages/web/src/components/dashboard/KpiCardRow.tsx` — **신규**. `useUsersList` 데이터에서 4 KPI 계산 + 4 카드 렌더.
- `packages/web/tests/KpiCard.test.tsx` — **신규**. 라벨·값·로딩 상태 회귀 테스트.

**신규 파일**: 3 개 (`KpiCard.tsx` · `KpiCardRow.tsx` · `KpiCard.test.tsx`).

**손대지 마라**:
- `packages/web/src/routes/admin/AccountsTable.tsx` · `CreateUserDialog.tsx` · `DeleteUserDialog.tsx` — v0.2 결과 그대로
- `packages/web/src/components/shell/*` · `components/ui/*` — 이전 슬라이스 결과 그대로
- `packages/web/src/api/usersList.ts` — 로직 손대지 마라. `UserItem` 타입만 읽어 씀
- `packages/web/tailwind.config.js` · `src/index.css` — 이미 토큰 다 있음

### 세부 요구

#### 1. `components/dashboard/KpiCard.tsx` (신규)

UI_SYSTEM §4.3 값 그대로:

```tsx
export interface KpiCardProps {
  label: string;         // 예: "총 사용자"
  value: number | string; // 예: 428
  loading?: boolean;
}
```

- 컨테이너: `bg-surface border border-border-subtle rounded-none p-8`
- 라벨: `text-micro uppercase tracking-wide text-fg-secondary`
- 값: `text-display font-mono text-fg-primary mt-4`
- 로딩 상태: 값 자리에 `text-display text-fg-muted` 로 `—` 표시 (스켈레톤 애니메이션 없음, UI_SYSTEM 톤에 맞게 조용히)
- `data-testid={`kpi-card-${label}`}`

#### 2. `components/dashboard/KpiCardRow.tsx` (신규)

- `useUsersList()` 호출
- 4 개 KPI 계산 (오류 시 `—` 로 낙관 렌더, 오류 배너는 표에서 이미 표시하므로 여기서 중복 안 함):
  - 「총 사용자」: `data?.users?.length ?? 0`
  - 「관리자」: `data?.users?.filter(u => u.isAdmin).length ?? 0`
  - 「정지된 계정」: `data?.users?.filter(u => u.isSuspended).length ?? 0`
  - 「일반 사용자」: `data?.users?.filter(u => !u.isAdmin && !u.isSuspended).length ?? 0`
- 컨테이너: `grid grid-cols-2 md:grid-cols-4 gap-4`
- 로딩 중이면 4 카드 다 `loading={true}` 로.
- 오류이면 4 카드 다 값 `—` 로 (loading=false).

#### 3. `routes/admin/index.tsx` — 컨테이너 스타일 정리

**교체할 shadcn 값 → UI_SYSTEM 값** (한 줄씩 정확히):

- `<section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">` → `<section className="bg-elevated p-8 border border-border-subtle space-y-4">`
- `<h2 className="text-lg font-semibold text-slate-900">Google Workspace 계정 목록</h2>` → `<h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 계정 목록</h2>`
- 하단 두 placeholder 카드 (「계정·그룹·챗·클래스룸 대시보드」·「기초값 관리」) 도 같은 방식:
  - `bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2` → `bg-elevated p-8 border border-border-subtle space-y-2`
  - `text-lg font-semibold text-slate-900` → `text-h3 font-semibold text-fg-primary` (h3 이유: 이 두 카드는 sub-section)
  - `text-sm text-slate-600` → `text-small text-fg-secondary`
- 최상위 `<div className="space-y-6">` → `<div className="space-y-8">` (UI_SYSTEM §3 섹션 간격)

**최상단에 KPI 로우 추가** — 「Google Workspace 계정 목록」 섹션 앞에:

```tsx
<KpiCardRow />
```

#### 4. `packages/web/tests/KpiCard.test.tsx` (신규)

Vitest + React Testing Library. `useUsersList` 는 mock. 3 시나리오:

- **로딩** — `isLoading: true` 반환 → 카드 4 개 모두 `data-testid` 로 찾아지고 값 자리에 `—` 렌더.
- **정상 데이터** — 5 users (2 admin · 1 suspended · 2 normal) → 각 카드의 값이 정확히 계산 (총 5 · 관리자 2 · 정지 1 · 일반 2).
- **오류** — `isError: true, data: undefined` → 카드 4 개 값 모두 `—` (loading=false).

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 111 + 신규 3 = 114 근처 유지.
5. dev 서버로 로컬 눈 확인 목록:
   - `/admin` 라우트 최상단에 4 카드 (총 사용자·관리자·정지된 계정·일반 사용자) 로 시작
   - 라이트 모드에서 UI_SYSTEM 톤 (샤프 코너 · 얇은 회색 라인 · 검정 숫자)
   - 다크 모드 토글 시 카드 배경·라인·글자색 모두 자연 전환
   - 카드 아래로 계정 표 · placeholder 두 카드 순서 유지, 모두 UI_SYSTEM 톤
   - 카운트가 실제 표 행 수와 일치
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **히스토리컬 델타 (「지난 주 대비 +12」)** — 데이터 없음, 다음 슬라이스에서 판단.
- **KPI 카드 링크화** (카드 클릭 시 필터된 표로) — 라우팅 확장 필요, 이번 슬라이스 밖.
- **실 계정 조작** — 사용자 콘솔 조치 후 실측.

### 커밋 규칙

**3 커밋 분리**:
1. `refactor(web): AdminPage 컨테이너를 UI_SYSTEM 토큰으로 정리`
2. `feat(web): KpiCard 컴포넌트 신설 (UI_SYSTEM §4.3)`
3. `feat(web): 관리자 대시보드에 4-KPI 카드 로우 추가`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/kpi-cards-v3`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
