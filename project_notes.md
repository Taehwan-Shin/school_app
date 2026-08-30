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

---

## 2026-08-30 · 사용자 답 1차

- **1번 로그인** `[사용자 결정]` — *"계정에 따라 기능 탭이 차등적으로 부여되는 구조"*. → 로그인한 사람의 이메일·역할로 화면을 갈라 보여주는 구조.
- **2번 인증 모델** `[사용자 결정]` — *"클라우드 프로젝트 없이 로그인한 계정 권한으로 API를 사용할 수는 없어?"* 로 방향 전환 제안. 헤드는 **ⓑ 로그인 사용자 OAuth** 모델 추천 — 이유: (a) 지금 시트 스크립트와 같은 모델, (b) 서비스 계정 JSON 키가 서버에 안 얹혀도 됨, (c) 도메인 전체 위임을 요청할 필요 없음, (d) 이 프로젝트에 사람 없이 도는 자동 작업 없음. 사용자에게 ⓐ(서비스 계정) 로 갈지 명시적 확인 요청함 — 되돌리기가 곧 비싸짐.
- **3번 저장소** `[사용자 결정]` — `https://github.com/Taehwan-Shin/school_app` (빈 저장소).

## 2026-08-30 · 뼈대 커밋 · 훅 검증

- `REPOS/school_app/` 에 클론 후 뼈대 파일 이동. 첫 커밋 **d83e9e3** — `chore: 뼈대 커밋 — AGENTS·STATUS·일지·훅`.
- `git config core.hooksPath .githooks` 활성화. 훅 검증 실측:
  - `project_notes.md` 마지막 한 줄 삭제 후 커밋 시도 → **훅이 정상 차단** (exit 1, 메시지 *"project_notes.md 에서 줄 삭제가 감지됨. 덧붙이기 전용."*). 파일 복원 후 트리 깨끗함 확인.
- `git push -u origin main` 성공. 원격 상태: `main`.
- 커밋 작성자 = `Claude Code_Honey <honey@school-app.local>`. 헤드가 만든 것이므로 헤드가 커밋함 (`AGENTS.md` §「커밋은 만든 사람이」 대로).

**남은 봉인 대기** — 사용자 이의 없으면 ⓑ 로 확정하고 역할 매트릭스 → Firebase 구조 설계로 진행. `STATUS.md` 참조.

---

## 2026-08-30 · 설계 초안 v0.1

- `docs/design/roles.md` v0.1 작성. 역할 다섯 (`super_admin`·`admin`·`dept_head`·`teacher`·`viewer`) + 탭별 5×N 매트릭스 + 서버 게이팅 원칙. `[판단]` — 학교 조직 실제 분류를 모르므로 미결 4건 명시.
- `docs/design/firebase_layout.md` v0.1 작성. React+Vite+TS SPA · Cloud Functions 2세대 · Firestore · Firebase Auth (Google provider + 추가 스코프). 저장소 폴더 트리 · 인증 흐름 · Firestore 컬렉션 · 알려진 미결 6건 (특히 함수 리전 · 리프레시 토큰 · Chat API 관리자 위임 케이스) 명시.
- 두 문서 모두 `[초안]` 라벨. 감사(Codex) 통과 전이므로 다른 문서가 인용 시 v0.1 로 표기.
- `AGENTS.md` §1 「인증 모델 = ⓑ」 로 갱신. §2 「Buzz 릴레이 위 에이전트」 로 갱신 (원 가이드는 `agy`/`codex exec` 을 전제하지만 이 저장소는 Buzz `@mention` 으로 대체).
- `STATUS.md` 갱신 — 설계 초안 커밋됨, 감사 대기.

**다음 걸음** — Codex 에게 두 초안 감사 요청. 대상 커밋 해시 고정, 다섯 줄 규약 명시.
