# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **계정 표 UX v0.4 — 검색·정렬·페이지네이션** — UI KPI cards v0.3 (`3f2dbc0`) 위에 계정 표에 검색 인풋·컬럼 헤더 정렬·25 행 페이지네이션을 추가한다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/accounts-ux-v4`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**Designer 몫**: 이 슬라이스의 모든 스타일 값은 `docs/design/UI_SYSTEM.md` §4.5·§4.7 에 있다. 값을 그대로 옮긴다. 새 값 발명 금지.

## 기준 커밋

**Base**: `3f2dbc0` (UI KPI cards v0.3 병합 커밋)

## 지금 할 것 — 계정 표에 검색·정렬·페이지네이션

### 왜

지금 계정 표는 `useUsersList` 로 받은 데이터를 그대로 다 렌더한다. 실 워크스페이스는 수백 명 규모라 (`cam.hs.kr` 도 그렇다) 특정 사용자를 눈으로 찾기 힘들고, 한 페이지에 500+ 행이 깔리면 스크롤·타자 자동완성 모두 느려진다.

이 슬라이스가 세 가지를 한다:
1. **검색 인풋** — 이메일 또는 이름 부분 문자열로 필터 (대소문자 무시).
2. **컬럼 헤더 정렬** — Email · 이름 · 조직 단위 헤더 클릭 시 오름차순 ↔ 내림차순 ↔ 없음 토글.
3. **페이지네이션** — 25 행 단위, 이전 · 다음 버튼 + 「1–25 of 128」 라벨.

**하지 않는 것**: 새 서버 왕복. 새 API 필드. 관리자·정지 컬럼 정렬 (boolean 은 의미가 약함). 검색 자동완성. 정렬 방식 (문자열 로컬 비교 정도, `Intl.Collator` 정확도 신경 안 씀).

**KPI 카드는 필터 대상 아님** — 카드는 항상 전체 조직 요약, 표만 필터·정렬·페이지 슬라이스. 카드 클릭 → 필터된 표 링크는 이번 슬라이스 밖 (다음 슬라이스에서 판단).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — 검색·정렬·페이지 상태 (`useState`) + `useMemo` 로 필터·정렬·슬라이스. 표 위에 검색 인풋. 표 아래에 페이지네이션 로우. 헤더에 정렬 인디케이터.
- `packages/web/tests/AccountsTable.test.tsx` — **기존 테스트 유지 + 신규 UX 시나리오 5 추가** (검색 필터·정렬 토글·페이지 이동·검색 결과 페이지 리셋·빈 결과).

**신규 파일**: 없음. 순수 UX 확장.

**손대지 마라**:
- `packages/web/src/components/dashboard/*` — v0.3 결과 그대로
- `packages/web/src/components/shell/*` · `components/ui/*` — 이전 슬라이스 결과 그대로
- `packages/web/src/api/usersList.ts` — 로직 손대지 마라. `UserItem` 타입만 읽어 씀
- `packages/web/tailwind.config.js` · `src/index.css` — 이미 토큰 다 있음
- `routes/admin/index.tsx` · `CreateUserDialog.tsx` · `DeleteUserDialog.tsx` — 이 슬라이스 밖

### 세부 요구

#### 1. 검색 인풋

- 위치: 「+ 계정 추가」 버튼 옆 (표 위 상단 로우). 상단 로우가 두 줄이 되지 않게 `flex justify-between items-center gap-4`.
- 마크업:
  ```tsx
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="이메일 또는 이름으로 검색"
    aria-label="계정 검색"
    data-testid="accounts-search-input"
    className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
  />
  ```
- 필터 규칙 (`useMemo` 안):
  - `searchQuery.trim() === ''` 이면 필터 안 함.
  - 아니면 `q = searchQuery.trim().toLowerCase()`, 각 user 에 대해:
    - `user.email.toLowerCase().includes(q)` 또는
    - `(user.lastName + user.firstName).toLowerCase().includes(q)` (표시되는 fullName 규칙과 동일)
  - 위 두 중 하나라도 true 면 통과.

#### 2. 컬럼 헤더 정렬

- 정렬 상태 타입:
  ```tsx
  type SortColumn = 'email' | 'name' | 'orgUnitPath' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  ```
