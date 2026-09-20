# NEXT.md - 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.192 병합 완료** (`53ca8b1`) - CreateGroup + CreateClassroom + TransferClassroomOwner 세 dialog local-part 64자 카운터 이식 · 기계 관문 (lint clean · web 1102 유닛). **v0.191** (`c903a86`) - BulkTransferClassroomOwner local-part 카운터 + emailInput helper 확장.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `53ca8b1` v0.192 - CreateGroupDialog · CreateClassroomDialog · TransferClassroomOwnerDialog 세 dialog 에 v0.181/v0.191 대칭 local-part 64자 카운터 이식 · 각 dialog 특수 미노출 조건 (빈 값 · CreateClassroom 은 「me」 도 미노출) · 6 회귀 · 웹 1102 (+6) · lint clean · 서버 무변경. **Local-part 카운터 시리즈 완결** (v0.181/v0.191/v0.192 총 5 dialog).
- `c903a86` v0.191 - BulkTransferClassroomOwnerDialog local-part 64자 카운터 + emailInput.ts 확장 (`EMAIL_LOCAL_PART_MAX` 상수 · `extractEmailLocalPart` helper) · 4 회귀 · 웹 1096 (+4).
- `7fe90a7` v0.190 - BulkRenameClassroomDialog 각 row input 밑에 v0.180 스타일 실시간 카운터 (`mt-1 text-small` conditional-danger, 「N / 750 자」) · 기존 tooLong warn 은 유지 · 1 회귀 · 웹 1092 (+1) · lint clean · 서버 무변경.
- `7e03374` v0.189 - RenameClassroomDialog 에 shared `COURSE_NAME_MAX` / `COURSE_SECTION_MAX` import (v0.175 재사용) · hardcoded 상수 alias 로 유지 · name/section input 밑에 v0.180 스타일 카운터 신규 (「N / MAX 자」) · 2 회귀 · 웹 1091 (+2) · lint clean · 서버 무변경.
- `052d0d3` v0.188 - CreateClassroomDialog name(750)/section(2800)/room(650) 세 필드에 v0.180 스타일 카운터 신규 추가 · description(30000) 카운터 옛 스타일 (`text-micro` + `text-red-600` + 「현재」 prefix) 을 통일 (`text-small` + `text-state-danger` + prefix 제거) · 4 회귀 (v0.188 describe) · 웹 1089 (+4) · lint clean · 서버 무변경.
- `971a90f` v0.187 - CreateGroupDialog + EditGroupDialog description counter 통일 · `mt-1 text-small ${description.length > MAX ? 'text-state-danger' : 'text-fg-muted'}` · 「현재 N / 4096 자」 → 「N / 4096 자」 · 4 회귀 (v0.187 describe: 각 dialog 「4096 이내 muted + 텍스트 포맷」 · 「4097 초과 red」) · 웹 1085 (+4) · lint clean · 서버 무변경.
- `69044f1` v0.186 - AuditLogTable handleExportJson 에 `sourceQuery` (`?<params>` 또는 빈 문자열) + `sourcePath` (`/super_admin/audit${sourceQuery}`) 필드 추가 · export 파일만 들고 다른 세션/기기에서 동일 조회를 재현 가능 · 2 회귀 (빈 URL · action+result 필터 URL) · 웹 1081 (+2) · lint clean · 서버 무변경.
- `3bb8ff9` v0.185 - 신규 `lib/orgUnitLimits.ts` (`ORG_UNIT_NAME_MAX = 100`, Google Admin SDK Directory OrgUnit 규격) · CreateUserDialog 「새 OU 만들기」 폼 hardcoded 100 → 상수 참조 + input 밑 「N / 100 자」 카운터 (초과 시 red) + 상세 에러 (현재 N자 포함) · BatchCreateUsersDialog 「새 OU 만들기」 폼 동일 이식 (대칭) · 5 회귀 (orgUnitLimits helper 1 · CreateUser v0.185 2 · Batch v0.185 2) · 웹 1079 (+5) · lint clean · 서버 무변경.
- `34240a3` v0.184 - BasicDataPanel 헤더 버튼 9개를 `role="group" aria-label="..."` 세 그룹으로 시각 분리 (좌측 border) · 편집 그룹 (편집 · 학생 명단 편집) · 자동 워크플로우 그룹 (그룹 자동 생성 · 부서 그룹 자동 생성 · 학생 자동 초대 · 반 챗방 자동 초대 · 명단 밖 자동 제거) · 데이터 입출력 그룹 (JSON 불러오기 · JSON 내보내기) · 「명단 밖 자동 제거」 를 자동 그룹 마지막으로 (파괴적 액션 뒤로 재정렬) · 기존 testid 모두 유지 (16 회귀 무영향) + 3 신규 회귀 · 웹 1074 (+3) · lint clean · 서버 무변경.
- `0211e6c` v0.183 - SuperAdminPage breakdown 위젯 header 에 CSV/JSON 두 버튼 추가 · CSV 컬럼 (action,count) · JSON payload (exportedAt · window · windowLabel · atMin · source ('exact'|'sample') · sampleTruncated · sampleSize · breakdownCount · totalActions · actions[]) · 파일명 breakdown-<slug>-YYYY-MM-DD (slug: today/week/month/last{N}days) · displayCounts undefined/empty 이면 disabled + title 안내 · 3 회귀 (enabled+파일명, empty disabled, JSON exact 우선/정렬) · 웹 1071 (+3) · lint clean · 서버 무변경.
- `6c60b80` v0.182 - NeisCsvImportDialog preview 단계에 courseName > `COURSE_NAME_MAX` (750) 감지 · 신규 순수 helper `findOverlyLongPlanRows(plan, max)` (회귀 4건) · preview 상단 red 배너 「상한 초과 N개 행 — 실행 불가」 · 초과 row 는 셀 red + 「N / 750 자 초과」 접미사 · 실행 버튼 disabled + title 안내 · 웹 1068 (+4) · lint clean · 서버 무변경.
- `534c05f` v0.181 - `lib/userLimits.ts` 에 `USER_LOCAL_PART_MAX = 64` (RFC 5321 · Google Workspace 규격) 추가 · CreateUserDialog handleSubmit 에 email.slice(0, lastIndexOf('@')) local-part 길이 검증 · 이메일 input 밑 「이메일 아이디 N / 64 자」 실시간 카운터 (@ 없이도 로컬로 간주 · 초과 시 red) · 4 회귀 (userLimits 1 신규 · CreateUser v0.181 3) · 웹 1064 (+4) · lint clean · 서버 무변경. CreateGroup/BatchCreate 는 이미 `lib/emailInput.ts` LOCAL_PART_RE (`{0,63}`) 로 강제 → CreateUser 만 남았던 gap 커버.
- `c4aba5e` v0.180 - `lib/groupLimits.ts` 에 `GROUP_NAME_MAX = 60` 추가 (Workspace Directory `groups.name` 규격) · CreateGroupDialog handleSubmit 검증 + input 밑 「N / 60 자」 실시간 카운터 · EditGroupDialog 동일 · 6 회귀 (groupLimits 1 · CreateGroup v0.180 2 · EditGroup v0.180 3) · 웹 1060 (+6) · lint clean · 서버 무변경.
- `f54f3a9` v0.179 - EditUserDialog 에 shared `USER_FAMILY_NAME_MAX` / `USER_GIVEN_NAME_MAX` (60자) 이식 · handleSubmit 검증 (v0.178 문구 대칭) · 각 input 밑 「N / 60 자」 실시간 카운터 (`edit-user-familyName-counter` · `edit-user-givenName-counter` · 초과 시 red) · 4 회귀 테스트 (v0.179 describe: family 초과 · given 초과 · 카운터 실시간 · 60자 경계) · 웹 1054 (+4) · lint clean · 서버 무변경. Create/Batch/Edit 3 진입점 이름 상한 완전 대칭.
- `fd88dbb` v0.178 - Google Directory User `name.familyName` / `name.givenName` 각 60자 상한 이식 · 신규 `lib/userLimits.ts` (USER_FAMILY_NAME_MAX=60 · USER_GIVEN_NAME_MAX=60) · CreateUserDialog handleSubmit 검증 + input 밑 「N / 60 자」 실시간 카운터 (초과 시 red) · BatchCreateUsersDialog handleConfirm row loop 검증 + 각 row aria-invalid + red border + inline warn + 하단 「이름 상한 초과 N개 행」 summary (v0.176 BulkRename 패턴) · 9 회귀 테스트 (userLimits 2 · CreateUser v0.178 4 · Batch v0.178 3) · 웹 1050 (+9) · lint clean · 서버 무변경.
- `dca5db0` v0.177 - ClassroomTable 툴바에 CSV/JSON 두 export 버튼 추가 (필터 초기화 옆). CSV 컬럼 (id · 이름 · 섹션 · 상태 · 설명 · 링크 · 소유자 id · 생성/수정 시각) · JSON payload (exportedAt · scope · filters · totalCount · courses[]) · 파일명 classrooms-YYYY-MM-DD.csv|json (선택 있으면 -selected 접미사) · 선택 있으면 라벨 「(선택 N)」 · exportCourses.length===0 이면 disabled · UTF-8 BOM · 5 회귀 테스트 · 웹 1041 (+5) · lint clean · 서버 무변경. Accounts (v0.152/v0.155) · Groups (v0.157) · Classroom (v0.177) 3 테이블 export 트릴로지 완결.
- `c4eae3b` v0.176 - v0.175 shared `COURSE_NAME_MAX` 를 BulkRenameClassroomDialog 각 row 에도 이식 · `overlyLongRows` useMemo · `canConfirm` 조건 · row 별 tooLong 경고 (기존 invalid + 신규 tooLong 통합 rowError) · summary 「상한 초과 N개」 카운트 · 2 회귀 테스트 · 웹 1036 (+2) · lint clean · 서버 무변경.
- `d914dd2` v0.175 - v0.174 shared `lib/classroomLimits.ts` 에 Google Classroom courses.name (750) · section (2800) · room (650) 상수 추가 · CreateClassroomDialog handleSubmit 상단 세 필드 상한 검증 → 초과 시 서버 요청 차단 + validation error 배너 · 3 helper test 확장 · 웹 1034 (+3) · lint clean · 서버 무변경.
- `1667e74` v0.174 - CreateClassroomDialog description 필드에 Google Classroom courses.description 상한 30,000자 강제 + 실시간 「N / 30,000 자」 카운터 (초과 시 red) + textarea resize-y + handleSubmit 상한 초과 시 서버 요청 차단 · 신규 `lib/classroomLimits.ts` shared `COURSE_DESCRIPTION_MAX` 상수 · 1 helper test · 웹 1031 (+1) · lint clean · 서버 무변경.
- `ecb7fe1` v0.173 - CreateGroupDialog + EditGroupDialog description input 을 textarea (rows=3, resize-y) 로 승격 + 4096자 상한 강제 + 실시간 「N / 4096 자」 카운터 · 신규 `lib/groupLimits.ts` shared `GROUP_DESCRIPTION_MAX` 상수 · v0.166 BulkUpdateGroupDescriptionDialog 도 shared 상수 사용으로 refactor (Workspace Directory 규격 3 dialog 완전 통일) · 상한 초과 handleSubmit 차단 · 1 helper test · 웹 1030 (+1) · lint clean · 서버 무변경.
- `75e53a5` v0.172 - v0.171 CopyButton 을 userDetail · groupDetail 두 페이지로 확장 · userDetail (이메일 + 조직 단위) · groupDetail (이메일 + 헤더 그룹 email) · 재사용만 · 웹 1029 · lint clean · 서버 무변경.
- `bdcefa3` v0.171 - classroomDetail 복사 버튼 (courseId · ownerId · alternateLink) · 신규 `CopyButton` 컴포넌트 (navigator.clipboard.writeText 우선 · execCommand fallback · 성공 시 「복사됨 ✓」 2초 노출 · aria-label 에 value 포함) · classroomDetail 3곳 배치 · 관리자가 Admin Console 붙여넣기 원-클릭 · 5 회귀 테스트 · 웹 1029 (+5) · lint clean · 서버 무변경.
- `ec81745` v0.170 - courseState 3 dialog Korean label 통일 (CreateClassroom · CourseBulkCreate · ClassroomChatPairBulkCreate) · v0.137 ClassroomTable 의 `translateCourseState` 를 `src/lib/courseState.ts` 로 승격 · 신규 `courseStateOptionLabel` (「한글 (CODE)」 형태) · ClassroomTable 은 re-export 로 뒤호환 (classroomDetail.tsx 소비 유지) · 3 회귀 테스트 · 웹 1024 (+3) · lint clean · 서버 무변경.
- `550b406` v0.169 - TransferClassroomOwnerDialog (개별) + BulkTransferClassroomOwnerDialog (v0.164) 도 shared `lib/emailInput.ts` helper 로 refactor (v0.168 대칭 완성) · 두 dialog 모두 local-part 자동 부착 + preview + 도메인 client-side 거부 + case-insensitive → lower-case canonical · 이메일 입력 UX 6 dialog 완전 일관 (CreateUser · BatchCreate · CreateGroup · CreateClassroom · TransferClassroomOwner · BulkTransferClassroomOwner) · TransferClassroom 기존 test 는 @example.com → @cam.hs.kr 로 갱신 (도메인 제한) · 5 회귀 테스트 · 웹 1021 (+5) · lint clean · 서버 무변경.
- `1f25e80` v0.168 - CreateClassroomDialog owner local-part 자동 부착 (v0.167 CreateGroupDialog 대칭) · v0.167 helper 를 `src/lib/emailInput.ts` 로 승격 · CreateGroupDialog 는 shared helper 로 refactor (하위 호환 alias export) · 'me' 특수 값 유지 + 빈 값 → 'me' fallback + local-part 자동 부착 + full email 뒤호환 + 잘못된 도메인 validation 에러 · 13 회귀 테스트 (emailInput 7 + CreateClassroom 6) · 웹 1016 (+13) · lint clean · 서버 무변경.
- `118e45d` v0.167 - CreateGroupDialog local-part 입력 + 자동 @cam.hs.kr 부착 (BatchCreateUsersDialog v0.132 UX 대칭) · 교사가 「team-a」 만 입력하면 서버에 「team-a@cam.hs.kr」 로 자동 전송 · full email 도 뒤호환 · `normalizeGroupEmailInput` pure helper (case-insensitive + lower-case canonical) · 실시간 preview line · 「이메일 아이디 (자동 @cam.hs.kr)」 라벨 · 잘못된 도메인/특수문자 preview 없음 + 실행 거부 · 9 회귀 테스트 · 웹 1003 (+9) · lint clean · 서버 무변경.
- `8eb8c54` v0.166 - BulkUpdateGroupDescriptionDialog · v0.165 GroupsTable selection 재사용 · 학년 코호트 그룹 여러 개에 동일 설명 (예: 「2026학년도 3학년 5반」) 일괄 부여 · Textarea 입력 (모두 공통 값) · 4096자 상한 검증 (Workspace Directory 규격) · 빈 설명도 실행 허용 (설명 지우기) · 3-phase confirm/running/done · F99 emails+description snapshot · F100 htmlFor · 순차 호출 · 실패 격리 · done 배너에 적용된 설명 표시 · 기존 groupsUpdate callable 재사용 · GroupsTable bulk actions bar 「선택 설명 변경」 버튼 · 5 회귀 테스트 · 웹 994 (+5) · lint clean · 서버 무변경.
- `b490459` v0.165 - GroupsTable 최초 bulk 액션 세트 (Accounts v0.155 · Classroom v0.164 대칭) · 체크박스 컬럼 (row + 헤더 전체선택 + indeterminate) · 필터 밖 선택 유지 · 필터/검색/정렬 변경 시 리셋 · 「N개 선택됨」 bulk actions bar · BulkDeleteGroupDialog (3-phase confirm/running/done · F99 emails snapshot · F100 htmlFor · 확인 개수 정확 입력 · 순차 호출 · 실패 격리) · 기존 groupsDelete callable 재사용 · conditional mount (QueryClient 조기 호출 방지) · 11 회귀 테스트 · 웹 989 (+11) · lint clean · 서버 무변경.
- `ceb9997` v0.164 - BulkTransferClassroomOwnerDialog (일괄 소유자 이관) · 년말 담임 교체 등 반 여러 개 소유자를 새 교사에게 한 번에 이관 · 기존 classroomTransferOwnership callable 재사용 (서버 무변경) · 3-phase (confirm/running/done) · F99 courses+newOwner snapshot · F100 htmlFor · @cam.hs.kr 도메인 검증 · 확인 input 대상 개수 정확 입력 · ACTIVE 코스만 대상 (F118 대칭) · 실패 격리 · v0.116c F77 partial rollback 안내 유지 · ClassroomTable 「선택 소유자 이관」 버튼 · 6 회귀 테스트 · 웹 978 (+6) · lint clean · 서버 무변경.
- `9856a0c` v0.163 - BulkUpdateRoleDialog (일괄 admin/teacher 역할 변경) · 교사 여러명 admin 승격 · 관리자 강등 원-스텝 · 기존 usersUpdateRole callable 재사용 (서버 무변경) · 3-phase (confirm/running/done) · F99 emails+role snapshot · F100 htmlFor · 역할 radio (admin/teacher — super_admin bootstrap 제외) · 확인 input 대상 개수 정확 입력 · 순차 호출 · 실패 격리 · AccountsTable 「선택 역할 변경」 버튼 · 6 회귀 테스트 · 웹 972 (+6) · lint clean · 서버 무변경.
- `4c9c0a0` v0.162 - ClassroomTable 정렬 선호 localStorage 저장 (v0.160/v0.161 대칭 · Accounts/Groups/Classroom 트릴로지 완결) · `classroomTable.sort.v1` 키 · SortColumn allowlist (name/section/state) · URL authoritative · Mount hydrate · sort 변경 시 자동 저장 · 「필터 초기화」 후 removeItem · 5 회귀 테스트 · 웹 966 (+5) · lint clean · 서버 무변경.
- `305813f` v0.161 - GroupsTable 정렬 선호 localStorage 저장 (v0.160 AccountsTable 대칭) · `groupsTable.sort.v1` 키 · SortColumn allowlist (email/name/directMembersCount) · URL authoritative · Mount 시 URL 이 sort 없으면 저장값 hydrate · sort 변경 시 자동 저장 · 「필터 초기화」 후 removeItem · 5 회귀 테스트 · 웹 961 (+5) · lint clean · 서버 무변경 · v0.162 ClassroomTable 대칭 예정.
- `ef322a6` v0.160 - AccountsTable 정렬 선호 localStorage 저장 · URL 이 authoritative · localStorage 는 URL 이 sort 없을 때만 default 로 hydrate · Mount 시 URL 에 sort 없으면 저장값(`accountsTable.sort.v1`) 을 URL 로 replace hydrate · sort 변경 시 자동 저장 · sort 없으면 removeItem · 손상 JSON · localStorage 비활성 조용히 무시 · 5 회귀 테스트 · 웹 956 (+5) · lint clean · 서버 무변경 · GroupsTable/ClassroomTable 후속 슬라이스 (v0.161/v0.162) 로 이식 예정.
- `d7d95d9` v0.159 - BatchCreateUsersDialog 「+ 새 OU 만들기」 인라인 폼 (v0.121 CreateUserDialog 대칭) · 학년말 새 OU 만들기 흔한 요구 대응 · state · reset · handler · UI 모두 v0.121 과 동일 구조 · 기본 접힘 · toggle 클릭 시 폼 전개 · 부모 경로 기본값 = 현재 orgUnitPath · 이름/부모 검증 규칙 동일 · 성공 시 orgUnitPath 자동 채움 · 폼 접힘 · 성공 메시지 · 5 회귀 테스트 · 웹 951 (+5) · lint clean · 서버 무변경 (기존 orgunitsCreate callable 재사용) · Codex R1 skip.
- `1a4e966` v0.158 - CreateUser/BatchCreate 「첫 로그인 시 비밀번호 변경 강제」 checkbox toggle · 기본 checked (학생 안전 · 초기 비번 노출 방지) · 교사·관리자 계정 해제 가능 · CreateUserDialog · BatchCreateUsersDialog 두 다이얼로그 대칭 · state · reset · UI 3점 세트 · callUsersCreate/createUser 하드코딩 `true` → 상태 값 전달 · BatchCreate 는 「모두 공통」 라벨 · CreateUserDialog test regex `/^비밀번호/` (start-anchored) 로 새 checkbox label 매치 회피 · 4 회귀 테스트 · 웹 946 (+4) · lint clean · 서버 무변경 · Codex R1 hang → skip.
- `f61b2f2` v0.157 - GroupsTable JSON 내보내기 (v0.152 AccountsTable 대칭) · CSV 옆 「JSON 내보내기」 버튼 · payload (exportedAt, filters, totalCount, groups) · groups 필드 (email, name, description, directMembersCount, aliases) · 파일명 groups-YYYY-MM-DD.json · sortedFilteredGroups 반영 · 결과 0 이면 disabled · 3 회귀 테스트 (`tests/GroupsTable.test.tsx`) · 웹 942 (+3) · lint clean · 서버 무변경 · Codex skip (credits 소진).
- `2e83e90` v0.156 - CourseMembersPanel 선택 명단 export (v0.148/v0.155 대칭) · 개별 체크박스 + 전체 선택 header (indeterminate) · 선택 시 export 버튼 「(선택 N)」 · 파일명 <코스>-<탭>-selected-<날짜>.csv · 탭 전환 시 선택 리셋 · 3 회귀 테스트 (`tests/CourseMembersPanel.test.tsx`) · 웹 939 (+3) · lint clean · 서버 무변경 · Codex skip (한도 재소진).
- `2b023f0` v0.155 - AccountsTable 선택 계정만 export (로드맵 B-6 후속) · CSV/JSON 버튼 라벨 「(선택 N)」 · 파일명 accounts-selected-YYYY-MM-DD.csv|json · JSON payload scope: 'selected'|'filtered' · 3 회귀 테스트 (`tests/AccountsTable.test.tsx`) · 웹 933 (+3) · lint clean · 서버 무변경.
- `a4f0457` v0.154 - super_admin 대시보드 결과 분포 위젯 (로드맵 B-8) · ok/denied/error 3-card grid + count/percent · 서버 resultCounts 확장 · 6 회귀 테스트 · 웹 936 (+4) · functions 523 (+1) · lint clean.
- `324395b` v0.153 - AuditLogTable 무한 스크롤 (로드맵 B-7) · InfiniteScrollSentinel (IntersectionObserver rootMargin=200px) · sentinel 뷰포트 진입 시 자동 loadMore · 「더 보기」 버튼 병행 유지 · sentinel 조건 hasMore && !loading · effect deps [] + ref 로 최신 상태 참조 · 3 회귀 테스트 (`tests/AuditLogTable.test.tsx`) · 웹 928 (+3) · lint clean · 서버 무변경 · 1 라운드 Codex 통과.
- `0d579fd` v0.152 - AccountsTable JSON 내보내기 (로드맵 B-6) · CSV 옆 「JSON 내보내기」 버튼 · payload (exportedAt, filters, totalCount, users) · users 필드 (email, firstName, lastName, orgUnitPath, isAdmin, isSuspended) · 파일명 accounts-YYYY-MM-DD.json · sortedFilteredUsers 반영 · 결과 0 이면 disabled · 3 회귀 테스트 (`tests/AccountsTable.test.tsx`) · 웹 920 (+3) · lint clean · 서버 무변경 · 1 라운드 Codex 통과.
- `d831523` v0.151 - BatchCreateUsersDialog + 클래스룸 자동 배정 (로드맵 B-5) · 1 라운드 Codex 통과 · Head 폴백 병합.
- `b00342e` v0.150 - 반 챗방 학생 자동 초대 (원본 assignMembersToChatRooms 대응) · AutoInviteStudentsToChatSpacesDialog (5-phase) · callChatList displayName 매칭 · matched vs unmatched 분리 · rosters 미설정/빈 반 skip · 「초대 N」 정확 입력 · 순차 add · already member skip 분류 · 실패 격리 · BasicDataPanel 「반 챗방 자동 초대」 버튼 · 1 라운드 Codex 통과.
- `f68837f` v0.149 - 반 그룹 명단 밖 자동 제거 (원본 assignGroups 제외 워크플로우) · AutoRemoveNonRosterMembersDialog (5-phase) · fetchAllGroupMembers 페이지 넘김 · rosters diff · MEMBER 기본/OWNER·MANAGER 보호 toggle · 개별 체크박스 · 「제거 N」 정확 입력 · 순차 delete · 실패 격리 · F131 fix (rosters 미설정 반 스캔 skip) · BasicDataPanel 「명단 밖 자동 제거」 버튼 · 2 라운드 Codex 통과.
- `559ac45` v0.148 - classroom 상세 페이지 학생/교사 명단 CSV 내보내기 (원본 명단 확인 대응) · CourseMembersPanel 「CSV 내보내기 (N)」 버튼 · 이름/이메일/userId 컬럼 · UTF-8 BOM · 파일명 <코스이름>-<교사|학생>-<YYYY-MM-DD>.csv · 파일시스템 금지 문자 sanitize · items 0 or anyPending 시 disabled · 1 라운드 Codex 통과.
- `6894567` v0.147 - OU 목록 로드 실패 재발 대응 (bliss00 v0.146 후에도 리포트) · reauthorizeWithGoogle helper (clearSession+signOut+signIn forceConsent) · CreateUserDialog 「Google 재로그인」 버튼 · 3 라운드 Codex 통과.
- `479b075` v0.146 - CreateUserDialog OU 목록 에러 상세 + login scope 누락 fix (bliss00 실 버그 리포트) · login scope 2개 추가 · 에러 상세/재시도 버튼 · bliss00 재동의 필수 · 2 라운드 Codex 통과.
- `2f66aa0` v0.145 - 나이스 CSV 일괄 클래스룸 생성 + 초대 (원본 createAndInviteClassrooms 웹 포팅) · 3 CSV drop/preview/실행 · papaparse · 1 라운드 Codex 통과.
- `e88730b` v0.144 - CreateUserDialog 클래스룸 UX 개선 (bliss00 실 사용 피드백) · 2컬럼 grid · 이름순 정렬 + 검색 · 선택 유지 + 1 라운드 Codex 통과.
- `f370ea2` v0.143 - auditLogList filters hook 재구성 · exhaustive-deps 마지막 4 warning 해소 (13→0 완주) + 2 라운드 Codex 감사 + F127.
- `d4932e9` v0.142 - exhaustive-deps missing dep 3건 실제 fix (7 → 4) + 2 라운드 Codex 감사 + F126.
- `0c8905e` v0.141 - exhaustive-deps logical expression 6건 fix (13 → 7) + 2 라운드 Codex 감사 + F125.
- `52e41bf` v0.140 - web ESLint 관문 (Codex v0.138 소프트 권고 반영) + 2 라운드 Codex 감사 + F124.

