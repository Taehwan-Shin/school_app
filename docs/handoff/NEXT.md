# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **검색·정렬 URL 동기화 v0.6** — KPI 필터 링크 v0.5 (`858e967`) 위에 검색어와 정렬 상태도 URL 쿼리 파라미터로 반영해 뷰 상태 전체를 공유 가능한 링크로 만든다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/url-sync-v6`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

## 기준 커밋

**Base**: `858e967` (KPI 필터 링크 v0.5 병합 커밋)

## 지금 할 것 — 검색어·정렬 상태의 URL 반영

### 왜

v0.5 가 KPI 필터를 URL 쿼리 (`?filter=admin`) 로 반영했다. 지금 검색어 (`searchQuery`) 와 정렬 상태 (`sortColumn`·`sortDirection`) 는 컴포넌트 로컬 `useState` 로만 존재해서 페이지 새로고침 시 사라지고 URL 로 공유할 수도 없다.

이 슬라이스가 세 가지를 한다:
1. **검색어 URL 반영** — 입력 시 `?q=<검색어>` 로. 빈 문자열이면 파라미터 삭제.
2. **정렬 상태 URL 반영** — 헤더 클릭 시 `?sort=email&dir=asc` 등으로. 초기 정렬 없으면 파라미터 없음.
3. **URL → 초기 상태 복원** — 페이지 로드 시 URL 쿼리에서 읽어 상태 초기화.

이렇게 되면 「관리자 정지된 계정 이메일 오름차순 검색어 '홍'」 같은 뷰 상태 전체가 `?filter=admin&q=홍&sort=email&dir=asc` 한 링크로 공유 가능해진다.

**하지 않는 것**: 페이지 번호 URL 반영 (페이지는 데이터셋에 따라 유효 범위가 바뀌므로 URL 상태로 두면 오히려 혼란). 필터 · 검색 · 정렬 값 검증 (미지 값은 자연히 매칭 없음). URL history entry 전략 (일단 `setSearchParams` 기본).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — `useState` 로 관리하던 `searchQuery`·`sortColumn`·`sortDirection` 을 `useSearchParams` 로 대체. `handleSort` · 검색 인풋 `onChange` 가 `setSearchParams` 호출하도록.
- `packages/web/tests/AccountsTable.test.tsx` — 신규 URL 시나리오 3 추가. 기존 테스트 유지.

**신규 파일**: 없음.

**손대지 마라**:
- `packages/web/src/components/dashboard/*` — v0.5 결과 그대로
- 다른 라우트 · 컴포넌트 · API — 이 슬라이스 밖

### 세부 요구

#### 1. `AccountsTable.tsx` 상태 이관

**교체 전**:
```tsx
const [searchQuery, setSearchQuery] = useState("");
const [sortColumn, setSortColumn] = useState<SortColumn>(null);
const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
const [searchParams] = useSearchParams();
const kpiFilter = searchParams.get('filter');
```

**교체 후**:
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const kpiFilter = searchParams.get('filter');
const searchQuery = searchParams.get('q') ?? '';
const sortColumn: SortColumn = (() => {
  const raw = searchParams.get('sort');
  return raw === 'email' || raw === 'name' || raw === 'orgUnitPath' ? raw : null;
})();
const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
```

**검색 인풋 onChange**:
```tsx
onChange={(e) => {
  const next = new URLSearchParams(searchParams);
  const v = e.target.value;
  if (v) next.set('q', v); else next.delete('q');
  setSearchParams(next, { replace: true });
}}
```
- **주의**: `replace: true` — 검색은 타이핑마다 URL 이 바뀌므로 히스토리에 매번 항목을 남기지 않게 replace. KPI 필터·정렬은 명시적 클릭이므로 `replace: false` (v0.5 규칙 그대로) 유지.

**handleSort 재작성**:
```tsx
const handleSort = (column: 'email' | 'name' | 'orgUnitPath') => {
  const next = new URLSearchParams(searchParams);
  if (sortColumn === column) {
    // 같은 컬럼: 방향 토글
    next.set('dir', sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
    // 다른 컬럼: 그 컬럼으로 asc
    next.set('sort', column);
    next.set('dir', 'asc');
  }
  setSearchParams(next, { replace: false });
};
```

**페이지 리셋 useEffect 트리거 확장**:
```tsx
useEffect(() => {
  setPage(0);
}, [searchQuery, kpiFilter, sortColumn, sortDirection]);
```
- 정렬 변경 시에도 페이지 0 으로 리셋 (v0.4 는 정렬 변경 시 유지였지만, URL 이 다뤄지는 지금은 뷰 상태 변경으로 통일).

#### 2. `AccountsTable.test.tsx` 신규 시나리오 3

기존 14 유지. 다음 3 추가 (`MemoryRouter` 로 초기 경로 지정):

1. **URL q=홍 초기 로드** — `initialEntries={['/admin?q=홍']}` + 5 users (하나만 lastName='홍') → 표에 홍씨 1 명만.
2. **URL sort=email&dir=desc 초기 로드** — `initialEntries={['/admin?sort=email&dir=desc']}` + 5 users → 이메일 내림차순 정렬 상태로 렌더. `aria-sort="descending"` 확인.
3. **검색 인풋 입력 → URL 반영** — 초기 `/admin`, 입력 「관리」 → `history.location.search` 에 `q=관리` 확인 (테스트에서 `useLocation` mock 이나 `window.location.search` 관찰). 실제로는 `MemoryRouter` 이므로 `useLocation` hook 을 노출하는 헬퍼로 관찰:
   ```tsx
   let capturedSearch = '';
   function LocationSpy() {
     const location = useLocation();
     capturedSearch = location.search;
     return null;
   }
   // render(<MemoryRouter><LocationSpy /><AccountsTable /></MemoryRouter>);
   ```

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 127 + 신규 3 = 130 근처 유지.
5. dev 서버로 로컬 눈 확인 목록:
   - `/admin` 에서 검색어 입력 → 주소창 URL 이 즉시 `?q=...` 로 바뀜
   - Email 헤더 클릭 → 주소창 `?sort=email&dir=asc` (또는 기존 필터와 병합)
   - 다시 Email 클릭 → `?sort=email&dir=desc` 방향 토글
   - 이름 헤더 클릭 → `?sort=name&dir=asc` 새 컬럼
   - 브라우저 새로고침 → 검색어·정렬·KPI 필터 상태 그대로 복원
   - URL 을 복사해 새 탭에 붙여넣기 → 같은 뷰 상태
   - 뒤로 가기 (KPI 필터·정렬은 히스토리 항목, 검색어는 replace 라 스킵) → 필터·정렬 이전 상태로
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **필터 URL 값 검증** — `?filter=xyz` 미지 값은 자연히 매칭 없음, 별도 에러 처리 안 함.
- **다중 필터 URL** — 카드 하나만 활성이라는 v0.5 규칙 유지.
- **페이지 번호 URL** — 이번 슬라이스 밖 (데이터셋 크기와 페이지 유효 범위 관계로 복잡).
- **정렬 방향 asc/desc 외 값** — 다른 값은 무시하고 asc 로.
- **실 계정 조작** — 사용자 콘솔 조치 후 실측.

### 커밋 규칙

**3 커밋 분리**:
1. `refactor(web): AccountsTable 검색어 상태를 URL 쿼리로 이관`
2. `refactor(web): AccountsTable 정렬 상태를 URL 쿼리로 이관`
3. `test(web): URL 초기 로드·검색 반영 시나리오 3 추가`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/url-sync-v6`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
