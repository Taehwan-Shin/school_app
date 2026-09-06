# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **audit summary callable v0.74** — Codex P11 후속 · (a) 통합 summary callable · snapshot 계약. super_admin 대시보드 조회 시 audit inflation 감소.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-summary-callable-v74`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `1a26cdd` (Codex hotfix v0.73)

## 지금 할 것 — audit.summary callable + super_admin 통합

### 왜

Codex P11: super_admin mount 시 count + list 2 requests → 각 callable 이 audit.read 기록 → 대시보드 조회 = 2 audit entries per view. Codex 권고: **(a) 통합 summary callable + snapshot 계약**.

### 계약 (Codex 권고 그대로)

- `auditLogSummary({ atMin, atMax? }) -> { count, entries: latest5, countedAt }`
- 내부: `countAuditEntries` + `readAuditEntries(limit: 5)` helper 재사용
- 인증 · `audit.read` cap · 성공 audit 기록 = callable 전체당 각 1회
- **Snapshot**: `countedAt = Date.now()` 캡처 후 두 query 모두 `atMax=countedAt` 적용
- writeAudit 은 두 query 후 → self-count 는 count 에 포함 안 됨 (명시된 snapshot 경계)
- 성공 audit target: `dashboard:super_admin` (일반 audit.read 과 구분)
- 부분 성공 없음 (통합 응답 or 통합 오류)

### 유지

기존 `auditLogList` · `auditLogCount` 는 상세 화면 등 다른 소비자 위해 그대로.

**하지 않는 것**: 별도 count callable 삭제 (다른 곳에서 필요할 수 있음). audit.read 제외 처리 (Codex (b) 기각).

### 이 과제가 바꿀 경로

**Commit 1 (backend summary callable)**:
- `packages/functions/src/callable/audit/summary.ts` — 신규 callable
- `packages/functions/src/index.ts` — export `auditLogSummary`
- `firebase.json` — hosting rewrite `/api/auditLogSummary`
- `packages/functions/tests/auditLogSummary.test.ts` — 시나리오 5~6

**Commit 2 (frontend hook + super_admin)**:
- `packages/web/src/api/auditLogSummary.ts` — fetch + useQuery hook
- `packages/web/src/routes/super_admin/index.tsx` — useAuditLogSummary 로 교체 (useAuditLogCount + useAuditLogList 2개 drop)
- `packages/web/tests/auditLogSummary.test.ts` — 시나리오 2
- `packages/web/tests/SuperAdminPage.test.tsx` — summary hook mock 반영 · 조정

**손대지 마라**:
- `auditLogList` · `auditLogCount` · `readAudit`·`countAuditEntries` — 그대로.
- 다른 라우트 · AuditLogTable · Firestore 인덱스.

### 세부 요구

#### Commit 1: `audit/summary.ts`

기존 `audit/count.ts` · `audit/list.ts` 패턴 참고. 다른 점:
- 응답: `{ count, entries, countedAt }` 통합
- Snapshot: `countedAt = Date.now()` 캡처 후 두 query 에 atMax 통일

**구조**:
```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, countAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogSummaryRequest {
  atMin?: number;
  atMax?: number;
}

export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  countedAt: number;   // ms since epoch, snapshot boundary
}

const PREVIEW_LIMIT = 5;

// readHeader 헬퍼 등 기존 패턴 그대로

export const auditLogSummary = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<AuditLogSummaryResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<AuditLogSummaryRequest> | undefined;

    // 인증 · 캡 (기존 패턴 · denied audit)
    let user;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      // ... denied audit (action='audit.read', target='dashboard:super_admin')
      throw err;
    }

    try {
      assertHasCap(user, 'audit.read');
    } catch (err) {
      // ... denied audit
      throw err;
    }

    try {
      const atMin =
        typeof data?.atMin === 'number' && Number.isFinite(data.atMin) && data.atMin > 0
          ? data.atMin
          : undefined;
      const clientAtMax =
        typeof data?.atMax === 'number' && Number.isFinite(data.atMax) && data.atMax > 0
          ? data.atMax
          : undefined;

      // Snapshot 캡처: 두 query 는 이 값 이하만 반환
      const countedAt = Date.now();
      const effectiveAtMax = clientAtMax !== undefined ? Math.min(clientAtMax, countedAt) : countedAt;

      // 두 query 는 동일 snapshot boundary 사용
      const [count, listResult] = await Promise.all([
        countAuditEntries({ atMin, atMax: effectiveAtMax }),
        readAuditEntries({ limit: PREVIEW_LIMIT, atMin, atMax: effectiveAtMax }),
      ]);

      // ok audit — 성공 후 기록 (self-count 는 이 시점 이후 → count 에 미포함)
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'ok',
        message: `summarized ${count} entries [snapshot=${new Date(countedAt).toISOString()}]`,
      });

      return {
        count,
        entries: listResult.entries,
        countedAt,
      };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: 'dashboard:super_admin',
        request_id: requestId,
        result: 'error',
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
```

