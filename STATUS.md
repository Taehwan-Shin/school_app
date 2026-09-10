# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 다음 UI 슬라이스 (v0.103+) | 헤드 | 준비 필요 | v0.102 첫 슬라이스 (토큰·shell) 완료. 후속 후보: (e1) 버튼/카드 radius 6/12px 전면 · (e2) Super Admin dashboard hero (Bricolage headline + highlight wash) · (e3) 사이드바 확장 (참고 이미지 아이콘·시간·bottom links) · (e4) KPI 카드·표·다이얼로그 세부 Say Briefly 명세 |
| 다음 제품 방향 확정 (v0.102+) | 사용자 | 답 대기 | (a)(b) 완료 · (b3) 감사 액션 필터 · (v0.102) Say Briefly 디자인 첫 슬라이스 완료. 후보: (c) 실 Workspace 확인 workflow · (b4) 감사 로그 다중 액션·행위자 필터 · (d) 그 외 |
| Identity Platform 업그레이드 (배포 차단 관문) | 사용자 | 답 대기 | Firebase Console → Authentication → Settings → Upgrade to Firebase Authentication with Identity Platform |
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
| v0.102 | `2b12361` (main) | Say Briefly 디자인 첫 슬라이스 — Google Fonts (Bricolage/Inter/Roboto Mono) · 토큰 재매핑 (forest ink · cream paper · highlighter yellow) · WCAG AA 대비 상향 · shell 시각적 재구성 (사이드바 로고 뱃지 · Topbar Bricolage 40px+/모바일 Inter · dark hover 안전) · UI_SYSTEM v2.0 재봉인 · 3 라운드 Codex 감사 |
| v0.101 | `bb5a8f5` | 감사 액션 필터 — AUDIT_ACTIONS shared 카탈로그 · readAudit/list filterAction (서버 정확 매치) · AuditLogTable 액션 드롭다운 · q substring 검색 message 확장 (role_split 탐색) · audit_log(action, at DESC) 복합 인덱스 · 2 라운드 Codex 감사 |
| v0.100 | `2324255` | admin console v2 다음 단계 — usersUpdateRole callable (system.manage_roles) + usersGetRole (users.read) + EditUserRoleDialog · claim 병합 · Firestore rollback · role_split 감사 · dialog fail-closed · role cache 갱신 · 3 라운드 Codex 감사 |
| v0.99 | `1a5b0e0` | admin console v2 첫 슬라이스 — CapabilityMatrixPage (`/super_admin/capabilities`) role×capability 매트릭스 시각화 (읽기 전용) · shared 상수 파생 · F14 문구 정정 · 2 라운드 Codex 감사 |
| v0.98 | `142fa23` | classroom+chat pair 통합 생성 — 학급 선택 하나로 course + space 동시 생성 · Promise.all legacy 조회 · course 실패시 chat 미시도 · F13 128자 pair 사전 컷 (orphan 방지) · 2 라운드 Codex 감사 |
