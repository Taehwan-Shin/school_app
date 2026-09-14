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
