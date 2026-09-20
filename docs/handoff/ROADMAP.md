# ROADMAP — school_app 개발 로드맵

> 2026-09-11 기준 · v0.120 배포 완료 · 다음 단계 계획.
> `NEXT.md` 는 「지금 열린 오더」 · `ROADMAP.md` 는 「전체 계획」. 두 파일을 함께 본다.

## 완료 (v0.93 baseline → v0.112)

### Phase 1 — Admin Console v1 (v0.93 이전, baseline)
- Firebase 스택 · pnpm workspace · Vitest · WCAG AA UI.
- 인증 (Google 도메인 검증) · 역할 (super_admin/admin/teacher).
- 사용자·그룹·챗룸·클래스룸 CRUD callable.
- 감사 로그 append-only + 기본 조회.

### Phase 2 — Admin Console v2 (v0.94 ~ v0.100)
- Teacher 권한 fix (F1-F3): membership pre-check · ownerId=me 강제.
- Alias hash · 128 자 사전 컷 · Chat/Classroom bulk create dialog.
- Capability matrix (`/super_admin/capabilities`) 읽기 전용.
- **usersUpdateRole callable** (system.manage_roles cap) + EditUserRoleDialog · Auth+Firestore 원자적 갱신 + rollback.

### Phase 3 — Audit Log 강화 (v0.101 ~ v0.104, v0.108, v0.111, v0.112)
- v0.101 filterAction + AUDIT_ACTIONS shared catalog + Firestore 복합 인덱스.
- v0.104 다중 action 필터 (Firestore `in` 최대 30) + role=group WAI-ARIA.
- v0.108 JSON export + 파일명 필터 요약 + partial/hasMore.
- v0.111 role_split quick filter preset + empty-state trim 일치.
- v0.112 「필터 초기화」 원자적 URL param clear.

### Phase 4 — role_split 무결성 (v0.105 ~ v0.107, v0.109, v0.110)
- v0.105 SuperAdminPage 감시 카드 (client filter).
- v0.106 server-side `system.role_split_detected` action (client filter 제거).
- **v0.107 자동 복구 + 상태 재확인** (7 라운드 감사): usersResolveRoleSplit (CAS + Firestore transaction + post-write Auth 3-way 분기) · usersRecheckRoleSplit (read-only) · auditLogUnresolvedRoleSplits (server aggregation, `system.role_split_resolved` + `users.update_role` 두 sync source).
- v0.109 unknown row 자동 재확인 (mount-scoped budget + mutateAsync + Promise.allSettled).
- v0.110 미해결 role_split KPI 카드 (반응형 grid + scanIncomplete `N+`/`N?` 분리).

### 설계·품질 layer (반복 주제)
- Codex 감사: v0.104-v0.112 총 약 30 라운드. 「F1~F64」 지적 사항 모두 해결.
- UI_SYSTEM v1.1 (masstige.io 모노크롬 + lucide-react 아이콘 + AA 대비).
- 기계 관문: TypeScript · web build · Functions build/lint · web lint · Vitest.

## 진행 후보 (다음 단계)

### Phase 5 — Product features (school-specific)

