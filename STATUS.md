# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 다음 제품 방향 확정 (v0.99+) | 사용자 | 답 대기 | (a) 「Classroom×Chat 학급 통합」 완료 (v0.97 chat bulk + v0.98 pair). 후보: (b) admin console v2 (역할 관리 UI + capability matrix) · (c) 실 Workspace 확인 workflow (v0.94~v0.98 판정불가 항목 소거) · (d) 그 외 |
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
| v0.98 | `142fa23` (main) | classroom+chat pair 통합 생성 — 학급 선택 하나로 course + space 동시 생성 · Promise.all legacy 조회 · course 실패시 chat 미시도 · F13 128자 pair 사전 컷 (orphan 방지) · 2 라운드 Codex 감사 |
| v0.97 | `f0cf35b` | chat bulk create — ChatBulkCreateDialog · basic_data 학급 단위 chat 스페이스 일괄 생성 · F12 displayName 128자 검증 (client + server) · 2 라운드 Codex 감사 |
| v0.96 | `e3dd87d` | classroom bulk create hotfix — F4~F11 · 4 라운드 Codex 감사 |
| v0.94 | `5a0f4df` | authz hotfix — F1/F2 teacher membership 사전 검증 · F3 teacher ownerId=me 강제 |
| v0.93 | `31ea9f7` | chat bulk invite — basic_data 학급 일괄 초대 |