## 다음 후보 (Head 자율 실행 예정)

`docs/handoff/ROADMAP.md` Phase 5/6 남은 항목:
- **super_admin 대시보드 확장** - 로드맵 B-8.
- **반 챗방 명단 밖 자동 제거** - chat member API 가 userId 반환이라 usersList extend 필요 (서버 변경 slice).
- **BatchCreateUsersDialog + 클래스룸 배정** - 로드맵 B-5.
- **부서 그룹 명단 밖 자동 제거** - v0.149 대칭.
- **전입생 매크로** - A-1, 도메인 규칙 필요.
- **전입생 계정 개별 생성 UX 세부 확장** - `laterAccountSetup` 의 「학번/반 자동 배정 + 그룹 자동 추가」 매크로 (v0.119 는 기본 폼만 커버).
- **계정 삭제 안내 메일** - SendGrid 등 3rd party 이메일 서비스 필요.
- **첫 audit fallback 검증** - v0.133 sink 배포 완료 · 실 fallback 발생 후 BigQuery smoke test 필요.
- **(d)** 사용자 지시 그 외.

## 안티그래비티 위임 template (bliss00 승인 2026-09-11)

Head 는 신규 slice + Codex hotfix 담당, 안티그래비티는 매 슬라이스 마무리
사이클을 담당하는 하이브리드 운영. **다음 슬라이스 (v0.120+) 부터 아래 template
로 위임 시도**. 현 v0.119 는 이미 Head 로 마무리.