이미 구현됨 (Phase 5 부분 완료):
- **기초 데이터 (학년/반/부서) 관리 UI** — `admin/BasicDataPanel` + `EditBasicDataDialog` · `ImportBasicDataDialog` · `EditRostersDialog` · `AutoCreateGroupsDialog` · `AutoCreateDepartmentGroupsDialog` · `AutoInviteStudentsDialog`. 원본 「⚙️ 기초 데이터」 메뉴 대부분 커버.
- **비밀번호 일괄 변경** — v0.113 `BulkResetPasswordDialog` 완료.
- **일괄 정지 / 삭제 / OU 이동** — `BulkSuspendDialog` · `BulkDeleteDialog` · `BulkMoveOuDialog`.
- **Classroom + Chat 통합 생성** — v0.98 `ClassroomChatPairBulkCreateDialog`.
- **Chat/Classroom bulk invite** — `ChatBulkInviteDialog` · `ClassroomBulkInviteDialog`.
- **클래스룸 archived bulk 관리** — v0.115 다중 선택 + `BulkArchiveClassroomDialog` (ACTIVE ↔ ARCHIVED). teacher membership 검증 (F72) + confirm snapshot (F73).
- **orgunits.insert (신규 OU 생성 UI)** — v0.121 `orgunitsCreate` callable + CreateUserDialog 인라인 폼.
- **클래스룸 소유자 이관** — v0.116 `classroomTransferOwnership` callable + `TransferClassroomOwnerDialog`.
- **전입생 일괄 계정 생성** — v0.132 `BatchCreateUsersDialog` (10 rows · 공통 OU + 초기 비밀번호 · 3-phase confirm/running/done).
- **클래스룸 일괄 이름 변경** — v0.134 `BulkRenameClassroomDialog` (원본 `updateAndLogClassroomNames` 포팅). `classroomPatch` 를 name/section 도 지원하도록 확장. ARCHIVED 는 Classroom REST v1 제약으로 제외 (F118).
- **개별 클래스룸 이름 · 섹션 변경** - v0.136 `RenameClassroomDialog` (classroomDetail inline). v0.134 `classroomPatch` 확장을 개별 편집에 노출. ACTIVE 코스만 (F118 대칭) · name 750/section 2800자 검증 · F99 target snapshot · F100 label · 소프트 권고 반영.
- **CreateUserDialog 클래스룸 UX 개선** - v0.144 완료 (bliss00 실 사용 피드백). 다이얼로그 폭 2컬럼 grid (max-w-4xl, 왼쪽 폼 + 오른쪽 클래스룸 배정) · 클래스룸 이름순 정렬 (localeCompare) · 검색 input (이름/섹션/id 부분 일치) · 검색 결과 없음 안내 · 선택 유지 (selectedIds 유지) · 리스트 높이 확장 (max-h-96).
- **나이스 CSV 일괄 클래스룸 생성 + 초대** - v0.145 완료 (bliss00 실 요청, 원본 Apps Script createAndInviteClassrooms 포팅). 3 CSV (1.클래스룸생성&초대 / 교사과목정리 / 학생과목정리) drop → papaparse 파싱 → 미리보기 (생성 대상/매칭 교사·학생 수) → 순차 생성 (Classroom.Courses.create courseState:ACTIVE) 및 교사/학생 add (실패 격리 · 진행률 표시). Owner 는 CSV C1 우선, 없으면 로그인 사용자.
- **CreateUserDialog OU 목록 에러 상세 + login scope 누락 fix** - v0.146 완료 (bliss00 실 버그 리포트). Google 로그인 스코프에 admin.directory.orgunit(.readonly) 2개 추가 · 에러 상세 문자열 노출 · 다시 시도 버튼 · 401/403/scope 감지 시 재로그인(재동의) 안내. auth.test.ts 11→13 갱신.
- **CreateUserDialog OU 목록 재로그인 자동 복구 버튼** - v0.147 완료 (bliss00 실 버그 리포트 UX 자동화). reauthorizeWithGoogle helper (clearSession+signOut+signIn forceConsent) · CreateUserDialog scope 에러 시 「Google 재로그인」 버튼 · 클릭 시 자동 재동의/복구 + OU 재조회. auth.test.ts 회귀 3건 (F129/F130). 3 라운드 Codex 통과.
- **classroom 상세 명단 CSV 내보내기** - v0.148 완료 (원본 명단 확인 대응). CourseMembersPanel 에 「CSV 내보내기 (N)」 버튼 · 이름/이메일/userId 컬럼 · UTF-8 BOM · 파일명 <코스이름>-<교사|학생>-<YYYY-MM-DD>.csv · 파일시스템 금지 문자 sanitize · items 0 or anyPending 시 disabled · title 툴팁 · 1 라운드 Codex 통과.
- **반 그룹 명단 밖 자동 제거** - v0.149 완료 (원본 assignGroups 제외 워크플로우). AutoRemoveNonRosterMembersDialog (5-phase confirm→scanning→preview→running→done) · fetchAllGroupMembers 페이지 넘김 · rosters diff · MEMBER 기본 대상 / OWNER·MANAGER 보호 toggle · 개별 체크박스 · 「제거 N」 정확 입력 확인 · 순차 delete · 실패 격리 · F131 fix (rosters 미설정 반 스캔 skip · 빈 배열은 정상 스캔) · BasicDataPanel 「명단 밖 자동 제거」 버튼 (conditional mount) · 2 라운드 Codex 통과.
- **반 챗방 학생 자동 초대** - v0.150 완료 (원본 assignMembersToChatRooms 대응). AutoInviteStudentsToChatSpacesDialog (5-phase confirm→scanning→preview→running→done) · callChatList displayName 매칭 (「{year}학년도 N학년 M반」) · matched vs unmatched 분리 · rosters 미설정/빈 반 skip · 「초대 N」 정확 입력 확인 · 순차 add · already member skip 분류 · 실패 격리 · BasicDataPanel 「반 챗방 자동 초대」 버튼 (conditional mount) · 1 라운드 Codex 통과.