**주의**:
- `Promise.all` 병렬 실행 (count + list 동시). Firestore 는 각각 별도 read → 부담 미미.
- `effectiveAtMax = Math.min(clientAtMax, countedAt)` — 클라이언트가 미래 atMax 를 보내도 snapshot 상한 강제.
- target `dashboard:super_admin` — audit log 뷰에서 대시보드 조회 event 구분 가능.

#### Commit 1 테스트

**functions `auditLogSummary.test.ts`** (5~6 시나리오):
1. 미인증 → denied audit (target=dashboard:super_admin).
2. 캡 부족 → denied audit.
3. 정상 (필터 없음) → count + entries 반환, countedAt 있음.
4. atMin 지정 → 필터 반영 count/entries.
5. entries length ≤ 5 (limit 확인).
6. writeAudit ok 는 두 query 후 호출됨 (mock 순서 확인).

`packages/functions/src/index.ts` 에 export 추가.
`firebase.json` rewrites 배열에 `/api/auditLogSummary` 추가.

#### Commit 2: frontend hook + super_admin 통합

**`packages/web/src/api/auditLogSummary.ts`**:
```ts
import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { AuditLogEntryRead } from '../types/auditLog';   // 또는 auditLogList 에서 재사용

export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  countedAt: number;
}

export interface UseAuditLogSummaryOptions {
  atMin?: number;
  atMax?: number;
}

export async function callAuditLogSummary(data: UseAuditLogSummaryOptions): Promise<AuditLogSummaryResponse> {
  // fetch to /auditLogSummary 패턴 (auditLogCount 참고)
}

export function useAuditLogSummary(options?: UseAuditLogSummaryOptions, enabled = true) {
  return useQuery<AuditLogSummaryResponse, Error>({
    queryKey: ['audit', 'summary', options?.atMin, options?.atMax],
    queryFn: () => callAuditLogSummary(options ?? {}),
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

**`super_admin/index.tsx`** — 2 hook drop, summary hook only:

기존 (v0.73):
```ts
const todayCountQuery = useAuditLogCount({ atMin: todayStartMs });
const todayCount = todayCountQuery.data?.count ?? 0;
const todayAudit = useAuditLogList(5, { atMin: todayStartMs });
```

변경:
```ts
const summaryQuery = useAuditLogSummary({ atMin: todayStartMs });
const todayCount = summaryQuery.data?.count ?? 0;
const previewEntries = summaryQuery.data?.entries ?? [];
```

**단일 loading/error 상태**:
```tsx
{summaryQuery.isLoading && (
  <div data-testid="super-admin-preview-loading">불러오는 중...</div>
)}
{summaryQuery.isError && (
  <div data-testid="super-admin-preview-error">
    감사 로그를 불러오지 못했습니다: {summaryQuery.error?.message}
  </div>
)}
{!summaryQuery.isLoading && !summaryQuery.isError && previewEntries.length > 0 && (
  <ul data-testid="super-admin-recent-events">
    {previewEntries.map((e) => ...)}
  </ul>
)}
```

**KPI**: `value={summaryQuery.isError ? '—' : todayCount}`.

**import 정리**: `useAuditLogCount`, `useAuditLogList` import 제거 (super_admin 에서만 사용중이었으면).

#### Commit 2 테스트

`packages/web/tests/auditLogSummary.test.ts` (2 신규):
1. 200 응답 → hook `data.count` · `data.entries` · `data.countedAt`.
2. 401 응답 → hook throws.

`packages/web/tests/SuperAdminPage.test.tsx`:
- mock 1 hook (useAuditLogSummary).
- KPI · preview · loading · error 각 시나리오.

기존 시나리오 회귀 유지 (특히 4 KPI · nav).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과 (`packages/functions/dist/callable/audit/summary.js` 생성).
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 638 + 신규 8~10 = 646~648 근처 (기존 SuperAdmin 조정 포함).
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - super_admin 대시보드 조회 → audit log 1 entry 만 추가 (기존 2 → 1)
   - target 이 `dashboard:super_admin` 로 구분됨
   - count · preview 하나의 상태로 표시
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **audit inflation 완전 제거** — 대시보드 조회는 여전히 audit 1건. 완전 제거는 별도 slice (audit-of-audit 제외 규칙 등).
- **snapshot 계약 UX 노출** — 「N초 전 스냅샷」 라벨 등 은 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(functions): audit.summary callable (통합 · snapshot 계약 · Codex P11)`
2. `feat(web): useAuditLogSummary hook + super_admin 통합 (Codex P11)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-summary-callable-v74`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
