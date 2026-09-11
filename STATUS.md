# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 다음 제품 방향 확정 (v0.126+) | 사용자 | 답 대기 | v0.104~v0.125 병합 완료. 후보: 감사 액션별 위젯 정확 count aggregation · 전입생 계정 UX 세부 · audit sink 인프라 · (d) 그 외 |
| audit_log durable sink 인프라 | 사용자 | 답 대기 | v0.116 F78 잔재. 지금은 3x retry + Cloud Logging fallback (기본 30일 보존). 완전 durable 은 별도 sink 배포 (BigQuery/GCS 라우팅 + retention 정책) 필요 |
| Identity Platform 업그레이드 (배포 차단 관문) | 사용자 | 답 대기 | Firebase Console → Authentication → Settings → Upgrade to Firebase Authentication with Identity Platform |
| 웹앱 커스텀 도메인 `cam-t.kr` 연결 (배포 차단) | 사용자 | 답 대기 | Firebase Console → Hosting → Custom domain → `cam-t.kr` 추가 · DNS 레코드 등록. OAuth 승인된 도메인에도 `cam-t.kr` 유지. 이메일 도메인 `cam.hs.kr` 과 별개 |
| Node 20 환경 재실행 | 헤드/사용자 | 판정불가 (환경) | Node 20 환경에서 `pnpm -r test` + `pnpm test:emu` 재실행. 지금은 Node 22 로만 확인 |
| Emulator 43건 재실행 | 헤드 | 판정불가 (환경) | 로컬 Java runtime 부재. v0.93 병합 시점 수치 (43건 통과) 유지 사용 |
| 서비스 계정 유무 (bootstrap 스크립트용) | 사용자 | 답 대기 (지연 가능) | 로컬 `scripts/bootstrap_admin.ts` 가 Firestore custom claim 쓰려면 필요. 도메인 검증 통과된 사용자가 웹으로 로그인해서 첫 admin 을 승격시키는 방식으로 대체도 가능 |

## 되돌리지 않은 임시 변경

없음.

## 감시 중인 프로세스

없음.

## 최근 병합 (요약, 상세는 `project_notes.md`)