남은 후보:
- **전입생 계정 개별 생성 UX 세부 확장** — v0.119 는 기본 폼 커버. 원본 `laterAccountSetup` 의 「학번/반 자동 배정 + 그룹 자동 추가」 매크로는 별도 확장 필요.
- **계정 삭제 안내 메일** — 원본 MailApp 기능. SendGrid 등 3rd party 이메일 서비스 필요 (미구현).

### Phase 6 — 통합·자동화

이미 구현됨:
- **감사 로그 필터 preset 저장** — v0.114 완료 (localStorage 기반).
- **classroom 상세 페이지** — v0.117 완료 (`/admin/classrooms/:id` · CourseMembersPanel · inline actions · super_admin 감사 링크는 서버 target 필터).
- **감사 로그 배치 export** — v0.118 완료 (전체 JSON 순회 · compound cursor · AbortSignal · q filter 반영).
- **admin/users 검색 필터** — 이미 구현됨 (`AccountsTable` `q` URL param + 이메일/이름 검색).
- **super_admin 대시보드 위젯** — v0.120 완료 (「오늘 액션별」 bar-list · SAMPLE_LIMIT=500 · truncated 배너).

이미 구현됨 (Phase 6 추가):
- **이번 주/월 window breakdown** — v0.122 완료 (3-way today/week/month).
- **사용자 정의 window (지난 N일)** — v0.135 완료. 프리셋 chip (7/30/90) + numeric input (1..365, 잘못된 값은 30 fallback + aria-invalid).
- **ClassroomTable 검색·필터·정렬** — v0.137 완료 (AccountsTable v0.125 · GroupsTable v0.127 대칭). URL params q/filter/sort/dir · KPI chips · 「필터 초기화」 · 25개 페이지네이션 · F121/F122/F123 대응.
- **정렬 헤더 키보드 접근성 3화면 대칭** — v0.138 완료 (Codex v0.137 소프트 권고 반영). sortHeader.ts helper (sortHeaderKbdProps): tabIndex=0 + onKeyDown(Enter/Space preventDefault + activate) + focus-visible ring class. ClassroomTable · AccountsTable · GroupsTable 9개 sortable 헤더에 spread 적용.
- **sortHeader helper 단위 테스트** — v0.139 완료 (Codex v0.138 소프트 권고 반영). packages/web/tests/sortHeader.test.ts 6 케이스 (Enter/Space preventDefault 후 onActivate 호출 순서 고정 · 비매칭 키 무시 · 반환 필드 shape · className trim/append · focus ring). v0.139b 소프트 권고 반영.
- **web ESLint 관문** - v0.140 완료 (Codex v0.138 소프트 권고 반영). packages/web/eslint.config.js 신규 (@typescript-eslint + eslint-plugin-react-hooks 7.1.1, rule='react-hooks/exhaustive-deps: warn') · lint 스크립트 확장 ('tsc --noEmit && eslint src tests', functions 대칭).
- **exhaustive-deps logical fix** - v0.141 완료 (v0.140 ESLint warning 13 → 7). ClassroomTable (courses 4건) · ChatBulkInviteDialog (rosters 1) · ClassroomBulkInviteDialog (rosters 1) 세 파일의 fallback 표현식을 useMemo 로 안정화하여 falsy path 매 렌더 신규 참조 방지 및 하위 hook 재실행 안정성 확보.
- **exhaustive-deps missing dep fix** - v0.142 완료 (v0.141 ESLint warning 7 → 4). AddChatMemberDialog · ChatSpaceMembersDialog · CreateClassroomDialog 세 다이얼로그의 useEffect open transition 초기화에서 disable 주석을 제거하고 tanstack-query mutation.reset observer stable bind 특성 및 resetForm useCallback([resetMutation]) 을 적용하여 exhaustive-deps 규칙 준수.
- **exhaustive-deps auditLogList hook 재구성** - v0.143 완료 (v0.142 ESLint warning 4 → 0 완주). auditLogList.ts 의 filters 필드 원시 분해 및 filterActions key(useMemo + JSON.stringify) 도입으로 hook 의존성 배열 안정화 및 exhaustive-deps 경고 4건 전량 해소 (13→0 완주).
- **AccountsTable JSON 내보내기** - v0.152 완료 (로드맵 B-6). 사용자 목록 감사·재적재 편의. CSV 옆 「JSON 내보내기」 버튼 · payload (exportedAt, filters, totalCount, users) · users 필드 (email, firstName, lastName, orgUnitPath, isAdmin, isSuspended) · 파일명 accounts-YYYY-MM-DD.json · sortedFilteredUsers 반영 · 결과 0 이면 disabled · 1 라운드 Codex 통과.
- **AuditLogTable 무한 스크롤** - v0.153 완료 (로드맵 B-7). 감사 로그 하단 sentinel (IntersectionObserver rootMargin=200px) 자동 loadMore · 기존 「더 보기」 버튼 병행 유지 · ref 기반 최신 상태 참조 · 3 회귀 테스트 · 웹 928 (+3) 유닛 · 1 라운드 Codex 통과.
- **super_admin 대시보드 결과 분포 위젯** - v0.154 완료 (로드맵 B-8). 「액션별」 위젯 아래 신규 section, ok/denied/error 3-card grid + count/percent · 서버 resultCounts 확장 및 preview entries fallback · 6 회귀 테스트 · 웹 936 (+4) · functions 523 (+1) · lint clean.
- **AccountsTable 선택 계정만 export** - v0.155 완료 (로드맵 B-6 후속). CSV/JSON 버튼 라벨 「(선택 N)」 · 파일명 accounts-selected-YYYY-MM-DD.csv|json · JSON payload scope: 'selected'|'filtered' · 3 회귀 테스트 (`tests/AccountsTable.test.tsx`) · 웹 933 (+3) · lint clean · 서버 무변경.
- **CourseMembersPanel 선택 명단 export** - v0.156 완료 (v0.148/v0.155 대칭). classroom 상세 명단 개별 체크박스 + 전체 선택 header (indeterminate) · 선택 시 export 버튼 「(선택 N)」 · 파일명 <코스>-<탭>-selected-<날짜>.csv · 탭 전환 시 선택 리셋 · 3 회귀 테스트 (`tests/CourseMembersPanel.test.tsx`) · 웹 939 (+3) · lint clean · 서버 무변경.
- **GroupsTable JSON 내보내기** - v0.157 완료 (v0.152 AccountsTable 대칭). 그룹 목록 JSON export · CSV 옆 「JSON 내보내기」 버튼 · payload (exportedAt, filters, totalCount, groups) · groups 필드 (email, name, description, directMembersCount, aliases) · 파일명 groups-YYYY-MM-DD.json · sortedFilteredGroups 반영 · 결과 0 이면 disabled · 3 회귀 테스트 (`tests/GroupsTable.test.tsx`) · 웹 942 (+3) · lint clean · 서버 무변경.
- **CreateUser/BatchCreate changePasswordAtNextLogin toggle** - v0.158 완료. 계정 생성 두 화면 (단일 · 배치) 에 「첫 로그인 시 비밀번호 변경 강제」 checkbox toggle · 기본 checked (학생 안전) · 교사·관리자 계정 해제 가능 · state · reset · UI 3점 세트 · callUsersCreate/createUser 하드코딩 `true` → 상태 값 전달 · BatchCreate 는 「모두 공통」 라벨 · 4 회귀 테스트 · 웹 946 (+4) · lint clean · 서버 무변경.
- **BatchCreateUsersDialog OU 인라인 생성 폼** - v0.159 완료 (v0.121 CreateUserDialog 대칭). 배치 다이얼로그 안에서 「+ 새 OU 만들기」 클릭으로 신규 OU 즉시 생성 · 부모 경로 기본값 = 현재 orgUnitPath · 검증 규칙 (100자, /·\\ 금지, 부모는 / 시작) v0.121 과 동일 · 성공 시 orgUnitPath 자동 채움 · 폼 접힘 · 성공 메시지 · 5 회귀 테스트 · 웹 951 (+5) · lint clean · 서버 무변경 (기존 orgunitsCreate callable 재사용).
- **AccountsTable 정렬 선호 localStorage 저장** - v0.160 완료. /admin 재방문 시 사용자 선호 정렬 자동 복원 · URL 이 authoritative · localStorage 는 URL 이 sort 없을 때만 default 로 hydrate · Mount 시 URL 에 sort 없으면 저장값 (`accountsTable.sort.v1`) 을 URL 로 replace hydrate · sort 변경 시 자동 저장 · 「필터 초기화」 후 removeItem · 손상 JSON 조용히 무시 · 5 회귀 테스트 · 웹 956 (+5) · lint clean · 서버 무변경. GroupsTable/ClassroomTable 후속 슬라이스 (v0.161/v0.162) 로 이식 예정.
- **GroupsTable 정렬 선호 localStorage 저장** - v0.161 완료 (v0.160 대칭). 그룹 목록 재방문 시 정렬 자동 복원 · `groupsTable.sort.v1` 키 · SortColumn allowlist (email/name/directMembersCount) · URL authoritative · Mount 시 URL 이 sort 없으면 저장값 hydrate · sort 변경 시 자동 저장 · 「필터 초기화」 후 removeItem · 5 회귀 테스트 · 웹 961 (+5) · lint clean · 서버 무변경. v0.162 ClassroomTable 대칭 예정.
- **ClassroomTable 정렬 선호 localStorage 저장** - v0.162 완료 (v0.160/v0.161 대칭 · **정렬 저장 트릴로지 완결**). 클래스룸 목록 재방문 시 정렬 자동 복원 · `classroomTable.sort.v1` 키 · SortColumn allowlist (name/section/state) · URL authoritative · Mount 시 URL 이 sort 없으면 저장값 hydrate · sort 변경 시 자동 저장 · 「필터 초기화」 후 removeItem · 5 회귀 테스트 · 웹 966 (+5) · lint clean · 서버 무변경. Accounts (v0.160) · Groups (v0.161) · Classroom (v0.162) 세 테이블 모두 정렬 자동 복원 완비.
- **BulkUpdateRoleDialog** - v0.163 완료. AccountsTable 에 「선택 역할 변경」 버튼 추가 · 일괄 admin/teacher 역할 변경 · 기존 usersUpdateRole callable 재사용 (서버 무변경) · 3-phase (confirm/running/done) · F99 emails+role snapshot · F100 htmlFor · 역할 radio (admin/teacher — super_admin bootstrap 제외) · 확인 input 대상 개수 정확 입력 · 순차 호출 · 실패 격리 · 6 회귀 테스트 · 웹 972 (+6) · lint clean · 서버 무변경.
- **BulkTransferClassroomOwnerDialog** - v0.164 완료. ClassroomTable 에 「선택 소유자 이관」 버튼 추가 · 년말 담임 교체 등 반 여러 개 소유자 일괄 이관 · 기존 classroomTransferOwnership callable 재사용 (서버 무변경) · 3-phase (confirm/running/done) · F99 courses+newOwner snapshot · F100 htmlFor · @cam.hs.kr 도메인 검증 · 확인 input 대상 개수 정확 입력 · ACTIVE 코스만 대상 (F118 대칭) · 실패 격리 · v0.116c F77 partial rollback 안내 유지 · 6 회귀 테스트 · 웹 978 (+6) · lint clean · 서버 무변경.
- **GroupsTable bulk selection + BulkDeleteGroupDialog** - v0.165 완료. GroupsTable 최초 bulk 액션 세트 (Accounts v0.155 · Classroom v0.164 대칭). 체크박스 컬럼 (row + 헤더 전체선택 + indeterminate) · 필터 밖 선택 유지 · 필터/검색/정렬 변경 시 리셋 · 「N개 선택됨」 bulk actions bar · BulkDeleteGroupDialog (3-phase · F99 emails snapshot · F100 htmlFor · 확인 개수 정확 입력) · 기존 groupsDelete callable 재사용 · conditional mount (QueryClient 조기 호출 방지) · 11 회귀 테스트 · 웹 989 (+11) · lint clean · 서버 무변경. 학년말 졸업 코호트 그룹 여러 개 일괄 정리 지원.
- **BulkUpdateGroupDescriptionDialog** - v0.166 완료. v0.165 GroupsTable selection 재사용 · 학년 코호트 그룹 여러 개에 동일 설명 (예: 「2026학년도 3학년 5반」) 일괄 부여 지원. Textarea 입력 (모두 공통 값) · 4096자 상한 (Workspace Directory 규격) · 빈 설명 실행 허용 (설명 지우기) · 3-phase (confirm/running/done) · F99 emails+description snapshot · F100 htmlFor · 순차 호출 · 실패 격리 · done 배너에 적용된 설명 표시 · 기존 groupsUpdate callable 재사용 · 5 회귀 테스트 · 웹 994 (+5) · lint clean · 서버 무변경.
- **CreateGroupDialog local-part 입력 + 자동 @cam.hs.kr 부착** - v0.167 완료 (BatchCreateUsersDialog v0.132 UX 대칭). 교사가 「team-a」 만 입력하면 서버에 「team-a@cam.hs.kr」 로 자동 전송 · full email 도 뒤호환 · `normalizeGroupEmailInput` pure helper (case-insensitive + lower-case canonical) · 실시간 preview line · 라벨 「이메일 아이디 (자동 @cam.hs.kr)」 · 잘못된 도메인/특수문자 preview 없음 + 실행 거부 · 9 회귀 테스트 · 웹 1003 (+9 · **첫 1000 넘김**) · lint clean · 서버 무변경.
- **CreateClassroomDialog owner local-part 자동 부착** - v0.168 완료 (v0.167 대칭). v0.167 helper 를 `src/lib/emailInput.ts` 로 승격 · CreateGroupDialog 는 shared helper 로 refactor · CreateClassroomDialog 소유자 필드 'me' 특수 값 유지 + 빈 값 → 'me' fallback + local-part 자동 부착 + full email 뒤호환 + 잘못된 도메인 validation 에러 · 13 회귀 테스트 (emailInput 7 + CreateClassroom 6) · 웹 1016 (+13) · lint clean · 서버 무변경.
- **TransferClassroomOwnerDialog + BulkTransfer shared emailInput refactor** - v0.169 완료. TransferClassroomOwnerDialog (개별) + BulkTransferClassroomOwnerDialog (v0.164) 둘 다 shared `lib/emailInput.ts` helper 로 refactor · local-part 자동 부착 + preview + client-side 도메인 거부 + case-insensitive → lower-case canonical · 이메일 입력 UX **6 dialog 완전 일관** (CreateUser · BatchCreate · CreateGroup · CreateClassroom · TransferClassroomOwner · BulkTransferClassroomOwner) · 5 회귀 테스트 · 웹 1021 (+5) · lint clean · 서버 무변경.
- **courseState 3 dialog Korean label 통일 + helper lib 승격** - v0.170 완료. v0.137 `translateCourseState` (ClassroomTable) 를 `src/lib/courseState.ts` 로 승격 · 신규 `courseStateOptionLabel` 「한글 (CODE)」 형태 · CreateClassroom · CourseBulkCreate · ClassroomChatPairBulkCreate 세 dialog `<select>` 옵션 English → 한글+English 병기 (「준비 중 (PROVISIONED)」 · 「활성 (ACTIVE)」) · 교사 UX 향상 · ClassroomTable re-export 로 classroomDetail.tsx 뒤호환 · 3 회귀 테스트 · 웹 1024 (+3) · lint clean · 서버 무변경.
- **classroomDetail 복사 버튼** - v0.171 완료. 신규 `CopyButton` 컴포넌트 (navigator.clipboard.writeText 우선 · document.execCommand('copy') fallback · 성공 시 「복사됨 ✓」 2초 노출 · aria-label 에 value 포함) · classroomDetail 3곳 배치 (courseId 헤더 · 소유자 ID 정보 그리드 · Classroom URL 「URL 복사」 라벨) · 관리자가 Admin Console 이나 문서에 붙여넣기 원-클릭 지원 · 5 회귀 테스트 · 웹 1029 (+5) · lint clean · 서버 무변경.
- **CopyButton 이식 (userDetail · groupDetail)** - v0.172 완료. v0.171 CopyButton 을 userDetail (이메일 + 조직 단위) · groupDetail (이메일 + 헤더 그룹 email) 두 페이지로 확장 · 3 detail 페이지 (classroom · user · group) UX 일관성 달성 · 재사용만 · 웹 1029 · lint clean · 서버 무변경.
- **CreateGroup + EditGroup description textarea + 4096자 상한** - v0.173 완료 (v0.166 대칭). 신규 `lib/groupLimits.ts` shared `GROUP_DESCRIPTION_MAX = 4096` 상수 · CreateGroupDialog · EditGroupDialog description input 을 `<input type="text">` → `<textarea rows={3} className="resize-y">` 로 승격 · 실시간 「N / 4096 자」 카운터 (초과 시 red) · handleSubmit 상단 상한 초과 시 서버 요청 차단 · v0.166 BulkUpdate 도 shared 상수 사용으로 refactor (3 dialog 완전 통일) · 1 helper test · 웹 1030 (+1) · lint clean · 서버 무변경.
- **CreateClassroomDialog description 30,000자 상한 + 카운터** - v0.174 완료 (v0.173 대칭). Google Classroom courses.description 상한 30,000자 강제 · 실시간 「N / 30,000 자」 카운터 (초과 시 red) · textarea resize-y · handleSubmit 상한 초과 시 서버 요청 차단 · 신규 `lib/classroomLimits.ts` shared `COURSE_DESCRIPTION_MAX = 30000` 상수 · 1 helper test · 웹 1031 (+1) · lint clean · 서버 무변경.
- **classroomLimits name/section/room 상한 확장** - v0.175 완료 (v0.174 후속). shared `lib/classroomLimits.ts` 에 `COURSE_NAME_MAX = 750` · `COURSE_SECTION_MAX = 2800` · `COURSE_ROOM_MAX = 650` 상수 추가 · CreateClassroomDialog handleSubmit 상단 세 필드 상한 검증 → 초과 시 서버 요청 차단 + validation error 배너 · 3 helper test 확장 · 웹 1034 (+3) · lint clean · 서버 무변경.
- **BulkRenameClassroomDialog row-level 상한 검증** - v0.176 완료 (v0.175 이식). shared `COURSE_NAME_MAX` 를 BulkRename 각 row 에도 이식 · `overlyLongRows` useMemo · `canConfirm` 조건 · row 별 tooLong 경고 (rowError 통합) · summary 「상한 초과 N개」 카운트 · 2 회귀 테스트 · 웹 1036 (+2) · lint clean · 서버 무변경.
- **ClassroomTable CSV/JSON 내보내기** - v0.177 완료 (AccountsTable v0.152/v0.155 · GroupsTable v0.157 대칭 · 3 테이블 export 트릴로지 완결). 툴바 필터 초기화 옆 CSV/JSON 두 버튼 · CSV 컬럼 (id · 이름 · 섹션 · 상태 · 설명 · 링크 · 소유자 id · 생성/수정 시각) · JSON payload (exportedAt · scope · filters · totalCount · courses[]) · 파일명 classrooms-YYYY-MM-DD.csv|json (선택 있으면 -selected 접미사) · 선택 있으면 라벨 「(선택 N)」 · scope 필드 · exportCourses.length===0 이면 disabled · UTF-8 BOM · 5 회귀 테스트 · 웹 1041 (+5) · lint clean · 서버 무변경.
- **CreateUser/BatchCreate 성/이름 60자 상한 검증** - v0.178 완료 (v0.173/v0.174/v0.175/v0.176 시리즈 대칭 · Google Directory User 규격). 신규 `lib/userLimits.ts` (USER_FAMILY_NAME_MAX=60 · USER_GIVEN_NAME_MAX=60) · CreateUserDialog handleSubmit 검증 + 카운터 · BatchCreate row loop 검증 + aria-invalid + inline warn + summary count (v0.176 패턴) · 9 회귀 테스트 · 웹 1050 (+9) · lint clean · 서버 무변경.
- **EditUserDialog 성/이름 60자 상한 이식** - v0.179 완료 (v0.178 Create/Batch 대칭 완결). 관리자 → 사용자 → 편집 다이얼로그도 shared 상수 재사용 · handleSubmit 검증 + 카운터 (v0.178 문구 대칭) · Create/Batch/Edit 3 진입점 이름 상한 완전 대칭 · 4 회귀 테스트 · 웹 1054 (+4) · lint clean · 서버 무변경.
- **CreateGroup/EditGroup 이름 60자 상한 검증** - v0.180 완료 (v0.173 groupLimits 확장 · Workspace Directory `groups.name` 규격). shared `GROUP_NAME_MAX = 60` 추가 · CreateGroup + EditGroup handleSubmit 검증 + 「N / 60 자」 실시간 카운터 (초과 시 red) · 6 회귀 테스트 · 웹 1060 (+6) · lint clean · 서버 무변경.
- **CreateUser primaryEmail local-part 64자 상한 검증** - v0.181 완료 (RFC 5321 / Google Workspace 규격 · userLimits 확장). shared `USER_LOCAL_PART_MAX = 64` 추가 · CreateUserDialog handleSubmit 에 local-part 길이 검증 · 이메일 input 밑 「이메일 아이디 N / 64 자」 실시간 카운터 (초과 시 red) · 4 회귀 테스트 · 웹 1064 (+4) · lint clean · 서버 무변경. CreateGroup/BatchCreate 는 이미 `lib/emailInput.ts` LOCAL_PART_RE 로 강제됐던 gap.
- **NEIS CSV import 코스 이름 750자 상한 검증** - v0.182 완료 (v0.176 BulkRename row-level 패턴을 v0.145 NeisCsvImportDialog preview 에 이식). 신규 순수 helper `findOverlyLongPlanRows(plan, max)` · preview 상단 red 배너 · 초과 row 셀 red + 접미사 · 실행 버튼 disabled + title 안내 · 4 helper 회귀 · 웹 1068 (+4) · lint clean · 서버 무변경.

