# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **MembersTable UX v0.35** — 그룹 상세 페이지 멤버 표에 검색 (이메일) + 역할 필터 칩 (전체·OWNER·MANAGER·MEMBER). 클라이언트 사이드.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/members-ux-v35`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `94ebf60` (CSV 내보내기 v0.34)

## 지금 할 것 — MembersTable 검색 + 역할 필터 칩

### 왜

MembersTable (`packages/web/src/routes/admin/MembersTable.tsx:21-`) 은 지금 필터·검색 없음. 큰 그룹 (수십·수백 명) 은 스크롤 원자를 요구. AccountsTable 은 이미 검색 + KPI 필터 있음 (`packages/web/src/routes/admin/AccountsTable.tsx`) — 같은 UX 그대로 축약해 적용.

**하지 않는 것**: URL 동기화 (그룹 상세 페이지 자체가 URL 파라미터 사용 중, `?q=` `?role=` 는 v0.36 후보). 서버 사이드 페이지네이션 (지금 데이터 규모 문제 없음). 정렬 (별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/MembersTable.tsx` — 검색 input + 역할 필터 칩 + 클라이언트 필터 로직
- `packages/web/tests/MembersTable.test.tsx` — 시나리오 3 추가 (검색 · 역할 칩 · 빈 결과)

**손대지 마라**:
- `useGroupMembersList` hook — 그대로 (전체 로드 후 클라이언트 필터).
- `AddMemberDialog` · `RemoveMemberDialog` · `EditMemberRoleDialog` — 그대로.
- MembersTable 의 CSV export 는 이 슬라이스 밖 (v0.36 후보).

### 세부 요구

#### 1. MembersTable state

```ts
const [searchQuery, setSearchQuery] = useState('');
const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'MANAGER' | 'MEMBER'>('ALL');
```

#### 2. 필터 로직

`members` 배열을 useMemo 로 필터:
```ts
const filteredMembers = useMemo(() => {
  let result = members;
  if (roleFilter !== 'ALL') {
    result = result.filter((m) => m.role === roleFilter);
  }
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((m) => m.email.toLowerCase().includes(q));
  }
  return result;
}, [members, searchQuery, roleFilter]);
```

#### 3. UI 변경

기존 상단 `<div>{members.length}명 멤버 + 「+ 멤버 추가」</div>` 를 확장:

```tsx
<div className="space-y-4">
  {/* 상단 요약 + 액션 */}
  <div className="flex justify-between items-center gap-4">
    <p className="text-small text-fg-secondary">
      {filteredMembers.length !== members.length
        ? `${filteredMembers.length}명 표시됨 / 전체 ${members.length}명`
        : `${members.length}명 멤버`}
    </p>
    <Button onClick={() => setIsAddOpen(true)} data-testid="add-member-btn">
      + 멤버 추가
    </Button>
  </div>

  {/* 필터 로우 */}
  <div className="flex items-center gap-3 flex-wrap">
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="멤버 이메일 검색"
      aria-label="멤버 검색"
      data-testid="members-search-input"
      className="w-64 border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
    />
    <div className="flex items-center gap-2" role="group" aria-label="역할 필터">
      {(['ALL', 'OWNER', 'MANAGER', 'MEMBER'] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRoleFilter(r)}
          data-testid={`members-role-chip-${r}`}
          className={cn(
            'px-3 py-1 text-small border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
            roleFilter === r
              ? 'bg-fg-primary text-canvas border-fg-primary'
              : 'bg-canvas text-fg-primary border-border-subtle hover:border-border-strong',
          )}
        >
          {r === 'ALL' ? '전체' : r}
        </button>
      ))}
    </div>
  </div>
  {/* ... 기존 loading/error/empty/table 렌더 (아래) */}
</div>
```

#### 4. Table 렌더 데이터 소스

기존 `members.map` 를 `filteredMembers.map` 로 교체.

빈 상태 조건:
- 전체 `members.length === 0` → 기존 「멤버가 없습니다」 (그대로)
- 필터 적용 후 `filteredMembers.length === 0` && `members.length > 0` → 신규 「검색 결과 없음」:
  ```tsx
  {!loading && !error && members.length > 0 && filteredMembers.length === 0 && (
    <div className="py-12 text-center text-small text-fg-secondary" data-testid="members-search-empty">
      검색·필터에 맞는 멤버가 없습니다.
    </div>
  )}
  ```
  그리고 기존 `{!loading && !error && members.length === 0 && ...}` 는 그대로.

#### 5. 테스트

**web `MembersTable.test.tsx`** (3 신규 시나리오 — 기존 6 유지):

1. **검색 필터**: 3 명 로드 → `members-search-input` 에 `alice@` 입력 → alice 만 렌더, 나머지 2 명 렌더 안 됨.
2. **역할 칩**: 3 명 로드 (OWNER 1 · MANAGER 1 · MEMBER 1) → `members-role-chip-OWNER` 클릭 → OWNER 만 렌더.
3. **필터 빈 결과**: 3 명 로드 → 존재 안 하는 검색어 입력 → `members-search-empty` 표시.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 458 + 신규 3 = 461 근처.
5. `pnpm -r test:emu` — 이전 43 유지.
6. dev 서버 확인:
   - `/admin/groups/{email}` 멤버 관리 섹션 필터 UI 렌더
   - 이메일 검색 → 즉시 필터
   - 역할 칩 클릭 → 해당 역할만 표시
   - 필터 조합 (검색 + 역할) 도 정상
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **역할 칩 카운트 (「OWNER 3 · MANAGER 5 · MEMBER 20」)** — 이 슬라이스 밖. 별도 KPI 요구 시 v0.36.
- **URL 동기화 (?q= / ?role=)** — 별도 slice.
- **MembersTable CSV export** — 별도 slice (v0.36 후보).

### 커밋 규칙

**1 커밋**:
- `feat(web): MembersTable 검색 + 역할 필터 칩 (클라이언트 사이드)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/members-ux-v35`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