| 버전 | 커밋 | 요약 |
|---|---|---|
| v0.125 | `6025fe1` (main) | AccountsTable 「필터 초기화」 button (v0.112 AuditLogTable 대칭) — 검색 input 옆 버튼 · onClick 은 `setSearchParams(new URLSearchParams())` 로 URL param 전부 원자적 clear. F101 활성 판정을 실제 필터 규칙 기준으로 정규화 (q trim non-empty · kpiFilter allowlist · sortColumn non-null · dir 단독 제외). F102 LocationSpy 회귀 (URL search === '' + DOM 사용자 복원) + boundary 4건. 웹 781 unit (+9). 2 라운드 Codex 감사 |
| v0.124 | `963495c` (main) | BulkSuspendDialog 에 F99/F100 대칭 적용 — v0.123b 의 accountability + a11y 패턴을 pre-existing 대칭 다이얼로그에도 마무리. runEmails snapshot state · displayEmails 도입 · label htmlFor/id 연결. 웹 772 unit (+2). 1 라운드 Codex 감사 |
| v0.123 | `75eac51` (main) | BulkRestoreDialog (AccountsTable 「선택 복구」) — BulkSuspend 대칭 UI. 3-phase confirm/running/done · 대상 개수 확인 입력 · 실패 목록. usersUpdate({suspended:false}) 순차 호출, 이미 정상 계정도 no-op 성공. F99 confirm 시 emails snapshot 확정 · running/done 은 snapshot 렌더 (부모 selection 변경 방어). F100 label htmlFor + input id 연결. 웹 770 unit (+7). 2 라운드 Codex 감사 |
| v0.122 | `6f925f8` (main) | SuperAdminPage 액션별 위젯 window breakdown — 오늘/이번 주/이번 달 segmented control (role=group, aria-pressed). 주 시작=월요일 00:00, 월 시작=1일 00:00. 별도 breakdownSummaryQuery 로 breakdown 만 선택 window 적용, 상단 「오늘 이벤트」 KpiCard 와 preview 는 headline metric 안정성 유지 (항상 today). 위젯 제목/설명/링크 atMin/empty·truncated 메시지 label 이 선택 window 반영. 서버 변경 없음. 웹 763 unit (+6). Codex 1 라운드 통과 |
| v0.121 | `5aef31f` (main) | orgunits.insert 신규 OU 생성 UI — 신규 `orgunitsCreate` callable (users.write cap · `admin.directory.orgunit` rw scope · 이름 100자·슬래시 금지·부모 절대경로 검증 · 409 → already-exists) + `useOrgunitsCreate` 훅 (성공 시 orgunits list 캐시 invalidate). CreateUserDialog 안에 「+ 새 OU 만들기」 인라인 폼 (name/parent/description) · 성공 시 폼 접힘 + orgUnitPath 자동 채움 · busy 게이트 확장 (isCreatingOu 포함). F98 성공 후 audit 실패 시 응답 보존 — writeAuditWithBackup (3회 재시도 + Cloud Logging fallback + throw 안 함) 로 격리. 서버 14 · 클라 25 회귀. 2 라운드 Codex 감사 |
| v0.120 | `6be9db7` (main) | super_admin 대시보드 「오늘 액션별」 위젯 — `auditLogSummary` 확장 (actionCounts / sampleSize / sampleTruncated, SAMPLE_LIMIT=500 in-memory grouping). SuperAdminPage 정렬 bar-list + truncated 배너 + 액션 클릭 시 `audit?action=<>&atMin=today` 링크. F97 `actionCounts=undefined` 구 응답 backward-compat 「집계 미제공」 안내 분리 · 2 라운드 Codex 감사 |
| v0.119 | `cb743e5` (main) | CreateUserDialog OU 드롭다운 + 클래스룸 자동 배정 — bliss00 지시. 신규 `orgunitsList` callable (users.write cap · orgunit.readonly scope) + `useOrgunitsList` 훅. HTML5 datalist 기반 OU combobox (기존 목록 자동완성 + 자유 입력). ACTIVE 클래스룸 체크박스 + role 라디오 (student/teacher). 계정 생성 성공 후 순차 add. F91 OU 안내 정정 (「기존 OU 만 사용 가능」) · F92 submit snapshot + busy lock · F93 password 즉시 clear · F94 open gate · F95 handleClose busy 차단 · F96 event-based 회귀 · 4 라운드 Codex 감사 |
| v0.118 | `4a00f85` (main) | 감사 로그 배치 export — 「전체 JSON」 버튼 (hasMore=false 까지 서버 pagination 순회) · fetchAllAuditLog helper (pageSize=100, maxPages=100, AbortSignal 취소, onProgress) · F82 compound cursor `{seconds, nanoseconds, id}` + `orderBy(at DESC, __name__ DESC).startAfter` (ties 안전) · F83 fetch signal forward + await 뒤 abort 재검사 · F84 batch 에도 q filter 적용 (serverCount vs count 분리) · F85 error banner + dismiss · F86 Timestamp full precision · F87 AbortError 흡수 · F88 legacy 숫자 cursor 명시 거부 · F89/F90 정수·상한 검증 (`Number.isInteger`, nanoseconds 0..999_999_999, seconds ≤ 253_402_300_799) · 5 라운드 Codex 감사 |
| v0.117 | `c44f73f` (main) | classroom 상세 페이지 — 신규 라우트 `/admin/classrooms/:id` (딥링크·URL 공유) · CourseMembersDialog → CourseMembersPanel 리팩터 (dialog 제거) · ClassroomTable 이름 컬럼 Link 전환 · 상세 페이지 inline actions (아카이브/복구·소유자 이관·삭제) · super_admin 감사 링크 · F80 audit target URL param 서버 필터 (`?target=courses/<id>`) · F81 멤버 pending 중 코스 mutation disabled · 2 라운드 Codex 감사 |
| v0.116 | `70fac11` (main) | 클래스룸 소유자 이관 — classroomTransferOwnership callable (`classroom.transfer_owner` cap, super_admin/admin 전용) · teachers.get 404 시 teachers.create 자동 추가 후 patch(ownerId) · F74 ALLOWED_DOMAIN 서버 강제 · F75 add-then-patch 실패 시 4xx 보상 삭제 + rollback=ok/failed/skipped 감사 · F76 patch try 범위 축소 (audit 실패 오분류 방지) · F77 partial HttpsError.details wire (UI rollback 별 안내) · F79 partial audit 실패 시 details 유실 방지 · writeAuditWithBackup helper (3x retry + Cloud Logging fallback) · TransferClassroomOwnerDialog · 4 라운드 Codex 감사 (F78 durable sink 인프라 잔재는 별도 슬라이스로 분리) |
| v0.115 | `2da65ca` (main) | 클래스룸 archived bulk 관리 — ClassroomTable 다중 선택 (Set) + bulk actions bar (아카이브/복구, 방향별 disabled) · BulkArchiveClassroomDialog (BulkSuspend 3-phase, 순차 patch, 개별 실패 수집, 진행률) · F72 classroomPatch teacher membership 사전 검증 (기존 helper 재사용) · F73 confirm 시점 courses·direction snapshot 고정 (list invalidation 대비) · 2 라운드 Codex 감사 |
| v0.114 | `30e5c25` (main) | audit filter preset 저장 (localStorage) — 자주 쓰는 필터 조합 chip 저장/불러오기/삭제 · SavePresetResult status 로 write 실패 UI 반영 · read/write 정규화 대칭 (trim·60자·dedup·MAX 20) · normalizePresetName export UI/유틸 공유 · 2 라운드 Codex 감사 |
| v0.113 | `5cfca49` (main) | BulkResetPasswordDialog + ROADMAP.md — 원본 Apps Script 「비밀번호 일괄 변경」 (`updateUserPasswords`) 포팅 · BulkSuspend 패턴 · sensitive state clear (F65 close+실행 시작 시) · label htmlFor (F66) · ROADMAP Phase 5 재분류 (F67) · 취소 버튼 handleOpenChange 경로 (F68) · 3 라운드 Codex 감사 |
| v0.112 | `0fd1848` (main) | audit page 「필터 초기화」 버튼 — 활성 필터 하나라도 있으면 활성 · 모든 URL param 원자적 제거 · 공백-only q 는 v0.111c 대칭 미포함 · 1 라운드 Codex 감사 (6/0/2 첫 라운드 통과) |
| v0.111 | `7ef2057` (main) | audit page role_split quick filter — 프리셋 로우에 「role_split」 액션 preset 버튼 · toggle 활성/비활성 · aria-pressed 접근성 · empty-state 필터 판정 개선 (action/q 포함, trim 일치) · 3 라운드 Codex 감사 |
| v0.110 | `7b7a9bd` (main) | 미해결 role_split KPI 카드 — SuperAdminPage KPI 로우 5번째 카드 · count 표시 · scanIncomplete 방향 분리 (`N+` 하한 / `N?` 방향불확실) · 반응형 grid (md:2 lg:3 xl:5) · click anchor scroll · 3 라운드 Codex 감사 |
| v0.109 | `ef5fef8` (main) | role_split unknown row 자동 재확인 — 카드 mount 시 auth=unknown row 에 usersRecheckRoleSplit 자동 트리거 · mount-scoped budget (5) 로 총량 상한 · mutateAsync + Promise.allSettled 로 batch 완료 후 단일 invalidate · 4 라운드 Codex 감사 |
| v0.108 | `a70689e` (main) | 감사 로그 JSON export + 파일명 필터 요약 — 기존 CSV 옆에 JSON 내보내기 · payload 에 exportedAt · 정규화된 filter metadata · partial/hasMore · before/after 보존 · pageSize · downloadBlob 공통 헬퍼 · 2 라운드 Codex 감사 |
| v0.107 | `f7e5bb4` (main) | role_split 자동 복구 + 상태 재확인 — usersResolveRoleSplit callable (Firestore=Auth 동기화, CAS + Firestore transaction + post-write Auth 재검증 3-way 분기) · usersRecheckRoleSplit read-only callable (unknown row 재기록) · auditLogUnresolvedRoleSplits server-side aggregation (system.role_split_resolved + users.update_role 두 sync source 통합, target 별 최신) · super_admin 카드 복구/재확인 버튼 · 7 라운드 Codex 감사 |
| v0.104 | `5b721c5` (main) | audit multi-action filter — readAudit filterActions 배열 (Firestore `in` 최대 30) · list.ts callable 경계 dedup + 30 초과 fail-closed · AuditLogTable multi-checkbox popover (role=group) · URL 콤마 구분 다중 액션 · 2 라운드 Codex 감사 |
| v0.106 | `9db5dd0` (main) | server-side `system.role_split_detected` action — shared catalog 등록 · getRole callable 이 split 감지 시 새 action 으로 기록 · super_admin 카드 server 필터만 사용 (client filter 제거) · caveat 을 sample-scope → trigger-scope 로 단일화 · pagination 안내 loading/error 가드 (F38) · 2 라운드 Codex 감사 |
| v0.105 | `ef6fb16` (main) | SuperAdminPage role_split 감시 카드 — `users.read/error` 감사 이벤트 최대 50건 표본에서 `role_split` prefix client filter · AlertTriangle 아이콘 · 최근 3건 미리보기 · 「전수 대조 아님」 명시 `<strong>` 강조 · hasMore pagination 안내 · 전체 보기 링크 (action/result/q param) · 3 라운드 Codex 감사 |
| v0.103 | `eca8056` (main) | Say Briefly 디자인 revert + 아이콘 + 가독성 — v0.102 전체 되돌리기 + masstige.io 모노크롬 복원 · lucide-react 아이콘 (사이드바 각 항목 · Topbar 로그아웃 · 활성 stroke 2.25) · body 15→16 · small 13→14 · fg-muted #A3A3A3→#6B7280 (AA 4.83:1) · state 색 상향 · UI_SYSTEM v1.1 재봉인 · 3 라운드 Codex 감사 |
| v0.102 | `2b12361` | Say Briefly 디자인 첫 슬라이스 — Google Fonts · 토큰 재매핑 · Bricolage headline · WCAG AA · shell 재구성 · UI_SYSTEM v2.0 재봉인 · 3 라운드 Codex 감사 · **v0.103 에서 revert** |
| v0.101 | `bb5a8f5` | 감사 액션 필터 — AUDIT_ACTIONS shared 카탈로그 · readAudit/list filterAction (서버 정확 매치) · AuditLogTable 액션 드롭다운 · q substring 검색 message 확장 (role_split 탐색) · audit_log(action, at DESC) 복합 인덱스 · 2 라운드 Codex 감사 |
| v0.100 | `2324255` | admin console v2 다음 단계 — usersUpdateRole callable (system.manage_roles) + usersGetRole (users.read) + EditUserRoleDialog · claim 병합 · Firestore rollback · role_split 감사 · dialog fail-closed · role cache 갱신 · 3 라운드 Codex 감사 |
| v0.99 | `1a5b0e0` | admin console v2 첫 슬라이스 — CapabilityMatrixPage (`/super_admin/capabilities`) role×capability 매트릭스 시각화 (읽기 전용) · shared 상수 파생 · F14 문구 정정 · 2 라운드 Codex 감사 |
| v0.98 | `142fa23` | classroom+chat pair 통합 생성 — 학급 선택 하나로 course + space 동시 생성 · Promise.all legacy 조회 · course 실패시 chat 미시도 · F13 128자 pair 사전 컷 (orphan 방지) · 2 라운드 Codex 감사 |