**오더 예시** — v0.XX 감사 통과 뒤 실행할 마무리 사이클:

```
브랜치: feat/<slug>-vN.NN (HEAD `<sha>`)

1. main 워크트리 (`/Users/bliss00/.buzz/REPOS/school_app`) 에서:
   git fetch origin && git merge --no-ff origin/feat/<slug>-vN.NN -m "<merge msg>"
   git push origin main
2. `firebase deploy --only hosting,functions --project school-app-5a636`
3. 4 문서 갱신 (지정된 diff):
   - STATUS.md: 최근 병합 테이블 상단에 vN.NN row 추가, 열린 항목 vN.NN → vN.NN+1
   - NEXT.md: v병합 완료 표기 + 최근 병합 목록 갱신
   - ROADMAP.md: 필요 시 Phase 항목 재분류
   - project_notes.md: append-only 로 「## YYYY-MM-DD · vN.NN <제목>」 섹션 (커밋 표 · 라운드 표 · 배운 것 · 다음 세션)
4. git commit + push (docs): "docs: vN.NN 병합 반영 + STATUS/project_notes/NEXT/ROADMAP 갱신"
5. 채널 공지: 내용을 Write 로 `/tmp/vN.NN_announce.md` 에 담고 `cat /tmp/vN.NN_announce.md | buzz messages send --channel <위임 스레드가 발생한 채널 UUID> --content -` 로 발행 (stdin 파이프). **주의**: `--content @/tmp/xxx.md` 는 CLI 미지원 — 리터럴 문자열로 발행됨 (2026-09-13 v0.137 학습). reply-to 없이 top-level.
6. **완료 후 delegation reply 스레드에 반드시 [채널 공지 event id] 를 붙여 보고** (2026-09-13 v0.136 학습 — Antigravity 가 announce 를 발행해도 relay 전파 지연으로 Head 에서 즉시 안 보임, event id 를 명시하면 Head 가 중복 발행을 피할 수 있음).

**제약**: main 에 직접 커밋 금지 (문서 갱신은 예외). Codex 감사 응답은 Head 만
파싱. Antigravity 는 오더 template 밖 판단 금지. **채널 UUID 는 위임 오더에서
Head 가 명시** (school_app_02 vs school_app_03 등 여러 채널 존재 가능).
```

Head 는 안티그래비티 결과를 리뷰하고 부족한 부분만 재작성.

## 상설 규약 (변하지 않음)

`AGENTS.md` §3 참조:
- 기존 파일 재작성 금지, 요청받은 부분만.
- 삭제가 추가보다 많으면 멈추고 보고.
- `git add -A` 금지. `main` push 금지.
- 지금 코드와 다르면 다르다고 보고.
- 「판정 불가」 허용.
- 근거는 `파일:줄번호`, 항목당 한 줄.
- 이모지 금지.
- 커밋 전 기계 관문 통과 — TypeScript · ESLint · Vitest.

## UI 슬라이스 원본

- **디자인 명세**: `docs/design/UI_SYSTEM.md` (v1.1, masstige.io 복원 + 아이콘 · AA 상향).
