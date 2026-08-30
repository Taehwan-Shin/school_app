# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 설계 v1.0 확정 (roles.md v1.0 · firebase_layout.md v0.12+ · DESIGN_v1.md) | 헤드 | **확정** (사용자 승인 `a335e09b1b35`) | 저장소 `docs/DESIGN_v1.md`·`docs/design/roles.md` v1.0·`docs/design/firebase_layout.md` |
| 첫 슬라이스 (모노레포·로그인·역할별 껍데기·Auth 트리거·감사 시험) | 헤드/일꾼/감사 | **병합 승인** (Codex 대상 `faceea9`, 이벤트 `a7ed8ad277a5`) | 6 통과·1 판정불가. HEAD `faceea9`, 트리 깨끗. unit 21 통과 · emu 5/5 통과 (Codex 환경) |
| Identity Platform 업그레이드 (배포 차단 관문) | 사용자 | 답 대기 | Firebase Console → Authentication → Settings → Upgrade to Firebase Authentication with Identity Platform |
| OAuth 동의 화면 도메인 정정 `cam-t.kr` → `cam.hs.kr` (배포 차단) | 사용자 | 답 대기 | Google Cloud Console → OAuth 동의 화면 → 승인된 도메인 |
| Node 20 환경 재실행 (배포 차단) | 헤드/사용자 | 판정불가 (환경) | Node 20 환경에서 `pnpm -r test` + `pnpm test:emu` 재실행. 지금은 Node 22 로만 확인. |
| 다음 오더 준비 (첫 실 관리 기능) | 헤드 | 시작 필요 | 「최소 실사용 슬라이스」 오더 후보: `users.list` callable + 계정 목록 UI · 첫 관리자 부트스트랩 스크립트 등 |
| 서비스 계정 유무 (bootstrap 스크립트용) | 사용자 | 답 대기 (지연 가능) | 로컬 `scripts/bootstrap_admin.ts` 가 Firestore custom claim 쓰려면 필요. 도메인 검증 통과된 사용자가 웹으로 로그인해서 첫 admin 을 승격시키는 방식으로 대체도 가능 |

## 되돌리지 않은 임시 변경

없음.

## 감시 중인 프로세스

없음.
