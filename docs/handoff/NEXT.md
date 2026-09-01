# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Groups 프론트엔드 v0.12** — v0.11 백엔드 `groups.list` callable 을 UI 로 노출. `/admin/groups` 라우트, 사이드바 「그룹」 활성화 (super_admin + admin), 그룹 목록 표.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-ui-v12`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**Designer 몫**: 스타일 값은 `AccountsTable.tsx` 표 패턴 그대로 재사용. UI_SYSTEM §4.4 표 토큰. 새 값 발명 금지.

## 기준 커밋

**Base**: `f74f849` (groups.list 백엔드 v0.11 병합 커밋)

## 지금 할 것 — `/admin/groups` 라우트 + 그룹 목록 뷰

### 왜

v0.11 이 `groups.list` callable 을 놓았지만 UI 가 없어 실사용 불가. 사이드바 「그룹」 항목이 `disabled=true` 상태. 이 슬라이스가 목록 뷰를 놓고, 그룹 CRUD (create/update/delete/members) 는 다음 슬라이스에서 순차적으로.

**하지 않는 것**: groups.create/update/delete UI (다음 슬라이스). 그룹 멤버 조회·추가·삭제 (다음 슬라이스). 검색·정렬·페이지네이션 (계정 표 v0.4-v0.6 패턴으로 다음 슬라이스). 그룹 상세 페이지 (다음 슬라이스).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/App.tsx` — 새 라우트 `/admin/groups` (super_admin + admin RoleGuard).
- `packages/web/src/components/shell/nav-items.ts` — super_admin 과 admin 의 「그룹」 항목 활성화 (super_admin 의 `to` 도 `/admin/groups` 로 통일).
- `packages/web/tests/AppShell.test.tsx` — 사이드바 「그룹」 링크 활성 회귀 테스트.

**신규 파일**:
- `packages/web/src/api/groupsList.ts` — v0.11 callable 호출 클라이언트 + `useGroupsList` hook.
- `packages/web/src/routes/admin/groups.tsx` — 그룹 페이지 (AppShell + GroupsTable).
- `packages/web/src/routes/admin/GroupsTable.tsx` — 그룹 표 컴포넌트.
- `packages/web/tests/groupsList.test.tsx` — API 클라이언트 시나리오 4~5.
- `packages/web/tests/GroupsTable.test.tsx` — 표 시나리오 4~5.

**손대지 마라**:
- 계정 관련 파일 (AccountsTable · KpiCard 등) — 이 슬라이스 밖.
- 백엔드 (`packages/functions/*`) — v0.11 완료.

### 세부 요구

#### 1. `packages/web/src/api/groupsList.ts` (신규)

`usersList.ts` 패턴 그대로:

```ts
export interface GroupItem {
  email: string;
  name: string;
  description: string;
  aliases: string[];
  directMembersCount: number;
}

export interface GroupsListResponse {
  groups: GroupItem[];
}

export async function callGroupsList(): Promise<GroupsListResponse> { /* usersList.ts 패턴 */ }

export function useGroupsList(enabled = true, options?: { retry?: number | boolean }) {
  return useQuery<GroupsListResponse, Error>({
    queryKey: ['groups', 'list'],
    queryFn: () => callGroupsList(),
    enabled,
    staleTime: 60_000,
    // 4xx 는 재시도 안 함 (denied audit 중복 방지)
    retry: options?.retry ?? ((failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    }),
  });
}
```

URL: `/api/groupsList` (prod) / `http://127.0.0.1:5001/${projectId}/asia-northeast3/groupsList` (dev).
헤더: Bearer idToken · `X-Google-Access-Token` · `X-Google-Scopes: https://www.googleapis.com/auth/admin.directory.group.readonly` · `X-Request-Id`.

#### 2. `packages/web/src/routes/admin/GroupsTable.tsx` (신규)

**컬럼**:
- 이메일 (`font-mono text-small text-fg-primary`)
- 이름 (`text-fg-primary`)
- 설명 (`text-small text-fg-secondary truncate max-w-xs`, `title=` 로 전체 표시)
- 별칭 (`text-small font-mono text-fg-secondary` — `aliases.join(', ')` 또는 빈 값이면 「-」)
- 멤버 수 (`text-right font-mono text-small text-fg-primary`)

**표 마크업** — `AccountsTable.tsx` 패턴 그대로 (Table/TableHeader/TableBody/TableRow/TableHead/TableCell). 검색·정렬·페이지네이션·KPI·다이얼로그 **없음** (다음 슬라이스).

**상태**:
- 로딩: `text-small text-fg-secondary py-8 text-center` 로 「그룹 목록을 불러오는 중...」. `data-testid="groups-loading"`
- 오류: `border border-state-danger p-4 text-small text-state-danger` 배너. `AccountsTable.tsx` 오류 매핑 (permission-denied → 「이 기능은 관리자만 사용할 수 있습니다.」, 그 외 → `그룹 목록을 불러오지 못했습니다: ${message}`). `data-testid="groups-error"`
- 빈 상태: `py-12 text-center text-small text-fg-secondary` 「등록된 그룹이 없습니다.」 `data-testid="groups-empty"`
- 정상: 표 컨테이너 `border border-border-subtle rounded-none overflow-x-auto bg-canvas`
- 각 행 `data-testid="group-row-{email}"`