남은 후보:
- 없음 (Phase 6 완료 상태에 가까움).

### Phase 7 — 배포·운영 gate (사용자 조치 대기)
- **Identity Platform 업그레이드** — Firebase Console → Authentication → Settings.
- **커스텀 도메인 `cam-t.kr` 연결** — Firebase Console → Hosting.
- **서비스 계정 (bootstrap 스크립트용)** — 도메인 검증 통과된 사용자가 웹 로그인 후 첫 admin 승격으로 대체 가능.
- **Node 20 환경 재실행** — 판정불가 소거.
- **Emulator 43건 재실행** — Java runtime 확보 후 재실행.

### Phase 8 — 판정불가 소거 (Codex 감사 판정불가 항목)
- **실 Firebase Auth ↔ Firestore transaction 워크플로우 검증** — v0.107 의 CAS · post-write 3-way 분기가 실제 concurrency 하에서 동작함을 통합 테스트로 확인.
- **실 Workspace API 워크플로우 검증** — 도메인 서비스 계정 준비 후 실 Directory/Classroom/Chat API 호출로 판정불가 소거.
- **브라우저 통합 테스트** — Playwright/Cypress 로 실 UI 시각·keyboard·스크린리더 workflow 검증.

## 우선순위 근거

**단기 (v0.113 ~ v0.120)**: Phase 5 학교 workflow 포팅 시작. 원본 Apps Script 의 「★ 실무 워크플로우」 5 단계 (기초값 · 초기 계정 · 전입생 · 비밀번호 · 그룹 배정) 를 순차 포팅. 각 단계는 기존 callable (v0.94~v0.100 에서 대부분 준비 완료) 을 UI 로 감싸는 작업.

**중기 (v0.121+)**: Phase 6 감사·검색 UX 완성. Phase 7 배포 gate 는 사용자 조치 필요.

**장기**: Phase 8 판정불가 소거는 실 인프라 접근이 확보되는 시점에.

## 참고

- 원본 기능 목록: `RESEARCH/school-webapp/FEATURES_CATALOG.md`.
- 감사 결과: `RESEARCH/SCHOOL_APP_V*_CODEX_AUDIT.md`.
- 세부 병합 이력: `project_notes.md`.
- 현재 열린 오더: `NEXT.md`.
