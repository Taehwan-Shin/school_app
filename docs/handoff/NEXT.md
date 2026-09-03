# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 날짜 범위 필터 v0.36** — readAudit + audit.list callable 에 `atMin?` / `atMax?` (ms) 추가 + AuditLogTable 에 시작/끝 date input + URL 동기화. 새 Firestore 인덱스 불필요 (같은 `at` 필드 range).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-date-range-v36`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `d55f879` (MembersTable UX v0.35)

## 지금 할 것 — 감사 로그 날짜 범위 필터

### 왜

`AuditLogTable` (`packages/web/src/routes/super_admin/AuditLogTable.tsx`) 은 actor·target·result 필터가 있지만 날짜 범위 필터 없음. 실 감사 워크플로 (지난 주 이벤트, 특정 사건 시점) 는 날짜 범위 필터가 필수. `at` 필드는 이미 `orderBy('at', 'desc')` 사용 + 페이지네이션 커서 `before` (at <) 사용 중. Range on same field 는 Firestore 지원 — 새 인덱스 불필요.

**하지 않는 것**: 시간 단위 (시·분) precision — 날짜 단위 (00:00:00 시작, 23:59:59 끝) 로 충분. Timezone selector — 클라이언트 로컬 (Asia/Seoul 대부분). 프리셋 (지난 7일 등) — 이 슬라이스에서는 커스텀 date input 만, 프리셋 칩은 별도 v0.37 후보.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/audit/readAudit.ts` — `ReadAuditEntriesOptions` 에 `atMin?: number` `atMax?: number` 추가 + `.where('at', '>=', ...)` `.where('at', '<=', ...)`
- `packages/functions/src/callable/audit/list.ts` — 요청에서 atMin·atMax 추출 후 readAuditEntries 로 전달 + audit message 확장
- `packages/functions/tests/readAudit.test.ts` (또는 `auditLogList.test.ts`) — 시나리오 3~4 추가
- `packages/web/src/api/auditLogList.ts` — hook 옵션에 `atMin?` `atMax?` 추가 + queryKey 포함 + fetch body 에 포함
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — 날짜 두 개 input + URL sync (`?atMin=YYYY-MM-DD&atMax=YYYY-MM-DD`)
- `packages/web/tests/AuditLogTable.test.tsx` (있으면 확장 · 없으면 신규) — 시나리오 2

**손대지 마라**:
- Firestore 인덱스 (`firestore.indexes.json`) — 새로 안 추가.
- writeAudit · UserAuditTrail · GroupAuditTrail — 그대로.
- 다른 callable · 라우트.

### 세부 요구

#### 1. `readAudit.ts` — atMin/atMax 옵션

**옵션 확장**:
```ts
export interface ReadAuditEntriesOptions {
  limit: number;
  before?: number;
  atMin?: number;    // ms since epoch, inclusive (at >= atMin)
  atMax?: number;    // ms since epoch, inclusive (at <= atMax)
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}
```

**쿼리 구성** — 기존 `before` 다음에:
```ts
if (atMin !== undefined) {
  query = query.where('at', '>=', Timestamp.fromMillis(atMin));
}
if (atMax !== undefined) {
  query = query.where('at', '<=', Timestamp.fromMillis(atMax));
}
```

**주의**:
- `at` 필드 range 는 Firestore 에서 동일 필드 여러 inequality 허용됨. `at < before AND at >= atMin AND at <= atMax` 모두 병존 가능.
- 조합 (actor + atMin+atMax) 은 기존 (actor, at DESC) 복합 인덱스로 커버됨. 새 인덱스 불필요.
- `atMin > atMax` 는 서버가 방어하지 않아도 자연적으로 0 건 반환 (에러 방지).

#### 2. `audit/list.ts` — 요청 파라미터 통과

`AuditLogListRequest` 확장:
```ts
export interface AuditLogListRequest {
  limit?: number;
  before?: number;
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}
```

**파라미터 파싱** — 기존 `before` 옆에:
```ts
const atMin =
  typeof data?.atMin === 'number' && Number.isFinite(data.atMin) && data.atMin > 0
    ? data.atMin
    : undefined;
const atMax =
  typeof data?.atMax === 'number' && Number.isFinite(data.atMax) && data.atMax > 0
    ? data.atMax
    : undefined;
