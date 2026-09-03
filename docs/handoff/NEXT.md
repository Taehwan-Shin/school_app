# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **super_admin 대시보드 v0.38** — 정지된 계정 KPI 카드 추가 + 최근 이벤트 행 클릭 시 감사 로그 필터 이동. 프론트엔드 only.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/super-dashboard-v38`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `45a66c5` (CSV 확장 + 감사 프리셋 v0.37)

## 지금 할 것 — super_admin KPI + 이벤트 클릭 nav

### 왜

`SuperAdminPage` (`packages/web/src/routes/super_admin/index.tsx`) 는 현재:
- KPI 3 개 (총 사용자·총 그룹·최근 24시간 이벤트)
- 최근 이벤트 5 개 미리보기 (`super-admin-recent-events`)

이번 슬라이스:
1. **정지된 계정** KPI 카드 추가 (총 4 개 → md:grid-cols-4)
2. 최근 이벤트 미리보기 행에 클릭 시 감사 로그 필터 nav (actor 로 이동)

**하지 않는 것**: 새 KPI (관리자 수 등) — admin 페이지에 이미 존재. target 별도 클릭 (target 이 `*` 인 경우 많고 UX 애매). 이벤트 상세 오버레이 (별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/super_admin/index.tsx` — 정지된 계정 KPI 카드 추가 + 최근 이벤트 행 → Link 로 감싸기
- `packages/web/tests/SuperAdminPage.test.tsx` (있으면 확장 · 없으면 신규) — 시나리오 2

**손대지 마라**:
- 백엔드 callable · Firestore · middleware.
- KpiCard 컴포넌트 자체.
- `/super_admin/audit` 라우트 코드.
- 다른 라우트.

### 세부 요구

#### 1. `super_admin/index.tsx` — 정지된 계정 KPI

기존 grid `grid-cols-2 md:grid-cols-3` → `grid-cols-2 md:grid-cols-4`.

계산:
```ts
const suspendedCount = users.data?.users?.filter((u) => u.isSuspended).length ?? 0;
```

카드 추가 (최근 24시간 이벤트 앞에):
```tsx
<KpiCard
  label="정지된 계정"
  value={suspendedCount}
  loading={users.isLoading}
/>
```

#### 2. `super_admin/index.tsx` — 이벤트 행 클릭 → nav

기존 최근 이벤트 미리보기 `<li>` 를 `<Link>` 로 감싸기 (react-router-dom 이미 import).

```tsx
{recentEvents.slice(0, 5).map((e) => (
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
      <span className={
        e.result === 'ok' ? 'text-fg-primary'
        : e.result === 'error' ? 'text-state-danger'
        : 'text-state-warning'
      }>{e.result}</span>
    </Link>
  </li>
))}
```

주의:
- 기존 UI 스타일 유지 + hover 상태 추가.
- `actor` 이 `unknown` 인 경우도 링크 유효 (audit 페이지 에서 매치 없음 표시).
- target 은 별도 링크 안 함 (`*` 경우가 대부분 → 오히려 혼란).
- actor 뒤에 추가 표시 (기존에 actor 를 안 보여줬다면 지금 추가) — 이미 있으면 그대로.

#### 3. 테스트

**web `SuperAdminPage.test.tsx`** (기존 있으면 확장 · 없으면 신규 2 시나리오):

1. **정지된 계정 KPI 렌더**: 사용자 3 명 중 1 명 isSuspended → KPI 카드 「정지된 계정」 값 1.
2. **이벤트 행 클릭 nav**: 최근 이벤트 렌더 → `super-admin-recent-event-{id}` 링크 href 가 `/super_admin/audit?actor={actor}`.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 473 + 신규 2 = 475 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/super_admin` 4 개 KPI (총 사용자·총 그룹·정지된 계정·최근 24시간 이벤트)
   - 최근 이벤트 행 hover → 배경 강조 + 커서 pointer
   - 클릭 → `/super_admin/audit?actor=...` 이동, 해당 actor 필터 적용됨
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **KPI 카드 순서** — 이번 슬라이스는 「총 사용자 · 총 그룹 · 정지된 계정 · 최근 24시간 이벤트」 순 (활동성 순).
- **정지된 계정 클릭 → AccountsTable 정지 필터 이동** — 별도 slice (KpiCard href prop 재활용).
- **actor 가 `unknown` 인 이벤트도 nav 는 유효** — audit 필터가 매치 없어도 리스트 표시.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): super_admin 대시보드 정지된 계정 KPI 카드 추가`
2. `feat(web): super_admin 최근 이벤트 행 클릭 시 감사 로그 actor 필터 이동`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/super-dashboard-v38`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