- 토글 규칙: 같은 컬럼 다시 클릭 → `asc` ↔ `desc`. 다른 컬럼 클릭 → 그 컬럼으로 바꾸고 `asc` 로 리셋. 정렬 해제는 이 슬라이스에서 안 함 (한 컬럼 정렬 상태 유지, `null` 은 초기값만).
- 헤더 마크업 (해당 3 개 컬럼만 이렇게, 관리자·정지·관리 는 그대로):
  ```tsx
  <TableHead
    onClick={() => handleSort('email')}
    className="cursor-pointer select-none"
    data-testid="accounts-sort-email"
    aria-sort={sortColumn === 'email' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
  >
    Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
  </TableHead>
  ```
- 정렬 함수 (`useMemo` 안, 필터 결과를 복사한 후 정렬):
  - `email` · `orgUnitPath` — 문자열 그대로 `.localeCompare`
  - `name` — `${user.lastName}${user.firstName}` 만들어서 `.localeCompare` (fullName 규칙과 동일)
  - `desc` 면 결과 반전.

#### 3. 페이지네이션

- 상태: `const [page, setPage] = useState(0);` — 0-기반.
- 상수: `const PAGE_SIZE = 25;`
- 슬라이스: `sortedFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)`
- 페이지네이션 로우 (표 아래, 표 컨테이너 밖):
  ```tsx
  <div className="flex justify-between items-center mt-4 text-small text-fg-secondary">
    <span data-testid="accounts-pagination-info">
      {total === 0 ? '결과 없음' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
    </span>
    <div className="flex gap-2">
      <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} data-testid="accounts-pagination-prev" className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">이전</button>
      <button type="button" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} data-testid="accounts-pagination-next" className="border border-border-subtle bg-canvas text-fg-primary px-4 py-2 text-small hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">다음</button>
    </div>
  </div>
  ```
- **검색 변경 시 페이지 리셋**: `useEffect(() => setPage(0), [searchQuery]);` (정렬 변경 시에는 리셋 안 함 — 사용자 관점에서 정렬은 「같은 데이터의 재배치」).

#### 4. `AccountsTable.test.tsx` 신규 시나리오 5 추가

기존 테스트 유지. 다음 5 케이스 추가:

1. **검색 필터** — 5 users, 검색어 「admin」 입력 → 표에 admin 이 포함된 행만 남음.
2. **정렬 토글** — 5 users, Email 헤더 클릭 → 오름차순 정렬. 다시 클릭 → 내림차순.
3. **페이지 이동** — 30 users (2 페이지), 「다음」 클릭 → 6~30 행 표시, 「이전」 disabled 해제 확인.
4. **검색 시 페이지 리셋** — 30 users, 「다음」 페이지로 이동 후 검색어 입력 → 페이지 0 으로 자동 리셋 확인.
5. **빈 결과** — 검색어 매칭 0 → 「결과 없음」 인디케이터 렌더, 빈 상태 메시지 (`accounts-empty` 대신 새 `data-testid="accounts-search-empty"`) 도 「검색 결과가 없습니다」 로.

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 116 + 신규 5 = 121 근처 유지.
5. dev 서버로 로컬 눈 확인 목록:
   - 계정 표 상단에 「+ 계정 추가」 우측에 검색 인풋 (256px 폭)
   - 검색어 입력 → 표가 즉시 필터, KPI 카드는 변화 없음
   - Email · 이름 · 조직 단위 헤더에 hover 시 커서 pointer, 클릭 시 정렬 인디케이터 (↑ · ↓)
   - 표 아래에 「1–25 of N」 · 「이전」 · 「다음」 로우
   - 30+ users 있으면 「다음」 활성, 「이전」 disabled (첫 페이지)
   - 다음 페이지 이동 후 검색어 입력 → 페이지 0 자동 리셋
   - 검색 결과 0 이면 「검색 결과가 없습니다」
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **`Intl.Collator` 언어 감지 정확도** — 한국어·영어 혼합 정렬 시 완벽하지 않을 수 있음, 사용자 체감 확인 필요.
- **정렬 상태 URL 반영** (`?sort=email&dir=asc`) — 라우팅 확장 필요, 이번 슬라이스 밖.
- **KPI 카드 → 필터 표 링크** — 다음 슬라이스에서 판단.
- **실 계정 조작** — 사용자 콘솔 조치 후 실측.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): 계정 표에 검색 인풋 추가 (이메일·이름 필터)`
2. `feat(web): 계정 표 컬럼 헤더 정렬 (Email·이름·조직 단위)`
3. `feat(web): 계정 표 페이지네이션 25 행 단위 + 페이지 리셋`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/accounts-ux-v4`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
