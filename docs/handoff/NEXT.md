# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex 재감사 hotfix v0.71** — P9 audit MAX_LIMIT bump + super_admin hook 단일화 (중복 요청 제거).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/codex-audit-p9-v71`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `b04ab90` (Codex hotfix v0.70)

## 지금 할 것 — P9 hotfix

### 왜

Codex 재감사 P9:
> `SuperAdminPage.tsx:23` — today hook 은 500 건을 요청하지만 서버 `audit/list.ts:23` 이 200 으로 clamp 하고 pagination 을 소비하지 않아 오늘 이벤트가 200 건을 넘으면 여전히 과소 집계된다; 두 hook 은 캐시·dedup 없이 별도 API 요청과 audit read 를 발생시킨다.

**해결**:
1. 서버 MAX_LIMIT 200 → 500 (또는 1000) 상향 — 하루 500+ 이벤트는 매우 드묾, 안전
2. super_admin index.tsx 2 hook 을 1 로 통합 — 요청 절감 + audit inflation 감소

**하지 않는 것**: pagination client-side 소비 (별도 slice). 별도 count callable (별도 slice, 지금은 단순 limit 상향).

### 이 과제가 바꿀 경로

**Commit 1 (백엔드 limit bump)**:
- `packages/functions/src/callable/audit/list.ts` — MAX_LIMIT 200 → 500
- `packages/functions/tests/auditLogList.test.ts` — 시나리오 1 (limit 500 요청 → 500 반환 확인)

**Commit 2 (프론트엔드 hook 통합)**:
- `packages/web/src/routes/super_admin/index.tsx` — todayAudit + audit 통합, 하나의 useAuditLogList(500, {atMin: todayStartMs}) 만 사용, preview = entries.slice(0, 5)
- `packages/web/tests/SuperAdminPage.test.tsx` — 조정 (mock 1개, preview 오늘 기준)

**손대지 마라**:
- 다른 callable · shared · Firestore.
- AuditLogTable (다른 페이지 · 이미 필요 시 페이지네이션).
- readAudit 자체 로직 (limit clamp 만 확장).

### 세부 요구

#### Commit 1: MAX_LIMIT 200 → 500

`packages/functions/src/callable/audit/list.ts`:
```ts
const MAX_LIMIT = 500;   // 기존 200
```

**주의**:
- 500 도 여전히 상한. 하루 500 초과 시 여전히 undercount → 별도 count callable slice.
- Firestore 단일 쿼리 500 read 는 cost·latency 문제 없음 (KB 단위).

#### Commit 1 테스트

`packages/functions/tests/auditLogList.test.ts` (1 신규 시나리오):
- limit 500 요청 → mock Firestore 가 500 반환 → response entries.length === 500.
- limit 1000 요청 → clamp 되어 500 만 반환.

기존 시나리오 회귀 유지 (특히 default 50 · MAX 200 assertion 있으면 500 으로 수정).

#### Commit 2: super_admin index.tsx hook 통합

기존 (v0.69):
```ts
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayStartMs = todayStart.getTime();

const todayAudit = useAuditLogList(500, { atMin: todayStartMs });
const todayCount = todayAudit.entries.length;
const audit = useAuditLogList(50);   // 미리보기용
```

변경:
```ts
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayStartMs = todayStart.getTime();

// 단일 hook: 오늘 이벤트 전체 (최대 500)
const todayAudit = useAuditLogList(500, { atMin: todayStartMs });
const todayCount = todayAudit.entries.length;
```

**preview 데이터 소스 변경**:
```tsx
// 기존: audit.entries (최근 50 전체)
// 변경: todayAudit.entries (오늘)
{todayAudit.entries.slice(0, 5).map((e) => ...)}
```

**loading state 통합**:
```tsx
loading={todayAudit.loading}
```

**주의**:
- preview 는 이제 「오늘 이벤트 최근 5」 로 변경. 오늘 이벤트 없으면 empty state (기존 「최근 24시간 이벤트가 없습니다」 조건 그대로 사용).
- 「최근 이벤트」 문구 는 「오늘 이벤트」 로 조정 (v0.69 에서 이미 라벨 통일).
- audit.read log 발생 횟수 절반 (2 → 1).

#### Commit 2 테스트

`packages/web/tests/SuperAdminPage.test.tsx` 조정:
- useAuditLogList mock 1개만 (2개 → 1개).
- preview 시나리오: todayAudit.entries 로부터 slice.
- 기존 「recent events preview」 시나리오 조정.

기존 회귀 유지 (KPI 4개, 4 nav 시나리오).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 622 + 신규 1 - 회귀 조정 = 620~623 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - super_admin KPI 「오늘 이벤트」 = 실 오늘 이벤트 (200 초과 시 500까지)
   - 미리보기 = 오늘 이벤트 최근 5 (오늘 없으면 empty)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **500 초과 count** — 별도 count callable 필요.
- **audit read log inflation** — hook 통합으로 요청 절감. 완전 제거는 캐시 dedup 필요.
- **미리보기 「최근 이벤트」 vs 「오늘 이벤트」 UX** — 이번은 「오늘」 로 통일 (KPI 와 일치).

### 커밋 규칙

**2 커밋 분리**:
1. `fix(functions): audit/list MAX_LIMIT 200 → 500 (Codex 재감사 P9)`
2. `fix(web): super_admin index.tsx useAuditLogList hook 단일화 (Codex 재감사 P9)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/codex-audit-p9-v71`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
