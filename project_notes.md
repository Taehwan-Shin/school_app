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

---

## 2026-08-30 · Codex 1차 감사 결과 · 전건 재확인

**감사 이벤트** — Buzz `e61d2d979187...`, 대상 커밋 `7ab9c1a`. 11개 항목 (10 실패 · 1 판정불가 · 1 통과).

**전건 재확인 결과** (지목한 `파일:줄` 을 직접 열어 검증) — `AGENTS.md` §「감사의 실패 주장을 받았을 때」 규약대로.

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `roles.md:25` [판정불가] 역할 다섯의 학교 적합성 | 수용 — 도메인 문제 | 사용자 결정 필요 |
| `roles.md:95` [실패] OU 대조만으로 서버 강제 불가 | **사실** — 부서↔OU 매핑·대상 리소스 검증 명시 없었음 | 이번 작업 |
| `roles.md:102` [실패] initial_admins.json 위험 | **사실** — 공개·커밋 접근자 위험 명시 안 함 | 이번 작업 |
| `firebase_layout.md:121` [실패] getIdToken(true) ≠ 액세스 토큰 갱신 | **사실** — Firebase ID 토큰과 Google OAuth 액세스 토큰을 혼동 | 이번 작업, **가장 무거운 오류** |
| `firebase_layout.md:162` [실패] 전면 함수 경유 과도 | **사실** — 비민감 컬렉션 직접 읽기 안 검토 | 이번 작업 |
| `firebase_layout.md:173` [실패] asia-northeast3 지원 됨 | **사실** — 「실측 필요」가 아니라 확정 가능 | 이번 작업 |
| `firebase_layout.md:105` [실패] Gmail·chat.admin.* 스코프 누락 | **사실** — 원본 `sendMailtoUsers` 대응 스코프 없음 | 이번 작업 |
| `firebase_layout.md:175` [실패] Chat 관리자 = 서비스 계정 판단 오류 | **사실** — `useAdminAccess=true` 로 사용자 OAuth 만으로 됨 | 이번 작업 |
| `firebase_layout.md:86` [통과] pages ↔ tabs 대응 | 수용 | — |
| `firebase_layout.md:169` [실패] 미들웨어 대상 자원 검증 명시 없음 | **사실** — 역할 조회만 함 | 이번 작업 |
| `roles.md:35` [실패] 함수 4개 + 챗 권한 설정 누락 | **사실** — `FEATURES_CATALOG.md` 대비 확인, 실제 누락 | 이번 작업 |

**모든 실패가 이번 작업이 만든 것이므로 반영한다.** 판정 불가 하나는 사용자 문의에 걸린 것과 겹침 (`e477b6787371...` 에서 이미 물음).

**v0.2 반영 상세**:
- `roles.md`: 헤더 v0.2 · §3-3 챗 권한 설정 행 추가 · §3-4 클래스룸 함수 4개 추가 · §4 부서·자원 검증 3-단 절차 신설 · §5-3 부트스트랩 대안(로컬 스크립트) 명시.
- `firebase_layout.md`: 헤더 v0.2 · §4 두 토큰 구분 표 + 세션 수명 실전 의미 추가 · §4 스코프 목록에 Gmail·chat.admin.* 추가 · §5 rules 를 컬렉션별 세 층 표로 재구성 · §6 세 층 미들웨어 신설 · §7 확정(asia-northeast3·useAdminAccess=true·세션 수명) 과 미결(CSRF·비용·Cloud Tasks 정식화) 분리.

**다음 걸음** — v0.2 커밋 → Codex 재감사 파견 (회귀 없음 확인). 병렬로 사용자 응답 대기 (역할 구조 · 부서 판별).

---

## 2026-08-30 · Codex 2차 감사 결과 · 전건 재확인

**감사 이벤트** — Buzz `2fa71257c4b8...`, 대상 커밋 `ab80bb8`. 11개 항목 (6 통과 · 5 새 실패).

**통과 6건** — 앞선 10개 실패의 봉인 확인. 유지.

**새 실패 5건 재확인 결과**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:121` 토큰 주체 대조 없음 | **사실** — Firebase ID 토큰 이메일과 Google 액세스 토큰 tokeninfo 이메일 일치 검증 명시 안 됨 → 사용자 A 로 감사, B 권한으로 API 태우기 가능 | 이번 작업 (감사 1차 반영 시 놓침) |
| `firebase_layout.md:180` `basic_data/current` 학생 PII 노출 | **사실** — 원본 `importInitialStudentData` 가 학생 명단 채움. 직접 읽기 모든 viewer 허용은 개인정보 노출 | 이번 작업 |
| `firebase_layout.md:48` 리전 자기모순 | **사실** — §7-1 확정 `asia-northeast3` 이지만 §1 큰 그림·§2 는 여전히 `us-central1` | 이번 작업 (v0.2 반영 불완전) |
| `firebase_layout.md:115` `chat.admin.delete` 누락 | **사실** (Codex 주장 신뢰 · 실증 필요) | 이번 작업 |
| `firebase_layout.md:136` Cloud Tasks 모델 모순 | **사실** — Cloud Tasks 는 서버 실행이라 브라우저의 토큰 재발급이 큐 안 작업에 안 닿음. 모델 자체가 부정합 | 이번 작업 (v0.2 반영 시 편의로 붙임) |

**v0.3 반영 상세**:
- `firebase_layout.md`: 헤더 v0.3 + v0.2 변경점 함께 유지. §1 큰 그림 리전 `asia-northeast3` 로 갱신. §2 마찬가지. §4 인증 흐름 (a)~(d) 로 토큰 주체 대조 절차 명시. §4 스코프에 `chat.admin.delete` 추가 (미결 §3 에 실증 요청). §4 세션 수명 재작성 — **Cloud Tasks 폐기, 브라우저 주도 청크 처리로 확정**. §5 컬렉션 `basic_data/current` 를 공개 구조만 두고 `student_roster/{class_id}` 신설. §5 rules 표에 `student_roster` 행 추가 (함수 경유만). §7 확정 3건 유지 + 확정 2건 추가 (토큰 주체 · student_roster 분리), 미결 재정리.
- `roles.md`: 이번 라운드 변경 없음 (Codex `roles.md:76` [통과]).

**다음 걸음** — v0.3 커밋 → Codex 3차 감사 파견 (회귀 없음 확인). 통과되면 v1.0 승격 (사용자 역할 구조 확정과 병렬).