**설명 셋 (섹션 상단)**:
```tsx
<p className="text-small text-fg-secondary">
  조직 내 등록된 Google Workspace 그룹 및 멤버 현황
</p>
```

액션 버튼 자리 (「+ 그룹 추가」) 는 이 슬라이스에서 **넣지 않음** — 다음 슬라이스 (groups.create) 에서.

#### 3. `packages/web/src/routes/admin/groups.tsx` (신규)

`admin/index.tsx` (AccountsPage) 패턴 참고. AppShell 안에 GroupsTable + placeholder 안내:

```tsx
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { GroupsTable } from './GroupsTable';

export function GroupsPage() {
  const { role } = useAuth();
  return (
    <AppShell role={role} pageTitle="그룹">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Workspace 그룹 목록</h2>
          </div>
          <GroupsTable />
        </section>

        <section className="bg-elevated p-8 border border-border-subtle space-y-2">
          <h2 className="text-h3 font-semibold text-fg-primary">그룹 관리 (준비 중)</h2>
          <p className="text-small text-fg-secondary">
            그룹 생성·편집·삭제·멤버 관리 자리 (다음 슬라이스).
          </p>
        </section>
      </div>
    </AppShell>
  );
}
```

#### 4. `packages/web/src/App.tsx` — 새 라우트

`/admin` 라우트 옆에 `/admin/groups` 추가 (같은 RoleGuard):

```tsx
<Route element={<RoleGuard expectedRoles={['super_admin', 'admin']} />}>
  <Route path="/admin" element={<AdminPage />} />
  <Route path="/admin/groups" element={<GroupsPage />} />
</Route>
```

`import { GroupsPage } from './routes/admin/groups';` 추가.

#### 5. `packages/web/src/components/shell/nav-items.ts` — 「그룹」 활성화

**super_admin** 배열의 「그룹」 항목:
- `to: '/super_admin/groups'` → `to: '/admin/groups'` (계정 항목이 이미 `/admin` 인 것과 동일 패턴)
- `disabled: true` **제거**

**admin** 배열의 「그룹」 항목:
- `to: '/admin/groups'` 그대로
- `disabled: true` **제거**

**teacher** 는 그룹 항목 없음 (그대로).

#### 6. 테스트

**`packages/web/tests/groupsList.test.tsx`** (신규, `useUsersList.test.tsx` 패턴):
1. **not_authenticated** → throw
2. **성공 (2 groups)** — 200 응답 파싱, `groups` 배열 반환
3. **403 permission-denied** → throw
4. **hook 로딩 상태** — 초기 `isLoading=true`, 완료 후 `data` 채워짐
5. **hook 4xx 재시도 안 함** — 403 시 `retry: false` 동작 확인

**`packages/web/tests/GroupsTable.test.tsx`** (신규, `MemoryRouter` 래퍼):
1. **로딩** — `useGroupsList` mock `isLoading=true` → `groups-loading` 렌더
2. **오류** — `isError=true, error.message='http_403'` → `groups-error` + 관리자 전용 문구
3. **빈 상태** — `data={ groups: [] }` → `groups-empty` 렌더
4. **정상 (2 그룹)** — 각 행 `group-row-{email}` 렌더, 컬럼 값 표시, aliases `join(', ')` 확인
5. **멤버 수 0** — 「0」 정수 표시 (문자열 아님)

**`packages/web/tests/AppShell.test.tsx`** 회귀:
- super_admin 사이드바 「그룹」 링크가 `<a>` 로 렌더 (disabled span 아님) + `to='/admin/groups'`.
- admin 사이드바 「그룹」 링크가 `<a>` 로 렌더.

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 202 + 신규 4+5+1 = 212 근처.
5. dev 서버로 로컬 눈 확인 목록:
   - super_admin 사이드바 「그룹」 클릭 가능 (회색 아님)
   - admin 사이드바 「그룹」 도 클릭 가능
   - 클릭 시 `/admin/groups` 로 이동, 표 렌더
   - 표에 5 컬럼 (이메일·이름·설명·별칭·멤버 수)
   - teacher 는 사이드바 「그룹」 여전히 안 보임
   - teacher 가 URL 직접 접근 → RootRedirect
   - 다크 모드 자연 전환
   - 「그룹 관리 (준비 중)」 placeholder 카드 하단 표시
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 그룹 데이터** — 실 워크스페이스 + 재로그인 필요 (v0.11 배포 노트).
- **검색·정렬·페이지네이션** — 다음 슬라이스 (계정 v0.4-v0.6 패턴 재사용).
- **KPI 카드** (총 그룹·활성 멤버 수 등) — 다음 슬라이스.
- **그룹 CRUD** — 다음 슬라이스 (v0.13+).
- **멤버 관리** — 다음 슬라이스.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): groupsList API 클라이언트 + hook`
2. `feat(web): GroupsTable + GroupsPage 컴포넌트`
3. `feat(web): /admin/groups 라우트 + 사이드바 그룹 활성화`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/groups-ui-v12`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
