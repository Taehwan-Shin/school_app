# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 뷰어 프론트엔드 v0.10** — v0.9 백엔드 `auditLog.list` callable 을 UI 로 노출. `/super_admin/audit` 라우트, 사이드바 「감사 로그」 활성화, 표 + 「더 보기」 페이지네이션.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-log-ui-v10`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**Designer 몫**: 이 슬라이스의 모든 스타일 값은 `docs/design/UI_SYSTEM.md` §4.4 (표) · §4.5 (버튼) 에 있다. `AccountsTable.tsx` 의 표 마크업 패턴 재사용.

## 기준 커밋

**Base**: `80db339` (감사 로그 뷰어 백엔드 v0.9 병합 커밋)

## 지금 할 것 — `/super_admin/audit` 라우트 + 뷰

### 왜

v0.9 이 `auditLog.list` callable 을 놓았지만 지금 이 데이터를 볼 UI 가 없다. 사이드바에 「감사 로그」 항목은 존재하지만 `disabled=true` 로 회색 처리되어 있어 클릭 불가. 실운영에서 「누가 언제 뭘 삭제했는지」 확인이 안 되는 상태.

**이 슬라이스**: super_admin 전용 감사 로그 뷰. 표 + 「더 보기」 페이지네이션 (25 행 기본). 필터·검색·export 는 다음 슬라이스에서.

