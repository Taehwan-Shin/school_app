# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Groups 목록 UX v0.18** — GroupsTable 에 검색·정렬·페이지네이션 추가. AccountsTable v0.4 + v0.6 (URL 동기화) 패턴 그대로.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-list-ux-v18`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `39d22da` (그룹 멤버 UI v0.17)

## 지금 할 것 — Groups 목록 검색·정렬·페이지네이션

### 왜

`AccountsTable` 은 v0.4~v0.6 슬라이스로 검색·정렬·페이지네이션 + URL 동기화가 완성됐지만 `GroupsTable` 은 아직 페이지네이션·정렬·검색 모두 없음. 그룹이 많은 조직 (수십~수백 그룹) 에서 그룹 찾기 어려움. 이 슬라이스가 accounts 와 동일 패턴 적용.

**하지 않는 것**: KPI 카드 (별도 slice). 필터 링크 카드 (accounts v0.5 유사, 별도 slice). URL sort/search 를 백엔드로 반영 (전부 클라이언트 사이드).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/GroupsTable.tsx` — 검색 인풋·정렬 상태·페이지네이션 로직 추가. `useSearchParams` 로 URL 동기화 (accounts v0.6 패턴).
- `packages/web/tests/GroupsTable.test.tsx` — 신규 UX 시나리오 5.

**신규 파일**: 없음.

**손대지 마라**:
- API 클라이언트 · 다이얼로그 · MembersTable · GroupDetailPage — v0.17 결과 그대로.
- 백엔드 (`packages/functions/*`).
- accounts 관련 파일.

### 세부 요구

`AccountsTable.tsx` (커밋 `73b6205` v0.6 병합 결과) 의 검색·정렬·페이지네이션·URL 동기화 로직을 `GroupsTable.tsx` 에 그대로 옮긴다. 다른 점만 아래:

#### 1. 검색 필터 규칙

`AccountsTable` 은 email + fullName 검색. `GroupsTable` 은:
- `groupEmail.toLowerCase().includes(q)` 또는
- `group.name.toLowerCase().includes(q)` 또는
- `group.description.toLowerCase().includes(q)`

셋 중 하나라도 매치되면 통과.

#### 2. 정렬 컬럼

`AccountsTable` 은 email/name/orgUnitPath 3 컬럼. `GroupsTable` 은:
- `email` — `group.email.localeCompare`
- `name` — `group.name.localeCompare`
- `directMembersCount` — 숫자 비교 (`a.directMembersCount - b.directMembersCount`)

`description` 과 `aliases` 컬럼은 정렬 안 함.

#### 3. 페이지네이션

`PAGE_SIZE = 25` 그대로. `AccountsTable` 과 동일 마크업.

#### 4. URL 파라미터

`AccountsTable` 이 사용하는 것: `filter` (KPI 필터), `q` (검색어), `sort` (컬럼), `dir` (방향).

`GroupsTable` 은 `filter` 없음 (KPI 카드 v0.19 slice 에서). 나머지 3 파라미터만 반영:
- `q` — 검색어, replace: true
- `sort` — email/name/directMembersCount
- `dir` — asc/desc

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 338 + 신규 5 = 343 근처.
5. dev 서버 확인:
   - `/admin/groups` 상단에 검색 인풋 + 「+ 그룹 추가」 나란히
   - Email/이름/멤버 수 헤더 클릭 시 정렬 (↑↓ 인디케이터)
   - 표 아래 「1–25 of N」 + 이전/다음
   - 검색·정렬 시 URL 갱신 (`?q=...&sort=name&dir=asc`)
   - 브라우저 새로고침 시 상태 복원
   - 25 명 초과 그룹 없이 「더 보기」 안 뜸 (별도 페이지 없음)
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **KPI 카드** (총 그룹·활성 등) — 별도 slice v0.19.
- **필터 링크 (KPI → 필터)** — v0.19.
- **한글 정렬 정확도** — `Intl.Collator` 기본, 실사용자 체감 후.
- **실 워크스페이스 실측** — 사용자 배포 후.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): GroupsTable 검색 인풋 (이메일·이름·설명 필터)`
2. `feat(web): GroupsTable 컬럼 정렬 (email·name·directMembersCount)`
3. `feat(web): GroupsTable 페이지네이션 + URL 동기화 (accounts v0.6 패턴)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/groups-list-ux-v18`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
