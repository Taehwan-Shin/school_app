# project_notes — 덧붙이기 전용 일지

> 실측·판정·부정 결과까지 여기. 「요약 정리」로 위장한 유실 금지. 커밋 전 삭제 줄 수 0 확인.

---

## 2026-08-30 · 킥오프

**사용자 요청** — Buzz `#general` 에서 bliss00 이 두 파일(계정관리.gs.rtfd.zip · 클래스룸관리.gs.rtf) 을 붙이고 *"이 두 파일에 있는 기능을 파이어베이스 기반으로 구축해서 직관적이고 편리한 웹앱으로 만들고 싶어"* 라 함. `[사용자 결정]` — 원문 인용.

**한 사이클 앞 자료** — 사용자가 채널에 오려붙인 두 문서:
1. Claude+Antigravity+Codex 로 개발하기 (방법론)
2. OPERATIONS.md 실제 운영 사례 (학교 시스템 `portal.hmh.or.kr`)

두 문서는 **방법**만 정한다. **목표**(무엇을 만들지) 는 이 두 파일이다.

**읽기 완료 — 기능 목록** — `RESEARCH/school-webapp/FEATURES_CATALOG.md`. 원본:
- `계정관리.gs` 2,983 줄, 27 개 함수, 두 개의 시트 메뉴
- `클래스룸관리.gs` 478 줄, 15 개 함수, 탭 번호가 곧 워크플로우

**핵심 발견** `[판단]` — 파이어베이스는 워크스페이스 관리를 대체하지 못한다. Firebase Auth/Firestore/Functions/Hosting 은 **호스팅과 로그인과 앱 상태**를 맡고, **AdminDirectory·Classroom·Chat API 호출은 서비스 계정으로 Cloud Functions 안에서 그대로 유지**해야 기능이 산다. 이 사실을 사용자에게 명시적으로 알림 (`buzz messages send` event `20f5ac295ad8...`).

**사용자에게 넘긴 결정 세 가지**:
1. 로그인 대상 (관리자 혼자 vs 교사·부장 각자)
2. 워크스페이스 서비스 계정 유무
3. 저장소 위치 (Buzz `repos create` / GitHub)

답 대기 중. 그동안 프레임워크 뼈대 초안을 `OUTBOX/school-webapp-scaffold/` 에 짜 둔다 — 답에 따라 옮긴다.