```

readAuditEntries 호출 시 전달. audit ok message 는 기존 필터 스트링 뒤에 `atMin/atMax` 추가:
```ts
if (atMin) filters.push(`atMin=${new Date(atMin).toISOString()}`);
if (atMax) filters.push(`atMax=${new Date(atMax).toISOString()}`);
```

#### 3. 백엔드 테스트

**functions `readAudit.test.ts`** (또는 auditLogList.test.ts) 시나리오 3~4:

1. `atMin` 만 지정 → at >= atMin 인 항목만 반환.
2. `atMax` 만 지정 → at <= atMax 인 항목만 반환.
3. 둘 다 지정 → 범위 내 항목만.
4. actor + atMin 조합 → actor 매치 + 범위 내 항목.

기존 시나리오 회귀 유지.

#### 4. `packages/web/src/api/auditLogList.ts` — hook 옵션 확장

기존 옵션 인터페이스에 추가:
```ts
export interface UseAuditLogListOptions {
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
  atMin?: number;    // ms
  atMax?: number;    // ms
}
```

**queryKey 확장** — 옵션 전부 포함 (캐시 격리):
```ts
queryKey: ['audit', 'list', filterActor, filterTarget, filterResult, atMin, atMax],
```

**fetch body 포함** — atMin·atMax 값 있으면 request body 에 포함 (`callAuditLogList`).

#### 5. `AuditLogTable.tsx` — 날짜 input + URL sync

**URL 파라미터**:
- `?atMin=YYYY-MM-DD` → 00:00:00 로 해석 (로컬 시간대)
- `?atMax=YYYY-MM-DD` → 23:59:59.999 로 해석

**변환 유틸** (컴포넌트 안 inline):
```ts
const atMinMs = (() => {
  const raw = searchParams.get('atMin');
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d.getTime();
})();
const atMaxMs = (() => {
  const raw = searchParams.get('atMax');
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T23:59:59.999`);
  return isNaN(d.getTime()) ? undefined : d.getTime();
})();
```

hook 호출 시 전달:
```ts
useAuditLogList(25, {
  filterActor: actorFilter || undefined,
  filterResult: resultFilter !== 'all' ? resultFilter : undefined,
  atMin: atMinMs,
  atMax: atMaxMs,
});
```

**UI** — 기존 필터 로우 (actor input, result select) 옆에:
```tsx
<input
  type="date"
  value={searchParams.get('atMin') ?? ''}
  onChange={(e) => {
    const next = new URLSearchParams(searchParams);
    const v = e.target.value;
    if (v) next.set('atMin', v); else next.delete('atMin');
    setSearchParams(next, { replace: false });
  }}
  aria-label="시작 날짜"
  data-testid="audit-log-filter-atmin"
  className="border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
/>
<span className="text-fg-muted text-small" aria-hidden="true">~</span>
<input
  type="date"
  value={searchParams.get('atMax') ?? ''}
  onChange={(e) => {
    const next = new URLSearchParams(searchParams);
    const v = e.target.value;
    if (v) next.set('atMax', v); else next.delete('atMax');
    setSearchParams(next, { replace: false });
  }}
  aria-label="끝 날짜"
  data-testid="audit-log-filter-atmax"
  className="..."
/>
```

**주의**:
- URL 사용 (`{ replace: false }`) — 브라우저 뒤로 가기 사용성.
- CSV export 는 이미 `filteredEntries` 사용 → 날짜 필터도 자동 반영 (백엔드에서 이미 필터된 결과).

#### 6. 프론트엔드 테스트

**web `AuditLogTable.test.tsx`** (2 시나리오 신규 — 있으면 확장):

1. `atMin` 값 입력 → URL 이 `?atMin=YYYY-MM-DD` 로 업데이트 + hook queryKey 재호출.
2. `atMax` 값 입력 후 초기화 → URL 파라미터 제거.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 461 + 신규 6 = 467 근처.
5. `pnpm -r test:emu` — 이전 43 유지 (또는 audit range emu 시나리오 있으면 +1~2).
6. dev 서버 확인:
   - `/super_admin/audit` 시작/끝 date input 렌더
   - 날짜 선택 → URL 업데이트 + 필터된 결과 표시
   - 「더 보기」 페이지네이션 유지
   - CSV export 도 날짜 필터 반영
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **프리셋 칩 (지난 7일 · 지난 30일)** — 별도 slice (v0.37 후보).
- **timezone 처리** — 클라이언트 로컬 (Asia/Seoul) 로 해석. UTC 표시는 audit at ISO string 그대로.
- **실 Firestore range query 성능** — 사용자 확인 (인덱스 이미 있으므로 자동으로 사용됨).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(functions): audit/list 에 atMin/atMax 날짜 범위 필터 추가 + readAudit 확장`
2. `feat(web): AuditLogTable 시작/끝 날짜 input + URL 동기화`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-date-range-v36`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
