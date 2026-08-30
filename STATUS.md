# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 설계 v1.0 확정 (roles.md v1.0 · firebase_layout.md v0.12+ · DESIGN_v1.md) | 헤드 | **확정** (사용자 승인 `a335e09b1b35`) | 저장소 `docs/DESIGN_v1.md`·`docs/design/roles.md` v1.0·`docs/design/firebase_layout.md` |
| 첫 슬라이스 (모노레포·로그인·역할별 껍데기·Auth 트리거·감사 시험) | 헤드/일꾼/감사 | **병합 승인** (Codex 대상 `faceea9`) | HEAD 이후 유지. unit + emu 통과 |
| CI 슬라이스 (GitHub Actions · Node 20 · Java 21) | 헤드/일꾼/감사 | **병합 승인** (Codex 대상 `4888ea1`) | 원격 실행은 사용자 관찰 관문 |
| users.list slice (writeAudit 헬퍼 · ESLint AST · 3층 미들웨어 · Callable · 파일 stub emu 종단) | 헤드/일꾼/감사 | **병합 승인** (Codex 대상 `8c7fa81`) | functions 31 통과 · emu 10/10 통과 |
| Accounts UI slice (`/admin` 계정 목록 표 · useUsersList · GoogleAuthProvider scope · super_admin 접근 · 4xx no-retry) | 헤드/일꾼/감사 | **병합 승인** (Codex 대상 `a8b5a83`) | web 29 통과 · 총 65 unit |
| users.create + users.delete slice (callables · 본인 삭제 방지 · 앱 super_admin+Workspace admin 병렬 보호 · 다이얼로그 UI) | 헤드/일꾼/감사 | **병합 승인** (Codex 대상 `1933d12`) | 총 103 unit · v1.0 완료 조건 「계정 만들고 삭제」 코드층 완결 |
| Identity Platform 업그레이드 (배포 차단 관문) | 사용자 | 답 대기 | Firebase Console → Authentication → Settings → Upgrade to Firebase Authentication with Identity Platform |
| OAuth 동의 화면 도메인 정정 `cam-t.kr` → `cam.hs.kr` (배포 차단) | 사용자 | 답 대기 | Google Cloud Console → OAuth 동의 화면 → 승인된 도메인 |
| Node 20 환경 재실행 (배포 차단) | 헤드/사용자 | 판정불가 (환경) | Node 20 환경에서 `pnpm -r test` + `pnpm test:emu` 재실행. 지금은 Node 22 로만 확인. |
| 다음 오더 준비 (첫 실 관리 기능) | 헤드 | 시작 필요 | 「최소 실사용 슬라이스」 오더 후보: `users.list` callable + 계정 목록 UI · 첫 관리자 부트스트랩 스크립트 등 |
| 서비스 계정 유무 (bootstrap 스크립트용) | 사용자 | 답 대기 (지연 가능) | 로컬 `scripts/bootstrap_admin.ts` 가 Firestore custom claim 쓰려면 필요. 도메인 검증 통과된 사용자가 웹으로 로그인해서 첫 admin 을 승격시키는 방식으로 대체도 가능 |

## 되돌리지 않은 임시 변경

없음.

## 감시 중인 프로세스

없음.
