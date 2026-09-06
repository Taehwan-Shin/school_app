# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **audit count callable v0.72** — Codex P9 후속. Firestore aggregation 으로 정확한 카운트, super_admin KPI 500+ 지원.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-count-callable-v72`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `941c4ed` (Codex hotfix v0.71)

## 지금 할 것 — audit.count callable + KPI 정확도

### 왜

Codex 3차 감사:
> 오늘 이벤트 수는 여전히 단일 페이지 `entries.length` 이며 서버 audit/list.ts:23 이 500 으로 clamp 하고 line 80 의 `nextCursor` 를 소비하지 않아 500 건 초과일에는 KPI 가 정확히 500 으로 고정된다; 별도 count callable 또는 전체 pagination 이 필요.

**해결**: 신규 callable `auditLogCount` (같은 필터, `entries` 없음, `count: number` 만). Firestore aggregation `count()` — 단일 호출, 데이터 안 읽음, 저비용. super_admin KPI 는 count callable, 미리보기 는 list callable (limit 5) 유지.

**하지 않는 것**: pagination 자동 소비 (별도 slice). audit log 아카이빙 (별도 slice).

### 이 과제가 바꿀 경로

**Commit 1 (backend count callable)**:
- `packages/functions/src/callable/audit/count.ts` — 신규 callable · Firestore `.count()` aggregation
- `packages/functions/src/index.ts` — export `auditLogCount`
- `firebase.json` — hosting rewrite `/api/auditLogCount`
- `packages/functions/tests/auditLogCount.test.ts` — 시나리오 5~6

**Commit 2 (frontend hook + super_admin)**:
- `packages/web/src/api/auditLogCount.ts` — fetch + useQuery hook
- `packages/web/src/routes/super_admin/index.tsx` — count hook + list hook 분리 (KPI vs preview)
- `packages/web/tests/auditLogCount.test.ts` — 시나리오 2
- `packages/web/tests/SuperAdminPage.test.tsx` — count hook 반영 · 조정

**손대지 마라**:
- `readAudit` 자체 (list 유지).
- audit/list callable · AuditLogTable · 다른 라우트.
- Firestore 인덱스.

### 세부 요구

#### Commit 1: `audit/count.ts`

기존 `audit/list.ts` 참고. 다른 점:
- 응답: `{ count: number }` (entries 없음)
- Firestore `.count()` aggregation 사용

**Query 구성**:
```ts
const db = getFirestore();
let query: FirebaseFirestore.Query = db.collection('audit_log');
if (atMin !== undefined) query = query.where('at', '>=', Timestamp.fromMillis(atMin));
if (atMax !== undefined) query = query.where('at', '<=', Timestamp.fromMillis(atMax));
if (filterActor) query = query.where('actor', '==', filterActor);
if (filterTarget) query = query.where('target', '==', filterTarget);
if (filterResult) query = query.where('result', '==', filterResult);

const snap = await query.count().get();
const count = snap.data().count;
```

**audit ok message**: `counted ${count} entries [filters]`

**인증 · 캡 · error/denied writeAudit**: audit/list.ts 패턴 그대로 (action='audit.read', target='*').

**주의**:
- Firestore admin SDK `count()` aggregation 지원 (v9.6.0+).
- 기존 인덱스 (actor+at · target+at · result+at) 그대로 사용.

#### Commit 1 테스트

**functions `auditLogCount.test.ts`** (5~6 시나리오):
1. 미인증 → denied audit.
2. 캡 부족 (teacher) → denied audit.
3. 필터 없이 → 전체 count.
4. atMin 지정 → 범위 count.
5. actor + result 조합 → 조합 count.
6. Firestore `count()` mock 반환 값 응답 확인.

Firestore mock 패턴: `db.collection().count().get() → { data: () => ({ count: N }) }`.

`packages/functions/src/index.ts` 에 export 추가.
`firebase.json` rewrites 배열에 `/api/auditLogCount` 추가.

#### Commit 2: frontend hook + super_admin

**`packages/web/src/api/auditLogCount.ts`** — `auditLogList.ts` 참고:
```ts
export interface AuditLogCountResponse { count: number; }

export interface UseAuditLogCountOptions {
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}

export async function callAuditLogCount(data: UseAuditLogCountOptions): Promise<AuditLogCountResponse> {
  // fetch to /basicDataListYears 패턴 참고, body 에 필터 spread
}

export function useAuditLogCount(options?: UseAuditLogCountOptions, enabled = true) {
  return useQuery<AuditLogCountResponse, Error>({
    queryKey: ['audit', 'count', options?.atMin, options?.atMax, options?.filterActor, options?.filterTarget, options?.filterResult],
    queryFn: () => callAuditLogCount(options ?? {}),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

**`super_admin/index.tsx`** — KPI 는 count, preview 는 list (limit 5):

기존 (v0.71):
```ts
const todayAudit = useAuditLogList(500, { atMin: todayStartMs });
const todayCount = todayAudit.entries.length;
```

변경:
```ts
const todayCountQuery = useAuditLogCount({ atMin: todayStartMs });
const todayCount = todayCountQuery.data?.count ?? 0;

// preview 는 최근 5개 → list hook (limit 5) 유지
const todayAudit = useAuditLogList(5, { atMin: todayStartMs });
```

**KpiCard loading**: `todayCountQuery.isLoading` (기존 todayAudit.loading 대신).

**preview 렌더**: `todayAudit.entries.slice(0, 5)` (변경 없음).

**주의**:
- 2 hook 재도입 → Codex P9 hook 단일화 취지 유지: 각각 다른 데이터, list limit 5 로 축소 → 부담 최소.
- audit read 부담: 이전 500 read × 1 → 이제 aggregation × 1 + 5 read × 1 = 훨씬 저비용.
- audit log 기록: 2 entries (count 조회 + list 조회).

#### Commit 2 테스트

`packages/web/tests/auditLogCount.test.ts` (2 신규):
1. 200 응답 → hook `data.count`.
2. 401 응답 → hook throws.

`packages/web/tests/SuperAdminPage.test.tsx`:
- mock 2 hook (useAuditLogCount + useAuditLogList).
- KPI count = count query, preview = list entries.

기존 시나리오 회귀 유지 (특히 4 KPI · nav).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과 (functions dist/callable/audit/count.js 생성).
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 623 + 신규 7~8 = 630 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - super_admin KPI 「오늘 이벤트」 = 실제 count (500 초과도 정확)
   - 미리보기 = 오늘 최근 5개
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **audit inflation** — 2 hook 이 각각 audit 기록 → 감사 페이지 조회 = 2 entries. 통합은 별도 slice.
- **실 Firestore count 성능** — 대규모 데이터 (10만+) 실측 필요 (aggregation 은 O(1)).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(functions): audit.count callable (Firestore aggregation · Codex P9 후속)`
2. `feat(web): useAuditLogCount hook + super_admin KPI 정확도 (Codex P9 후속)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-count-callable-v72`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
