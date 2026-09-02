# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Groups KPI 카드 v0.19** — `/admin/groups` 최상단에 4 KPI 카드 로우 추가. accounts v0.3 (`KpiCard`/`KpiCardRow`) 패턴 그대로 재사용.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-kpi-v19`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

**Designer 몫**: 스타일 값은 `docs/design/UI_SYSTEM.md` §4.3 (KPI 카드) 그대로. accounts KpiCard 컴포넌트 재사용.

## 기준 커밋

**Base**: `2c38fe8` (Groups 목록 UX v0.18)

## 지금 할 것 — Groups 페이지 상단에 KPI 카드 로우

### 왜

Accounts 는 v0.3 로 4-KPI 카드 (총 사용자·관리자·정지·일반) 를 최상단에 두었지만 Groups 는 KPI 없이 표만 있음. 조직에 그룹이 많을 때 「지금 몇 개 그룹이 있고, 어떤 유형인지」 요약 시각이 없음. 이 슬라이스가 그걸 추가.

**하지 않는 것**: KPI 카드 클릭 → 필터 (accounts v0.5 패턴) 는 별도 슬라이스 v0.20. Chat/Classroom 도메인은 별도. Bulk 는 별도.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/groups.tsx` — `GroupsPage` 상단에 `<GroupKpiCardRow />` 추가.

**신규 파일**:
- `packages/web/src/components/dashboard/GroupKpiCardRow.tsx` — `useGroupsList` 데이터에서 4 KPI 계산 + `KpiCard` 4 개 렌더.
- `packages/web/tests/GroupKpiCardRow.test.tsx` — 시나리오 3.

**손대지 마라**:
- `KpiCard.tsx` — 이미 있는 컴포넌트 그대로 재사용. 새 prop 추가 금지.
- `KpiCardRow.tsx` (accounts 용) — 손대지 마라.
- `GroupsTable.tsx` — 이전 슬라이스 결과 그대로.
- 백엔드 · API 클라이언트 · 다른 라우트 — 이 슬라이스 밖.

### 세부 요구

#### 1. `GroupKpiCardRow.tsx` (신규)

`KpiCardRow.tsx` (accounts) 를 참고. 다음 4 KPI 를 `useGroupsList()` 데이터에서 계산:

- **「총 그룹」**: `data?.groups?.length ?? 0` — 필터 없음 (총 관점)
- **「멤버 있는 그룹」**: `data?.groups?.filter(g => g.directMembersCount > 0).length ?? 0`
- **「빈 그룹」**: `data?.groups?.filter(g => g.directMembersCount === 0).length ?? 0`
- **「평균 멤버 수」**: 총 멤버 수 (합계) / 그룹 수. 0 그룹이면 0. 반올림해 정수. `Math.round(...)` 사용.

**렌더 규칙**:
- 「총 그룹」 카드: `href={undefined}` (총 관점 유지, 클릭 불가). accounts 의 「총 사용자」 와 동일 패턴.
- 나머지 3 카드도 `href={undefined}` (KPI 카드 필터 링크는 v0.20 slice 에서).
- 로딩 중이면 4 카드 다 `loading={true}`.
- 오류이면 4 카드 다 값 `—`, `loading={false}`.

**API 클라이언트 재사용**: `useGroupsList` (v0.12 이미 있음).

**MemoryRouter 필요 없음**: 이번엔 URL 필터 파라미터 없음 (accounts v0.5 미러 안 함).

#### 2. `groups.tsx` — GroupsPage 상단에 KPI 로우

**수정 전** (line 8-15):
```tsx
<AppShell role={role} pageTitle="그룹">
  <div className="space-y-8">
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 그룹 목록</h2>
      </div>
      <GroupsTable />
    </section>
    ...
```

**수정 후**:
```tsx
<AppShell role={role} pageTitle="그룹">
  <div className="space-y-8">
    <GroupKpiCardRow />       {/* ← 신규 */}

    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 그룹 목록</h2>
      </div>
      <GroupsTable />
    </section>
    ...
```

`import { GroupKpiCardRow } from '../../components/dashboard/GroupKpiCardRow';` 추가.

**하단 placeholder 카드 (「그룹 관리 (준비 중)」)** — v0.15 이후 무의미 (Groups CRUD 이미 있음). **삭제** 또는 **KPI 요약 카드 하나 (예: 최근 생성된 그룹) 로 교체**. 이번 슬라이스는 **삭제**. 삭제가 추가보다 적어야 하는 규칙: 신규 파일 2 + `groups.tsx` 신규 라인 + 신규 테스트 라인이 훨씬 많으므로 규칙 통과.

**주의**: 삭제 후 순수 GroupsPage 는 `<KpiCardRow />` + `<GroupsTable>` 섹션만 남음. 훨씬 깔끔.

#### 3. `packages/web/tests/GroupKpiCardRow.test.tsx` (신규)

`KpiCard.test.tsx` 시나리오 참고. 3 케이스 (총 3 tests):

1. **로딩** — `useGroupsList` mock `isLoading=true`, `data=undefined` → 4 카드 모두 값 `—` (`kpi-card-총 그룹`, `kpi-card-멤버 있는 그룹`, `kpi-card-빈 그룹`, `kpi-card-평균 멤버 수`).

2. **정상 데이터** — 4 그룹 (2 개는 멤버 5·10 명, 2 개는 0 명) → 「총 그룹」=4, 「멤버 있는 그룹」=2, 「빈 그룹」=2, 「평균 멤버 수」=Math.round((5+10+0+0)/4)=4.

3. **오류** — `isError=true, data=undefined` → 4 카드 모두 값 `—`, loading=false.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 343 + 신규 3 = 346 근처.
5. dev 서버 확인:
   - `/admin/groups` 최상단에 4 KPI 카드 로우
   - 「총 그룹」 · 「멤버 있는 그룹」 · 「빈 그룹」 · 「평균 멤버 수」
   - 큰 숫자 (48px display font-mono)
   - 다크 모드 자연 전환
   - 표 UX (v0.18) 그대로
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **KPI 카드 클릭 → 필터** — v0.20 slice.
- **평균 계산 정확도** (특히 그룹 자체를 멤버로 갖는 경우) — Directory API 응답 그대로 사용, 실 워크스페이스 검증 후.
- **모니터링·감사** — KPI 조회는 `groups.list` 를 재사용하므로 이미 감사됨.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): GroupKpiCardRow 컴포넌트 (4 KPI: 총·멤버 있음·빈·평균)`
2. `feat(web): GroupsPage 상단에 KPI 로우 추가 + placeholder 카드 제거`
3. `test(web): GroupKpiCardRow 시나리오 3 (로딩·정상·오류)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/groups-kpi-v19`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