**하지 않는 것**: action·actor·target 별 필터 (다음 슬라이스). before/after 상세 diff 뷰 (message 컬럼에 요약만). CSV/JSON export (다음 슬라이스). 실시간 새로고침. admin (super_admin 아닌) 접근 허용.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/App.tsx` — 새 라우트 `/super_admin/audit` (super_admin RoleGuard).
- `packages/web/src/components/shell/nav-items.ts` — super_admin 의 「감사 로그」 항목 `disabled: false` (또는 flag 제거).
- `packages/web/tests/AppShell.test.tsx` — 사이드바 「감사 로그」 클릭 가능 회귀 테스트.

**신규 파일**:
- `packages/web/src/api/auditLogList.ts` — v0.9 callable 호출 클라이언트 (`usersList.ts` 패턴, `useMutation` 대신 `useInfiniteQuery` 또는 `useQuery` + 수동 페이지 상태).
- `packages/web/src/routes/super_admin/audit.tsx` — 감사 로그 페이지 컴포넌트.
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — 표 컴포넌트 (columns: 시간·행위자·역할·액션·대상·결과·요청 ID·메시지).
- `packages/web/tests/auditLogList.test.tsx` — API 클라이언트 시나리오 4~5.
- `packages/web/tests/AuditLogTable.test.tsx` — 표·페이지네이션 시나리오 4~5.

**손대지 마라**:
- 다른 라우트·컴포넌트 (계정·KPI 등) — 이 슬라이스 밖.
- 백엔드 (`packages/functions/*`) — v0.9 완료.

### 세부 요구

#### 1. `packages/web/src/api/auditLogList.ts` (신규)

`usersList.ts` 패턴 그대로:

```ts
export interface AuditLogEntryRead {
  id: string;
  actor: string;
  role: 'super_admin' | 'admin' | 'teacher' | 'unknown';
  action: string;
  target: string;
  request_id: string;
  result: 'ok' | 'error' | 'denied';
  at: number;
  before?: unknown;
  after?: unknown;
  message?: string;
}

export interface AuditLogListRequest {
  limit?: number;
  before?: number;
}

export interface AuditLogListResponse {
  entries: AuditLogEntryRead[];
  nextCursor: number | null;
}

export async function callAuditLogList(data: AuditLogListRequest): Promise<AuditLogListResponse> { ... }

export function useAuditLogList(initialLimit = 25) {
  // React Query useQuery + 수동 페이지 상태 유지.
  // pages 배열: { entries, cursor } 형태로 쌓기. 「더 보기」 클릭 시 next fetch.
  // 첫 페이지: before=undefined, limit=initialLimit.
  // 이후: before=nextCursor, limit=initialLimit.
}
```

**설계 선택** — TanStack Query `useInfiniteQuery` 는 정공법이지만 오버 엔지니어링. 단순히 `useState<AuditLogEntryRead[]>([])` + 「더 보기」 클릭 시 append 방식으로. 훅은 이 상태 + fetch 트리거만 노출:

```ts
export function useAuditLogList(pageSize = 25): {
  entries: AuditLogEntryRead[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
} { ... }
```

- `entries` — 누적된 항목.
- `loading` — 요청 진행 중.
- `error` — 최근 요청 오류.
- `hasMore` — 마지막 응답의 `nextCursor !== null`.
- `loadMore()` — 다음 페이지 fetch.
- `reload()` — 전체 재요청 (entries 리셋).
- 초기 로드는 `useEffect` 로 한 번.

URL: `/api/auditLogList` (prod) / `http://127.0.0.1:5001/${projectId}/asia-northeast3/auditLogList` (dev). 헤더·요청 ID 는 `usersList.ts` 그대로. `X-Google-Scopes` 는 빈 문자열 (백엔드가 scopes 안 봄).

#### 2. `packages/web/src/routes/super_admin/audit.tsx` (신규)

`AppShell` 안에 표 렌더:

```tsx
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { AuditLogTable } from './AuditLogTable';

export function AuditLogPage() {
  const { role } = useAuth();
  return (
    <AppShell role={role} pageTitle="감사 로그">
      <div className="space-y-6">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">감사 로그</h2>
            <p className="text-small text-fg-secondary mt-1">
              시스템 내 발생한 모든 관리자 행위의 감사 기록입니다. 최근 항목부터 표시됩니다.
            </p>
          </div>
          <AuditLogTable />
        </section>
      </div>
    </AppShell>
  );
}
```

#### 3. `packages/web/src/routes/super_admin/AuditLogTable.tsx` (신규)

**컬럼 정의** (좌→우):
- 시간 (`text-small font-mono` — `new Date(entry.at).toISOString()` 또는 `.toLocaleString('ko-KR')`)
- 행위자 (`text-small font-mono` — email)
- 역할 (`text-micro` — super_admin/admin/teacher/unknown, unknown 은 `text-fg-muted`)
- 액션 (`text-small font-mono` — 'users.read' 등)
- 대상 (`text-small font-mono` — email 또는 '*')
- 결과 (`text-micro font-medium` — ok=fg-primary, error=state-danger, denied=state-warning)
- 요청 ID (`text-micro font-mono text-fg-muted` — 뒤 8 자만)
- 메시지 (`text-small text-fg-secondary` — 전체 메시지, `overflow-hidden text-ellipsis` 로 한 줄)

**표 마크업** — `AccountsTable.tsx` 패턴 (Table/TableHeader/TableBody/TableRow/TableHead/TableCell). 정렬·검색 없음 (다음 슬라이스). 상단에는 간단한 로우:

```tsx
<div className="flex justify-between items-center">
  <p className="text-small text-fg-secondary">
    {entries.length}건 표시됨 · 최근 {entries.length > 0 ? new Date(entries[0].at).toLocaleDateString('ko-KR') : '-'} 까지
  </p>
  <Button variant="secondary" size="sm" onClick={reload}>새로 고침</Button>
</div>
```

**하단 「더 보기」**:
```tsx
{hasMore && (
  <div className="flex justify-center mt-4">
    <Button variant="secondary" onClick={loadMore} disabled={loading} data-testid="audit-log-load-more">
      {loading ? '불러오는 중...' : '더 보기 (25 건)'}
    </Button>
  </div>
)}
```

**빈 상태**: 「감사 로그 항목이 없습니다.」 (`text-small text-fg-secondary py-12 text-center`).
**오류 상태**: `AccountsTable` 오류 배너 패턴 (`border border-state-danger p-4 text-small text-state-danger`) 재사용.
**로딩**: 첫 로드 시 「감사 로그를 불러오는 중...」 (`text-small text-fg-secondary py-8 text-center`).

**data-testid**:
- `audit-log-loading` / `audit-log-error` / `audit-log-empty`
- `audit-log-row-{id}` (행 마다)
- `audit-log-load-more` (더보기 버튼)
- `audit-log-reload` (새로고침 버튼)

#### 4. `packages/web/src/components/shell/nav-items.ts`

super_admin 배열의 「감사 로그」 항목에서 `disabled: true` 제거. `to: '/super_admin/audit'` 그대로.

#### 5. `packages/web/src/App.tsx`

super_admin RoleGuard 안에 새 라우트 추가:

```tsx
<Route element={<RoleGuard expectedRole="super_admin" />}>
  <Route path="/super_admin" element={<SuperAdminPage />} />
  <Route path="/super_admin/audit" element={<AuditLogPage />} />
</Route>
```

`import { AuditLogPage } from './routes/super_admin/audit';` 추가.

#### 6. 테스트

**`packages/web/tests/auditLogList.test.tsx`** (신규, `useUsersList.test.tsx` 참고):
1. **not_authenticated** → throw
2. **성공** — 200 응답 파싱, `entries`·`nextCursor` 반환.
3. **403 permission-denied** → throw (한글 오류 메시지 매핑).
4. **hook 초기 로드** → `entries` 채워짐, `hasMore` 세팅.
5. **hook loadMore** — 두 번째 fetch → 첫 페이지 뒤에 append 확인.

**`packages/web/tests/AuditLogTable.test.tsx`** (신규):
1. **로딩 상태** — `useAuditLogList` mock 이 loading=true → `audit-log-loading` 렌더.
2. **정상 렌더** — 3 entries → 각 행이 `audit-log-row-{id}` 로 렌더, 컬럼 값 표시.
3. **hasMore=true** → 「더 보기」 버튼 렌더 및 클릭 시 `loadMore` 호출.
4. **hasMore=false** → 「더 보기」 버튼 없음.
5. **빈 상태** — 0 entries → `audit-log-empty` 렌더.

**`packages/web/tests/AppShell.test.tsx`** 회귀 추가:
- super_admin 사이드바에 「감사 로그」 링크가 `<a>` 로 렌더 (disabled span 아님).

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 171 + 신규 5+5+1 = 182 근처.
5. dev 서버로 로컬 눈 확인 목록:
   - super_admin 로그인 시 사이드바 「감사 로그」 클릭 가능 (회색 아님)
   - 클릭 시 `/super_admin/audit` 로 이동, 표 렌더
   - 표에 8 컬럼 (시간·행위자·역할·액션·대상·결과·요청 ID·메시지) 최신순
   - 결과 컬럼 색상 구분 (ok 검정, error 붉음, denied 주황)
   - 초기 25 건 표시 후 「더 보기」 클릭 → 다음 25 건 아래 append
   - 「새로 고침」 클릭 → 전체 재로드
   - admin/teacher 는 사이드바 「감사 로그」 여전히 안 보임 (super_admin 만)
   - admin 이 URL 직접 (`/super_admin/audit`) 로 접근 시 RootRedirect 발동
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 데이터** — 지금 audit_log 는 개발 환경에만 쌓임. Identity Platform 활성화 후 실 확인.
- **필터·검색** — 다음 슬라이스.
- **before/after diff 뷰** — 다음 슬라이스.
- **CSV/JSON export** — 다음 슬라이스.
- **실시간 새로고침** — 다음 슬라이스.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): auditLogList API 클라이언트 + hook`
2. `feat(web): AuditLogTable 컴포넌트 (표 + 더 보기)`
3. `feat(web): /super_admin/audit 라우트 + 사이드바 활성화`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/audit-log-ui-v10`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
