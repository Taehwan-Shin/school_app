# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 다음 제품 방향 확정 (v0.109+) | 사용자 | 답 대기 | v0.104~v0.108 모두 병합 완료. JSON export 배포 완료. 후보: (c) 실 Workspace 확인 workflow · 자동 재확인 · 감사 로그 배치 export · (d) 그 외 |
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
