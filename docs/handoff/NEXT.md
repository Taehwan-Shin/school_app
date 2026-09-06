# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex 4차 감사 hotfix v0.73** — P10 direct audit 접근 제거 (countAuditEntries helper) + P12 preview loading/error 상태 노출.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/codex-audit-p10-p12-v73`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `b4b5bec` (audit count callable v0.72)

## 지금 할 것 — P10 + P12 hotfix

### 왜

Codex 4차 감사 실패 3건 중 2건 (P11 은 v0.74 별도):

**P10 direct audit 접근** (`packages/functions/src/callable/audit/count.ts:92`):
> callable 이 `getFirestore().collection("audit_log")` 에 직접 접근하고 eslint 규칙까지 국소 해제해 상설 규약인 audit log 직접 접근 금지를 위반한다; aggregation 을 `readAudit` 계층의 `countAuditEntries` helper 로 이동해야 한다.

**정확한 지적**. 상설 규약 위반. `readAudit.ts` 에 `countAuditEntries` 추가.

**P12 preview loading/error 무시** (`packages/web/src/routes/super_admin/index.tsx:24`):
> count 오류를 `0` 으로 표시하고 preview 도 count 만으로 렌더링해 list loading/error 를 무시하므로 count 성공·list 지연 시 빈 목록, list 실패 시 영구 빈 목록이 보인다.

**해결**: preview 렌더링에 `todayAudit.loading` · `todayAudit.error` 상태 각각 UI 표시.

**하지 않는 것**: P11 audit inflation 통합 callable (v0.74 별도 — 아키텍처 결정 필요).

### 이 과제가 바꿀 경로

**Commit 1 (P10 helper extraction)**:
- `packages/functions/src/audit/readAudit.ts` — `countAuditEntries` helper 신설 (같은 필터 옵션)
- `packages/functions/src/callable/audit/count.ts` — helper 사용 · direct Firestore 접근 제거 · eslint disable 제거
- `packages/functions/tests/readAudit.test.ts` — countAuditEntries 시나리오 3
- `packages/functions/tests/auditLogCount.test.ts` — 기존 시나리오 회귀 유지

**Commit 2 (P12 loading/error 상태)**:
- `packages/web/src/routes/super_admin/index.tsx` — preview 섹션 loading/error 각각 처리
- `packages/web/tests/SuperAdminPage.test.tsx` — 시나리오 2 (list loading · list error)

**손대지 마라**:
- P11 audit inflation (v0.74).
- 다른 라우트 · 백엔드 callable · Firestore 인덱스.

### 세부 요구

#### Commit 1: `countAuditEntries` helper

**`packages/functions/src/audit/readAudit.ts`** 확장:

```ts
export interface CountAuditEntriesOptions {
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}

export async function countAuditEntries(options: CountAuditEntriesOptions): Promise<number> {
  const db = getFirestore();
  const { atMin, atMax, filterActor, filterTarget, filterResult } = options;

  let query: FirebaseFirestore.Query = db.collection('audit_log');
  if (atMin !== undefined) query = query.where('at', '>=', Timestamp.fromMillis(atMin));
  if (atMax !== undefined) query = query.where('at', '<=', Timestamp.fromMillis(atMax));
  if (filterActor) query = query.where('actor', '==', filterActor);
  if (filterTarget) query = query.where('target', '==', filterTarget);
  if (filterResult) query = query.where('result', '==', filterResult);

  const snap = await query.count().get();
  return snap.data().count;
}
```

**`packages/functions/src/callable/audit/count.ts`** 리팩터:

기존 (`count.ts` 안 line 92 근처):
```ts
// eslint-disable-next-line no-restricted-imports
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
...
const db = getFirestore();
let query = db.collection('audit_log');
if (atMin !== undefined) query = query.where('at', '>=', Timestamp.fromMillis(atMin));
...
const snap = await query.count().get();
const count = snap.data().count;
```

변경:
```ts
import { countAuditEntries } from '../../audit/readAudit.js';
...
const count = await countAuditEntries({ atMin, atMax, filterActor, filterTarget, filterResult });
```

**eslint disable 제거**. 기존 `getFirestore`/`Timestamp` import 도 제거 (readAudit 에서 처리).

#### Commit 1 테스트

**`packages/functions/tests/readAudit.test.ts`** (3 신규 시나리오):
1. filterActor 만 → count 정확.
2. atMin + result → count 정확.
3. 빈 컬렉션 → count 0.

**`packages/functions/tests/auditLogCount.test.ts`** — 기존 mock 을 helper 사용에 맞게 조정 (특히 `db.collection('audit_log').count().get()` mock 을 readAudit 안 count 로 이동).

#### Commit 2: P12 preview 상태 노출

**`packages/web/src/routes/super_admin/index.tsx`** — 「최근 이벤트」 섹션 확장:

기존:
```tsx
{todayCount > 0 && (
  <ul>
    {todayAudit.entries.slice(0, 5).map((e) => ...)}
  </ul>
)}
```

변경:
```tsx
{todayAudit.loading && (
  <div className="py-4 text-center text-small text-fg-secondary" data-testid="super-admin-preview-loading">
    미리보기 불러오는 중...
  </div>
)}
{todayAudit.error && !todayAudit.loading && (
  <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="super-admin-preview-error">
    미리보기를 불러오지 못했습니다: {todayAudit.error.message}
  </div>
)}
{!todayAudit.loading && !todayAudit.error && todayAudit.entries.length > 0 && (
  <ul className="space-y-2" data-testid="super-admin-recent-events">
    {todayAudit.entries.slice(0, 5).map((e) => ...)}
  </ul>
)}
```

**KPI count 오류 표시도 조정** (기존 count.data?.count ?? 0 → count error 시 「—」):
```tsx
<KpiCard
  label="오늘 이벤트"
  value={todayCountQuery.isError ? '—' : todayCount}
  loading={todayCountQuery.isLoading}
  ...
/>
```

**주의**:
- 기존 「최근 24시간에 이벤트가 없습니다」 문구도 조건 재검토 (loading·error 아닐 때만).
- data-testid 규칙: `super-admin-preview-loading`, `super-admin-preview-error`, 기존 `super-admin-recent-events` 유지.

#### Commit 2 테스트

`packages/web/tests/SuperAdminPage.test.tsx` (2 신규):
1. useAuditLogList mock loading=true → `super-admin-preview-loading` 렌더.
2. useAuditLogList mock error → `super-admin-preview-error` 렌더.

기존 회귀 유지 (KPI count 표시, 4 nav 시나리오).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과 (eslint disable 제거해도 통과).
4. `pnpm -r test` — 이전 633 + 신규 5 = 638 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - super_admin count/list loading 상태 표시
   - list error 시 미리보기 오류 표시
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **P11 audit inflation** — v0.74 별도 (아키텍처 결정: 통합 callable vs 예외 처리 vs 수용).

### 커밋 규칙

**2 커밋 분리**:
1. `refactor(functions): countAuditEntries helper 추출 (audit direct 접근 제거 · Codex P10)`
2. `fix(web): super_admin preview list loading/error 상태 노출 (Codex P12)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/codex-audit-p10-p12-v73`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
