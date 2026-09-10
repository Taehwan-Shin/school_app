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

---

## 2026-08-30 · Codex 3차 감사 결과 · 전건 재확인

**감사 이벤트** — Buzz `a1ebda8d581d...`, 대상 커밋 `bdc35e3`. 7개 항목 (6 통과 · 1 새 실패).

**통과 6건** — 앞선 5개 실패의 봉인 확인 + `chat.admin.delete` 실존 확인. 유지.

**새 실패 1건 재확인 결과**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:213` audit_log rules-only 부족 | **사실** — Firebase Admin SDK 는 Firestore rules 를 우회하므로 rules 로만은 함수 코드가 audit_log 를 삭제·수정하는 것을 못 막음. append-only 는 세 겹으로 강제해야 함 (rules + 함수 코드 단일 헬퍼 + IAM 커스텀 롤) | 이번 작업 |

**v0.4 반영 상세**:
- `firebase_layout.md`: 헤더 v0.4 (변경점 명시). §5 「감사 로그의 append-only」 절을 「세 겹」 (rules + 함수 코드 헬퍼 + IAM 커스텀 롤) 로 재작성. §7 미결에서 `chat.admin.delete` 실존 검증 제거 (Codex 3차 통과), IAM 최소 권한 항목 신설.
- `roles.md`: 이번 라운드 변경 없음.

**남은 것**:
- Codex 4차 감사 (v0.4 회귀 확인)
- 사용자 역할 구조 확정 (v0.1 부터 판정불가로 남은 유일한 항목)
- 두 조건 충족 시 → v1.0 승격

---

## 2026-08-30 · Codex 4차 감사 결과 · 정직한 재검토

**감사 이벤트** — Buzz `286a0c4866d7...`, 대상 커밋 `7f8a8a4`. 6개 항목 (2 통과 · 4 실패).

**핵심 지적** — v0.4 의 「세 겹」 안 자체가 실제로 성립하지 않는다:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:220` rules `create: if request.auth != null` 이 위조 삽입 허용 | **사실** — 어느 로그인 사용자든 클라이언트 SDK 로 audit_log 문서를 만들 수 있음. 감사 로그 위조는 침해 그 자체 | 이번 작업 (v0.4 반영 시 오류) |
| `firebase_layout.md:222` IAM 커스텀 롤로 audit_log 만 좁힐 수 없음 | **사실** — Firestore IAM 은 프로젝트 단위. 같은 서비스 계정이 work_queues 등에 update/delete 도 해야 함 | 이번 작업 (v0.4 반영 시 오류) |
| `firebase_layout.md:224` (1)+(2) 「필수」는 성립 안 함 | **사실** — 코드 규약뿐 기술적 차단 아님. Admin SDK 는 여전히 삭제 가능 | 이번 작업 (v0.4 반영 시 오류) |
| `firebase_layout.md:221` grep 만으로 별칭·래퍼·동적 경로 못 잡음 | **사실** — 헬퍼 단일 진입 증명 못 함. AST + 에뮬레이터 테스트 필요 | 이번 작업 (v0.4 반영 시 강도 부족) |

**v0.5 반영 상세**:
- `firebase_layout.md`: 헤더 v0.5 (변경점 명시).
- §5 「감사 로그의 append-only」 절 재작성:
  - 클라이언트 rules `read, write: if false` — 위조 삽입 원천 봉쇄
  - 함수 코드 층 = 단일 헬퍼 + **AST 기반 ESLint 규칙** + **Firestore 에뮬레이터 테스트** (grep 은 보조)
  - IAM 커스텀 롤 안 **폐기 명시** — Firestore IAM 이 컬렉션 단위 불가
  - 새 3층 = **분리된 감사 기록기** (Pub/Sub → 단일 목적 함수) — 코드 표면적 축소가 실질 완화. v1.0 이후.
  - v1.0 에서 도는 것 = (1)+(2). 정직한 라벨.
- §5 rules 표의 `audit_log` 행 갱신.
- §7 미결 4번을 「분리된 감사 기록기」로 재명명.

**요지**: 이번 라운드가 v0.4 의 안 두 지점을 **원리적으로 성립 안 하는 것**으로 드러냈다. 감사가 아니면 「강도 보강」 정도로 미뤄 두었을 것.

---

## 2026-08-30 · 사용자 Cloud 값 회신 + Codex 5차 감사

**사용자 회신** `[사용자 결정]` — Buzz `162e4e2b2f09...`:
- 프로젝트 ID: `school-app-507112`
- OAuth 클라이언트 ID: `119238884749-u061f4pi62omsinf2ovmg1f10t11ifq6.apps.googleusercontent.com`
- 도메인: `cam-t.kr`

`firebase_layout.md` §2 에 확정 값 반영. 클라이언트 시크릿은 채널에 붙지 않음 (약속대로).

**Codex 5차 감사** — Buzz `635e46ac179c...`, 대상 `bccfa84`. 7개 (3 통과 · 3 실패 · 1 판정불가).

**통과 3건** — v0.5 의 세 반영 (rules 전면 차단 · IAM 폐기 · AST 방향) 봉인 확인.

**새 실패 3건 재확인**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:227` AST 만으로 별칭·래퍼·동적 경로 못 잡음 | **사실** — AST 는 정적 분석. 별칭·재바인딩·동적 경로 완벽 커버 불가. 런타임 mock 검증이 없으면 이 층은 부족 | 이번 작업 (v0.5 반영 시 과장) |
| `roles.md:122` roles 문서가 「rules 만으로 append-only」로 남아 firebase_layout §5 와 모순 | **사실** — v0.5 firebase_layout 은 rules 만으로는 부족하다고 명시했는데 roles.md 는 그대로 두었음 | 이번 작업 (감사 4차 반영 시 정합 확인 누락) |
| `firebase_layout.md:237` Pub/Sub 를 v1.0 이후로 미루면 남는 위험을 명시적으로 수용해야 함 | **사실** — v1.0 은 (1)+(2) 만으로 도는데 남는 위험(코드 실수·악의) 을 「이 수준으로 수용한다」 는 결정이 안 적혀 있었음 | 이번 작업 (설계 문서의 미결 상태) |

**판정불가 1건** — 사용자 역할 구조 확정 없으면 v1.0 승격 여부 별개로 판정 불가. 이미 사용자에게 문의 중.

**v0.6 반영 상세**:
- `firebase_layout.md`: 헤더 v0.6 (변경점 명시).
  - §2 사용자 회신 값 3개 반영 (프로젝트 ID · 클라이언트 ID · 도메인) + 개발 리다이렉트 URI · API 활성화 확인 필요 (Gmail 여부).
  - §5-(2) 를 (a) 단일 헬퍼, (b) AST 규칙 두 개 (리터럴 강제 + 비리터럴 컬렉션 경로 금지), (c) Firestore emulator + mock 런타임 검증 (별칭·동적 경로가 실행되는 순간 로그에 남음), (d) grep 보조 로 재작성.
  - §5 뒤에 「§5-A. v1.0 위험 수용 결정」 신설 — (a) 코드 규율 기반 v1.0 · (b) Pub/Sub 포함 v1.0 비교표 + 헤드 추천 (a). 사용자 결정 필요 명시.
- `roles.md`: 헤더 v0.3.
  - §4-3 「감사 로그는 append-only」 문장을 rules 하나로 강제된다고 오해할 여지 없게 재작성 → 자세한 3층 강제 방식은 firebase_layout §5·§5-A 를 가리키기만.

**남은 것**:
- Codex 6차 감사 (v0.6 회귀 확인)
- 사용자 역할 구조 확정
- 사용자 audit_log v1.0 위험 수용 결정 (a) 또는 (b)
- 세 조건 충족 시 → v1.0 승격

---

## 2026-08-30 · Codex 6차 감사 결과 · 과장 축소

**감사 이벤트** — Buzz `cfdaf5667de2...`, 대상 커밋 `7602787`. 6개 (3 통과 · 2 새 실패 · 1 판정불가).

**통과 3건** — AST 과장 삭제, roles/firebase 정합, (a) 위험 명시적 수용 절 — 모두 봉인 확인.

**새 실패 2건 재확인**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:264` (b) 「남는 위험 사실상 없음」 과장 | **사실** — Pub/Sub 격리는 Firestore 프로젝트 IAM 이 프로젝트 단위라 업무 함수의 Admin SDK 접근을 못 막음. 또 Pub/Sub 발행자가 위조 이벤트도 낼 수 있음. 실질 이득은 **표면적 축소**이지 격리 아님 | 이번 작업 (v0.6 반영 시 과장) |
| `firebase_layout.md:58` Gmail API 활성화 미확인 = 배포 차단 항목 | **사실** — 원본 `sendMailtoUsers` 대응 `gmail.send` 스코프가 있고, Gmail API 가 꺼져 있으면 동의 화면에서 실패. 역할 구조·audit_log 결정과 별개로 v1.0 배포 차단 | 사용자 확인 대기 (헤드는 이미 사용자에게 물었음 `201c1b7c...`) |

**판정불가 1건** — 역할 구조 사용자 확인. 이미 대기 중.

**v0.7 반영 상세**:
- `firebase_layout.md`: 헤더 v0.7.
  - §5-(3) Pub/Sub 격리 설명 정직화 — 「업무 함수 접근 불가」 대신 「정상 경로 코드 표면적 축소」로. Firestore IAM 이 프로젝트 단위라 격리 아님을 명시. 발행자 이벤트 위조 가능성도 추가.
  - §5-A (b) 열의 「남는 위험 사실상 없음」 을 정직한 문장으로 교체 — (a) 위험은 그대로 남고, Pub/Sub 발행자 위조 위험이 새로 생김. 실질 완화는 표면적 축소.
  - §5-A 헤드 추천 논거 갱신 — (b) 를 「격리」로 팔면 과장, 실질 이득은 표면적 축소.
  - §5-A 하단에 「외부 append-only 미러링 (BigQuery/Cloud Logging)」 옵션이 (a)/(b) 어느 쪽도 배제 안 함을 명시.
- `STATUS.md`: Gmail API 활성화 확인을 **배포 차단 항목**으로 별도 등록 (역할·audit_log 결정과 병렬).
- `roles.md`: 이번 라운드 변경 없음.

**남은 것**:
- Codex 7차 감사 (v0.7 회귀 확인)
- 사용자 답 세 건: 역할 구조 · audit_log 위험 수용 (a)/(b) · Gmail API 활성화 (또는 sendMailtoUsers 제외)
- 네 조건 충족 시 → v1.0 승격

---

## 2026-08-30 · Codex 7차 감사 결과 · Pub/Sub 신뢰 설계 추가

**감사 이벤트** — Buzz `12f426eecfab...`, 대상 커밋 `dc4f360`. 7개 (3 통과 · 3 새 실패 · 1 판정불가).

**통과 3건** — §5-(3) 표면적 축소 정직화 · §5-A (b) 열 재작성 · STATUS Gmail API 별도 항목. 봉인 확인.

**새 실패 3건 재확인**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:256` Pub/Sub 트리거 auth 컨텍스트 손실 | **사실** — Pub/Sub 트리거로 부른 함수는 원 callable 의 `context.auth` 를 못 받음. 페이로드의 `actor` 를 곧이곧대로 믿으면 발행자가 임의 actor 로 위조 가능 | 이번 작업 (v0.7 반영 시 놓친 실증) |
| `firebase_layout.md:253` 제목 「v1.0 이후 강도 보강」이 (b) 선택 시 v1.0 포함과 모순 | **사실** — 표는 (b) 선택 시 v1.0 에 포함이라 함. 제목이 조건부로 바뀌어야 함 | 이번 작업 (감사 5차 신설 시 조건 조율 못 함) |
| `STATUS.md:11` Cloud 프로젝트 항목이 「답 대기」로 남음 | **사실** — 사용자가 값 3개를 이미 회신했고 §2 에 반영됨. 답 대기가 아님. Gmail 만 별도로 남음 | 이번 작업 (v0.6 반영 시 STATUS 상태 미갱신) |

**판정불가 1건** — 사용자 결정 3건 (역할 · audit_log · Gmail) 제외하면 (a) 선택 시 승격 준비 완료. (b) 선택 시 위 서명 스키마 추가 작업 필요.

**v0.8 반영 상세**:
- `firebase_layout.md`: 헤더 v0.8.
  - §5-(3) 제목을 조건부로 정정: 「선택 (b) 시 v1.0 포함, 선택 (a) 시 v1.1」.
  - §5-(3) 에 **Pub/Sub 인증 컨텍스트 손실** 명시. (b) 를 구현하려면:
    · 서명된 이벤트 스키마 (서버 생성 메타데이터를 함께 서명)
    · 또는 GCP 서비스 계정 신원 토큰 검증
    · `request_id` 기반 idempotency (Pub/Sub at-least-once)
- `STATUS.md`:
  - 인증 모델 항목을 「사용자 §2 값 회신으로 실질 확정」으로 갱신 (더 이상 답 대기 아님)
  - Cloud 프로젝트 항목을 「회신 완료」로 갱신
  - Firebase 구조 v0.8 로 갱신
  - Codex 8차 감사 대기
- `roles.md` 변경 없음.

**남은 것**:
- Codex 8차 감사 (v0.8 회귀 확인)
- 사용자 답 세 건: 역할 구조 · audit_log (a)/(b) · Gmail API
- 네 조건 충족 시 → v1.0 승격 (선택 (b) 면 Pub/Sub 서명 스키마 별도 문서 신설 후)

---

## 2026-08-30 · Codex 8차 감사 + 사용자 요청 반영

**사용자 요청** `[사용자 결정]` — Buzz `83c3d2d2ab59...`: *"감사 메시지가 섞이니까 내가 뭘 해야하는지 찾기가 어려워. 나에게 따로 메시지를 보내줄 수 있어? 이 스레드 말고?"*.
- 대응: bliss00 과 DM 채널 개설 (`f6e12a56-09c1-4825-bcc9-f8ca1e6f0fbd`, 이벤트 `f669ab9bc888...`). 사용자 결정 3건 (역할·audit_log·Gmail) 을 정리해 DM 발송 (`c68e5b7997d3...`). 스레드에는 짧게 응답 (`e6f520a2a363...`) — 감사 왕복은 스레드에, 사용자 결정·눈 확인은 DM 으로.
- 규칙 반영: 앞으로 사용자 대상 결정·안내는 DM 우선. 감사·Codex·구현 진행은 스레드.

**Codex 8차 감사** — Buzz `12f426eecfab...` (7차 대응) 이후 실제 8차 결과는 `12f426ee...` 다음 이벤트인 `dc4f360` 대상. 이번 세션은 실제로 `e8f8695` 대상 = Buzz 이벤트 신규. `12f426ee` 는 위에 이미 처리. 이 항목은 `f0823459...` 파견 → 결과 이벤트 (Codex 답신).

**Codex 8차 결과 (대상 `e8f8695`)** — 7개 (2 통과 · 4 새 실패 · 1 판정불가).

**통과 2건** — 조건부 제목 (§5-(3)) · STATUS Cloud 값 정합.

**새 실패 4건 재확인**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:260` 서명 스키마만으로 Pub/Sub 발행자 위조 완화 안 됨 | **사실** — 서명 키 접근권 있는 업무 함수가 임의 actor 로 서명 가능. 「내부 위조」는 안 막힘. 완화하려면 서명 게이트웨이 · 또는 GCP 신원 토큰 결속 | 이번 작업 (v0.8 반영 시 완화 주장 과장) |
| `firebase_layout.md:265` §5-A 결정문 · 표 제목 「Pub/Sub 격리」가 §5-(3) 정직화와 모순 | **사실** — 「격리」로 팔면 과장. 「표면적 축소」로 통일 필요 | 이번 작업 (v0.7 정직화 시 용어 통일 못 함) |
| `firebase_layout.md:282` (3) 「진짜 격리」 표현이 §5-(3) 정직화와 모순 | **사실** — 「진짜 격리」 는 §5-(3) 의 「완전한 격리는 아니다」 와 정면 충돌 | 이번 작업 (v0.7 반영 시 결론 재작성 미흡) |
| `firebase_layout.md:318` §7-미결 §4 「v1.0 이후 강도 보강」 이 §5-A 표와 다시 모순 | **사실** — §5-A 는 (b) 선택 시 v1.0 포함, §7 은 무조건 이후. 조건부로 바꿔야 함 | 이번 작업 (v0.8 반영 시 §7 갱신 누락) |

**판정불가 1건** — 위 네 정합·신뢰 경계 수정 뒤 (a) 선택 시 승격 준비 완료. (b) 선택 시 키 권한 분리·호출-actor 결속·서명 검증·idempotency 구현 명세 별도.

**v0.9 반영 상세**:
- `firebase_layout.md`: 헤더 v0.9.
  - §5-(3) 「서명 스키마의 한계 (내부 위조)」 절 신설 — 서명 키 접근권 있는 발행자가 임의 actor 로 서명 가능. 완화는 서명 게이트웨이 함수 (호출자 신원과 결속된 채로만 서명) 또는 GCP IAM 서비스 계정 신원 토큰. 완전 봉쇄 아님 명시.
  - §5-A 결정문 · 표 제목 「Pub/Sub 격리」 → 「Pub/Sub 표면적 축소」.
  - §5 하단 결론에서 「(3) 만이 진짜 격리를 준다」 → 「(3) 은 표면적 축소를 얹을 뿐」로.
  - §7-미결 §4 에 조건부 일정 (「선택 (b) 시 v1.0, 선택 (a) 시 v1.1」) 추가.

**남은 것**:
- Codex 9차 감사 (v0.9 회귀 확인)
- 사용자 답 3건 (DM 으로 정리 발송함)
- 네 조건 충족 시 → v1.0 승격

---

## 2026-08-30 · Codex 9차 감사 결과 · Pub/Sub 세부 정정 + 분리 제안

**감사 이벤트** — Buzz `9dc81d64fad0...`, 대상 커밋 `5bdc013`. 8개 (3 통과 · 3 실패 · 2 판정불가).

**통과 3건** — 조건부 일정 일관성 · 「표면적 축소」 통일 · 내부 위조 한계. 봉인 확인.

**새 실패 3건 재확인**:

| 항목 | 재확인 결과 | 원인 귀속 |
|---|---|---|
| `firebase_layout.md:262` 신원 토큰 함수별 계정 필요 | **사실** — 프로젝트 기본 서비스 계정을 모든 함수가 공유하면 임의 업무 함수도 같은 신원 토큰 발급 가능. allowlist + audience/issuer 검증 필요 | 이번 작업 (v0.9 반영 시 「어느 사용자를 대신해」만 짚고 「어느 함수가」 를 못 짚음) |
| `firebase_layout.md:259` `request_id` 만으로 at-least-once 중복 못 막음 | **사실** — 단순 「본 적 있는지」 검사는 경쟁 조건에 취약. `request_id` 를 문서 ID 로 삼고 Firestore `.create()` 원자적 실패로 처리해야 | 이번 작업 (v0.8 반영 시 idempotency 구현 방식 미명시) |
| `firebase_layout.md:284` 「기술적 격리 성립」 결론 여전히 틀림 | **사실** — 서명 통제해도 Admin SDK audit_log 수정 권한은 남음. IAM 컬렉션 단위 제한 부재라는 근본 한계 | 이번 작업 (v0.9 「격리」 삭제 시 이 문장 놓침) |

**판정불가 2건**:
- `firebase_layout.md:256` — (b) 를 v1.0 에 넣는다면 서명 게이트웨이·서비스 계정 분리·audience/issuer 검증·idempotency 를 한 보안 설계 문서로 분리하는 편이 감사 가능. **수용** — `docs/design/audit_pubsub_isolation.md` 로 분리 결정.
- `roles.md:127` — (a) 경로는 승격 준비 완료, (b) 는 별도 문서 필요. 기존과 동일.

**v0.10 반영 상세**:
- `firebase_layout.md`: 헤더 v0.10.
  - §5-(3) 신원 토큰 절: 함수별 전용 서비스 계정 + 발행자 allowlist + audience/issuer 검증 명시.
  - §5-(3) 중복 방지 절: `request_id` = 문서 ID + Firestore `.create()` 원자적 create. 트랜잭션 재시도 충돌 규칙 명세. update 절대 금지.
  - §5 하단 결론: 「기술적 격리는 서명 키 접근 통제까지 갔을 때 성립」 삭제. Admin SDK audit_log 수정 권한이 여전히 열려 있음, IAM 컬렉션 단위 제한 부재 명시. (3) 은 「기술적 격리」가 아니라 「정상 경로 축소 + 이벤트 위조 완화」 조합.
  - §5-A 「선택 (b) 시 별도 문서」 절 신설: `docs/design/audit_pubsub_isolation.md` 로 분리. 그 문서에서 다룰 것 목록 (함수별 서비스 계정 · 서명 게이트웨이 · 토큰 검증 · idempotency · 침입 시나리오 시험).
- roles.md 변경 없음.

**남은 것**:
- Codex 10차 감사 (v0.10 회귀 확인)
- 사용자 답 3건 (DM)
- (a) 선택 시 → v1.0 승격 (승격 후 첫 Antigravity 오더)
- (b) 선택 시 → `audit_pubsub_isolation.md` 작성 + 감사 → v1.0 승격

---

## 2026-08-30 · v1.0 확정 · 첫 오더 준비

**사용자 승인** `[사용자 결정]` — Buzz 스레드 `a335e09b1b35...`: *"좋아 그대로 진행해줘"*. `DESIGN_v1.md` 초안 (§3 역할 이름 · §9 스택 · §11 완료 지표) 승인.

**v1.0 확정 상태**:
- `docs/DESIGN_v1.md` — DM 세션(다른 세션의 헤드) 이 작성한 통합 설계 문서. `OUTBOX/school-webapp-scaffold/docs/` → 저장소 `docs/` 로 복사.
- `docs/design/roles.md` v1.0 — 역할 5개 → **3개(`super_admin`·`admin`·`teacher`) + 권한 카탈로그 + 매트릭스** 로 재작성. 「하드코딩 금지」 원칙 명시. 「부장」 등은 매트릭스 한 줄로 확장.
- `docs/design/firebase_layout.md` v0.12 — Codex 12차 감사 전 항목 통과. (a) 경로 v1.0 승격 승인 상태 (`fb89b6a5b526...`).

**남은 열린 결정** (v1.0 로그인 껍데기 이후에 필요):
- 워크스페이스 서비스 계정 유무 — Google API 실호출 시점 전.

**다음 걸음** — `docs/handoff/NEXT.md` 에 첫 화면 오더 등록:
- 모노레포 뼈대 (`packages/{shared,web,functions}` + pnpm workspace)
- Vite + React + TS + Tailwind + shadcn/ui 설정
- Firebase Auth 로그인 화면 (Google provider, `cam-t.kr` 도메인 제한)
- Auth 트리거 → `users/{uid}` 생성 → 기본 `teacher` custom claim
- 로그인 후 역할별 첫 화면 껍데기 3개 (super_admin/admin/teacher) — 내용 없이 라우팅만
- Firebase Emulator 로 로컬 개발 · 배포는 미정 (수동 승인)

**커밋 계획** — 오늘 두 커밋:
1. `docs: v1.0 확정 (DESIGN_v1 + roles.md v1.0 + STATUS 정리)` — 문서 확정.
2. `docs(handoff): 첫 화면 오더 (모노레포 뼈대 + 로그인)` — Antigravity 오더 파일.

Antigravity 호출은 스레드에서 `@Antigravity` 로.

---

## 2026-08-31 · 첫 슬라이스 · Antigravity 4 커밋 + Codex 첫 감사 + 헤드 반영

**Antigravity 첫 오더 (기준 `1c497e5`, 오더 `cb1abd9`)** — 네 커밋 조용히 만들고 스레드 보고 미실행. `33c4503` shared, `2e66d7b` functions, `b02dc66` web, `b12fc28` infra. 사용자 `629d3c4e3f25` "반응이 없는데?" 신호로 헤드가 실물 확인 후 처리.

**헤드 기계 관문 재확인 (HEAD `b12fc28`)** — `pnpm install` · `pnpm -r build` · `pnpm -r lint (tsc --noEmit)` · `pnpm -r test` (shared 5 · web 3 · functions 5, 총 13) 모두 통과. 트리 깨끗.

**Codex 첫 코드 감사** — Buzz `0b11e377e66b`, 대상 `b12fc28`. 14 항목 (9 통과 · 5 실패).

**실패 5건 전건 재확인**:

| 항목 | 재확인 결과 | 처리 |
|---|---|---|
| `onUserCreate.ts:48` v1 사용 (2gen 요구) | **사실** — `firebase-functions/v1` 임 | 다음 오더로 이월 (`beforeUserCreated` 마이그레이션) |
| `getMe.ts:15` 도메인·역할 검증 없음, teacher 기본값 | **사실** — 알 수 없는 role 도 teacher 로 넘어감. 도메인 검증 없음 | **헤드 직접 반영** (안전 자리) |
| `onUserCreate.test.ts:13` 전부 Vitest mock | **사실** — 에뮬레이터 흐름 미검증 | 다음 오더로 이월 |
| `auth.tsx:18` Emulator 사용자 로그인 경로 없음 | **사실** — signInWithPopup 만 있음 | 다음 오더로 이월 |
| `README.md:37` `npx firebase` 재현성 없음 | **사실** — firebase-tools 미고정 | **헤드 직접 반영** |

**헤드 반영 커밋**:
- `5ebbd5b` fix(functions): getMe strict domain/role validation
  - `handleGetMe` pure handler 분리
  - `unauthenticated` (인증 없음) · `permission-denied` (도메인 다름) · `failed-precondition` (role 미부여). teacher 기본값 폐기
  - 테스트 3 → 8 케이스
- `131508c` chore: pin firebase-tools + pnpm 빌드 승인
  - `pnpm emu` 스크립트 신설 + `firebase-tools ^13.29.1` devDep 고정
  - `.npmrc` `dangerously-allow-all-builds=true` (pnpm 11 빌드 승인, re2 등)
  - README `pnpm emu` 로 갱신

**전체 build/test 재확인 (HEAD `131508c`)** — functions 테스트 11 통과 (3 + 8), 전체 통과. `pnpm exec firebase --version` = `13.35.1` 확인.

**Codex 재감사 파견** — `01c8757146fd`. 병합 가능 판정 대기.

**다음 오더에 담을 이월 3건 + 신규 슬라이스**:
1. `onUserCreate` v1 → v2 (`beforeUserCreated` blocking trigger)
2. 함수 테스트 mock → Firebase Emulator 통합 테스트 (`onUserCreate` 실 트리거 wiring 시험 포함)
3. `packages/web/src/lib/auth.tsx` 에 Emulator 사용자 로그인 경로 추가 (실 도메인 로그인은 헤드가 별도)
4. 신규: 첫 실 관리 기능 (예: `users.list` 서버 함수 + 계정 목록 UI) — 서비스 계정 준비 후에

**Antigravity 로그 규율** — 커밋 후 스레드 보고를 하지 않는 문제. 다음 오더의 「상태 보고」 절을 더 크게 강조하거나 헤드가 `git log` 로만 파악하도록 규칙 명시.

---

## 2026-08-31 · 도메인 정정 · 코드 정정 · Codex 최종 감사 반영

**사용자 회신** `[사용자 결정]` — Buzz `0e3acf212a56`: *"사용하는 학교 도메인은 cam.hs.kr 이야. 최고관리자 구글 계정도 admin2@cam.hs.kr 이고"*.
- 초기 Cloud 값 회신 `162e4e2b2f09` 에서 `도메인: cam-t.kr` 라 적혀 있었는데 오기. 실 도메인은 `cam.hs.kr`.
- **사용자 조치 필요** — Google Cloud Console → OAuth 동의 화면에서 도메인 제한을 `cam.hs.kr` 로 갱신. 서비스 계정·클라이언트 ID 그대로 사용 가능.

**Codex 최종 감사** — Buzz `1edb1048f20b`, 대상 커밋 `f8447d5`. 4 통과 · 3 실패 · 1 판정불가.

**통과 4건** (유지):
- `.npmrc` 좁힘 · Gen2 blocking trigger · Firestore 8085 포트 일관 · emu 테스트 3/3 은 Codex 환경(Java 있음)에서 실 실행됨

**새 실패 3건 재확인 결과**:

| 항목 | 재확인 | 처리 |
|---|---|---|
| `emu.test:24` handleUserCreate 를 직접 호출해서 wiring 미검증 | **사실** — 배선된 트리거가 도는지 종단으로 안 봤음 | **헤드 반영** (커밋 `34d5dc0`): (B) `admin.auth().createUser()` → 실 Auth Emulator 를 통해 배선된 `beforeUserCreated` 를 호출, customClaims + `users/{uid}` 문서까지 검증. 기존 (A) 순수 handler 층은 유지. |
| `auth.tsx:30/63` 개발 로그인 이메일/비번만 만들고 role 미검증 + `|| 'teacher'` 기본값 | **사실** — dev 로그인 시 트리거가 도는 emulator 는 role 을 심어야 정상. 지금은 클라이언트가 미부여 상태를 teacher 로 관대하게 넘겨 잘못된 라우팅 위험 | **헤드 반영** (커밋 `34d5dc0`): `|| 'teacher'` 폐기, super_admin·admin·teacher 셋만 승인, 그 외 null → `/login` 되돌림 (`getRouteForRole`). |
| `NEXT.md:90` 실 배선 검증 없이 병합 불가 | **사실** — 위 두 자리가 봉해지면 해소 | 위 두 반영으로 해소 예상. Codex 재감사 대기. |

**판정불가 1건** — Node 20 실측 (Codex도 Node 22 사용). 환경 이슈로 수용.

**커밋**:
- `34d5dc0` fix: Codex 최종 감사 반영 — role 엄격화 + emu 테스트 배선 시험
- `7e99fff` refactor: 도메인 cam-t.kr -> cam.hs.kr (사용자 정정)

**남은 것**:
- Codex 마지막 재감사 (대상 `7e99fff`)
- 사용자 Cloud Console OAuth 동의 화면 `cam.hs.kr` 로 갱신 (헤드가 대신 못 함)
- 승인되면 첫 슬라이스 병합 → 첫 실 관리 기능 오더 (예: 실 로그인 + 계정 목록)

---

## 2026-08-31 · 첫 슬라이스 병합 승인

**Codex 최종 재감사** — Buzz `a7ed8ad277a5`, 대상 커밋 `faceea9`. **6 통과 · 1 판정불가**.

**통과 6건**:
- `emu.test.ts:120·140` — 실 `pnpm test:emu` 에서 REST `accounts:signUp` 이 `beforeUserCreated` 를 실제 발동, 5/5 통과. 외부 도메인 signUp 은 실패로 확인.
- `firebase_layout.md:67` Identity Platform 요구 명시 (콘솔 경로·배포 전 조건·Emulator 한계 포함).
- `NEXT.md:56·98·101` 포트 정합 · 병합 승인 · README E2E 이월 가능.
- **첫 슬라이스 병합 승인**.

**판정불가 1건**:
- `packages/functions/package.json:21` Node 20 호환성 — 이번 실 실행은 Node 22. 배포 전 Node 20 재실행 필요.

**Pre-deploy 관문 (배포 차단 항목, 병합은 무관)**:
1. **Identity Platform 업그레이드** — Firebase Console → Authentication → Settings → Upgrade. 사용자 조치.
2. **OAuth 동의 화면 도메인** — `cam-t.kr` → `cam.hs.kr`. 사용자 조치.
3. **Node 20 환경 재실행** — 지금은 Node 22 만. 실 배포 인프라·CI 가 Node 20 이어야 함.

**병합된 첫 슬라이스 최종 상태** (HEAD `faceea9`, 커밋 `b12fc28` ~ `faceea9`):
- `packages/shared` — Role · Capability · ROLE_CAPABILITIES 매트릭스 (roles.md v1.0 §2.2 그대로)
- `packages/web` — Vite+React+TS · shadcn/ui 최소 · Firebase Auth Google 로그인 (도메인 `cam.hs.kr`) · 개발 전용 Emulator 로그인 · 역할별 껍데기 라우팅
- `packages/functions` — Firebase Functions 2세대 (Node 20 요구) · `beforeUserCreated` blocking trigger · `getMe` callable 엄격 검증 · Emulator 통합 테스트 (A) 순수 handler + (B) REST signUp 배선
- 인프라 — Firestore Rules 최소 (audit_log 클라이언트 완전 차단) · Firebase Emulator Suite · pnpm workspace · CI 미도입 (다음 오더로)
- 단위 테스트 21 (shared 5 · web 5 · functions 11) · Emulator 통합 5 (Codex 환경)

**다음 오더 후보** (헤드 검토 중):
1. **CI 도입** — GitHub Actions 로 PR 마다 `pnpm -r build/test/lint` + `pnpm test:emu`. Node 20 강제. Codex 판정불가 를 CI 가 해소.
2. **첫 실 관리 기능 슬라이스** — `users.list` callable + 계정 목록 UI. Cloud Console 도메인·Identity Platform 정리 후에.
3. **첫 관리자 부트스트랩** — `scripts/bootstrap_admin.ts` 로 `admin2@cam.hs.kr` 를 첫 `super_admin` 으로 승격. 또는 웹으로 임시 승격 흐름.

**판단** — CI (1) 를 먼저. Node 20 관문·회귀 방지 두 마리 토끼. 그 다음 (2) 첫 실 관리 기능.

---

## 2026-08-31 · 도메인 두 자리 분리 명확화

**사용자 회신** `[사용자 결정]` — Buzz DM `04194276d43c`: *"이게 사용하는 선생님들 구글 계정은 cam.hs.kr 도메인인데 서비스하려는 웹 주소 도메인은 cam-t.kr을 이용하려고 해. 학교 홈페이지 주소를 서비스 주소로 사용할 수 없어서"*.

**정정** — 헤드가 이전에 「OAuth 동의 화면 도메인 정정 `cam-t.kr` → `cam.hs.kr`」로 STATUS 에 적은 것은 **오해**. 두 도메인은 서로 다른 자리를 채운다.

**세 자리 도메인 (v1.0 확정)**:

| 자리 | 값 | 위치 |
|---|---|---|
| 로그인 이메일 도메인 (교사·관리자 워크스페이스 이메일) | `cam.hs.kr` | Firebase Auth 이메일 검증 · `beforeUserCreated` blocking trigger 안 · 코드 안 이미 반영 (커밋 `7e99fff`) ✅ |
| 웹앱 커스텀 도메인 (사용자가 브라우저에서 여는 주소) | `cam-t.kr` | Firebase Hosting Custom domain · OAuth 승인된 도메인 (Firebase 기본 `*.web.app`·`*.firebaseapp.com` 은 자동) |
| Firebase 기본 호스팅 도메인 | `<project>.web.app` · `<project>.firebaseapp.com` | 자동, 설정 불필요 |

**사용자 회신 사유** — 학교 공식 홈페이지가 `cam.hs.kr` 을 이미 점유 (portal.hmh.or.kr 원본 학교시스템 참고, project_notes 킥오프 참조). 웹앱 서비스로는 사용 불가라 별도 `cam-t.kr` 확보.

**STATUS.md 갱신** — 「OAuth 동의 화면 도메인 정정」 항목을 **삭제**, 「웹앱 커스텀 도메인 `cam-t.kr` 연결」 항목으로 대체. 확인 방법에 세 자리 관계 명기.

**사용자에게 통지** — Buzz DM `7d6fc1e31026`. 이전 「OAuth `cam-t.kr` 제거」 지시 무효화, `cam-t.kr` 유지 요청.

**코드 층 확인 결과** — 저장소 안 grep (`cam.hs.kr`) 33 곳, 모두 로그인 이메일 도메인 자리로 옳음. 웹앱 호스팅 자리는 아직 코드에 하드코딩된 곳 없음 (Firebase Hosting 은 배포 시점에 붙임). 코드 변경 없이 문서만 정정.

**여전히 열린 사용자 조치 (배포 차단)**:
1. Identity Platform 업그레이드 (Firebase Console)
2. Google API 활성화 확인 (Gmail · Admin SDK · Classroom · Chat)
3. 웹앱 커스텀 도메인 `cam-t.kr` 연결 (Firebase Console → Hosting + DNS)
4. (선택) 로컬 Java 설치

**갈래 A/B 판정** — 사용자 응답 대기 중. 도메인 명확화가 갈래 A (실 워크스페이스 시험) 로 가는 준비의 핵심 조각이었음.

---

## 2026-08-31 · 갈래 A · 서브도메인 `t.cam.hs.kr` 선택 + 프로젝트 ID 정정

**사용자 결정** `[사용자 결정]` — Buzz DM `90292b586e74`: **갈래 A** (실 워크스페이스 시험) 선택. 웹앱 서비스 도메인은 **`t.cam.hs.kr`** — 학교가 이미 소유한 `cam.hs.kr` 의 서브도메인. `cam-t.kr` 대신 이 선택이 DNS 편집 관점에서 더 깔끔.

**Firebase Hosting 도메인 등록 절차 진행 상황**:
1. 사용자 Firebase Console → Hosting → 맞춤 도메인 추가 → `t.cam.hs.kr` 입력 완료
2. 가비아 DNS 에 레코드 추가 시도 → **ACME 인증 실패 에러** (스크린샷 `d52f54dc3641`)
3. 원인 — 기존 A 레코드 `t.cam.hs.kr → 121.254.178.236` (학교 서버 IP 또는 `*.cam.hs.kr` 와일드카드) 이 남아 있어서 Firebase 의 Let's Encrypt HTTP-01 challenge 가 404. Firebase 가 요구:
   - **추가**: CNAME `t.cam.hs.kr → school-app-5a636.web.app`
   - **삭제**: A `t.cam.hs.kr → 121.254.178.236`
4. **사용자에게 요청** — 가비아 DNS 관리 화면 스크린샷 (`8fd3518768fa`). CNAME 실제 등록 여부·삭제 대상 A 레코드 확인 위함.

**프로젝트 ID 정정** `[사용자 결정]` — 스크린샷 URL 에서 실제 프로젝트가 `school-app-5a636` 으로 확인됨. 이전 회신의 `school-app-507112` 는 오기. `school-app-5a636` 이 Firebase Console URL 뿐 아니라 자동 발급 도메인 (`school-app-5a636.web.app`) 에서도 확인됨.

**코드 정정** (헤드 처리, 사용자 무관):
- `.firebaserc` default project → `school-app-5a636`
- `packages/web/src/lib/firebase.ts` fallback config → `school-app-5a636.firebaseapp.com` · `school-app-5a636` · `school-app-5a636.appspot.com`
- `packages/web/src/api/users{List,Create,Delete}.ts` projectId fallback → `school-app-5a636`
- `packages/web/.env.example` → 모두 `school-app-5a636`
- `docs/design/firebase_layout.md` §2 확정 값 → `school-app-5a636` (정정 이력 각주)
- `project_notes.md` 2026-08-30 회신 로그에도 정정 이력 각주

**남은 사용자 조치**:
1. 가비아 DNS 화면 스크린샷 → 다음 걸음 지시
2. (그 뒤) Firebase Auth Authorized domains 에 `t.cam.hs.kr` 추가
3. (그 뒤) Identity Platform 업그레이드
4. (그 뒤) OAuth 동의 화면 승인된 도메인 · OAuth 2.0 클라이언트 ID JavaScript 원본 · 리디렉션 URI 세 자리
5. (그 뒤) Gmail · Admin SDK · Classroom · Chat API 활성화 확인
6. (배포 직전) Firebase Console 웹 앱 Config 6 개 문자열 → `.env.production`

**커뮤니케이션 규칙 확정** `[사용자 결정]` — Buzz DM `1b70fd7fe4fd` 사용자 회신 *"너무 복잡하니까 하나씩 다시 알려줘"*. 헤드가 6항목 병렬 클릭 리스트를 드린 것이 과부하 원인. 앞으로 **콘솔·DNS 등 외부 시스템 설정은 한 걸음씩만** 드리는 걸로 전환. 각 걸음은 「어디 클릭 → 뭘 입력 → 어떻게 완료 확인」 세 줄. 사용자 확인 후 다음 걸음. 코어 메모리 `feedback_step_by_step.md` 저장 완료.

---

## 2026-08-31 (오후~밤) · E2E 프로덕션 도달 · CI 초록 · 팀 4자리 · UI 슬라이스 시작

**하루 요약** — 프로덕션 스택 처음으로 끝까지 굴러감. `admin2@cam.hs.kr` 로 `t.cam.hs.kr` 접속 → Google 로그인 → blocking trigger → Firestore users 문서 → custom claim → `/teacher` 렌더링 실 검증.

### 배포 여정 (사용자 조치 시리즈)

1. **Firebase Hosting 커스텀 도메인** — `t.cam.hs.kr` (사용자 서브도메인 선택 · `cam-t.kr` 대신). CNAME → `school-app-5a636.web.app`. 가비아 DNS. Let's Encrypt SSL 자동 발급 완료. (기존 wildcard A 는 명시적 CNAME 이 override.)
2. **Firebase Auth Authorized domains** — `t.cam.hs.kr` 추가.
3. **Identity Platform 업그레이드** — Firebase Console 에 UI 가 숨어 있어 Google Cloud Console 「Identity Platform」 검색 경로 사용. Blaze 결제 프롬프트 → 개인 Gmail 결제 계정으로 우회.
4. **개인 Gmail 을 project owner 로 추가** — 학교 워크스페이스 계정에 결제 카드 등록 불가 이슈. `admin2@cam.hs.kr` 는 여전히 프로젝트 관리자, 개인 Gmail 은 소유자·청구 관리자.
5. **OAuth 동의 화면 Internal** — `cam.hs.kr` 조직 소속이라 Internal 가능. 100 명 제한·앱 확인 절차 스킵.
6. **Firebase Auth Google sign-in 활성화** — Firebase 가 OAuth 웹 클라이언트 자동 생성.
7. **Firebase 웹 앱 Config 6 값 수집** — 사용자가 DM 붙임 → 저장소 `packages/web/src/lib/firebase.ts` fallback + `.env.example` 반영 (커밋 `1ac3699`).
8. **저장소 프로젝트 ID 정정** — `school-app-507112` → `school-app-5a636` (초기 회신에서 두 프로젝트 이름 혼동. 실제로는 두 개 존재, 사용 중인 건 `-5a636`). 커밋 `24a1ec9`.
9. **첫 Cloud Shell 배포** — `git clone` public repo 전환 (private → public, `.gitignore` 로 비밀 없음 확인) · `pnpm exec firebase login --no-localhost` · `pnpm build && firebase deploy --only hosting`. 로그인 성공, 첫 로그인 시 빈 화면 (예상 — trigger 미배포).
10. **Cloud Functions 배포** — `bash scripts/deploy-functions.sh` (`67d5ce7` 에 신설, pnpm workspace 우회 tarball 팩). 여러 IAM 관문 (`roles/cloudbuild.builds.builder` · `roles/artifactregistry.writer` · `roles/iam.serviceAccountUser` · `roles/logging.logWriter` · `roles/datastore.user`) 을 개인 Gmail 이 Compute default SA 에 부여. Cloud Billing API · Cloud Firestore API 활성화.
11. **Firestore DB 프로비저닝** — `gcloud firestore databases create --location=asia-northeast3`. Rules 배포.
12. **admin2 를 super_admin 으로 승격** — `packages/functions/scripts/promote-user.mjs` (`a1ad8dc` 에 신설). Custom claim + Firestore users 문서 role 갱신. 로그아웃/재로그인 후 `/super_admin` 접근 확인.

### 벗겨낸 함정 (참고용 정리)

- **pnpm workspace + Firebase Functions**: Cloud Build 안의 npm 이 `workspace:*` 프로토콜 못 읽음. `scripts/deploy-functions.sh` 로 shared 를 tarball 로 팩 + `file:` 참조로 임시 재작성 후 배포, 종료 시 원복.
- **새 GCP 프로젝트 default SA 최소 권한**: Compute default SA 에 각 Google API 사용 IAM 역할 명시 부여 필요. 예전 Editor 자동 부여 안 됨.
- **Firestore DB 별도 프로비저닝**: API 활성화만으로 안 됨. `gcloud firestore databases create`.
- **Cloud Functions v2 서비스명 소문자**: `getMe` → Cloud Run 서비스명 `getme`. gcloud 명령 시 소문자 사용.
- **Callable v2 CORS**: 기본 CORS 꺼져 있음. `cors: true` 명시 필요 (커밋 `b243438`). BUT — 도메인 제한 조직 정책이 `allUsers` 부여 차단하는 프로젝트에서는 CORS 만으로 부족.
- **Domain-restricted sharing 정책**: `cam.hs.kr` 조직이 `iam.allowedPolicyMemberDomains` 로 Cloud Run 에 `allUsers` invoker 부여 차단. Firebase Hosting rewrite (`/api/*`) 로 우회 시도 — `firebase.json` + 클라이언트 URL 3 파일 변경 (커밋 `b8741f7`). 우회 자체는 동작 (HTTP 403 → HTTP 401 로 에러 변화). 하지만 Firebase Hosting 서비스 계정 (`service-{PROJECT_NUMBER}@gcp-sa-firebasehosting.iam.gserviceaccount.com`) 이 아직 프로비저닝 안 됨 → 다음 세션에서 `gcloud services identity create --service=firebasehosting.googleapis.com` 로 강제 생성 후 `roles/run.invoker` 부여 필요.

### CI 여정 (5 커밋 layer)

CI 는 저장소 개시 이래 30+ 회 전부 실패 상태였음. 오늘 하나씩 벗김:
- `b009998` — 옛 캐시 스텝 패턴 → setup-node 내장 cache
- `8187d23` — setup-node cache 옵션 제거 · pnpm 버전 명시 시도
- `4aa6071` — pnpm 11 이 Node 22.13+ 필요 확인 → pnpm 10 지정
- `58dc929` / `a148492` — pnpm 10.15.0 태그 존재 안 함 → 10.34.5 + packageManager 정합
- `4735d1e` — jsdom 30 → undici 8 이 Node 21+ 필요 → CI Node 20 → 22

**최종 초록** (`4735d1e`) — Setup pnpm · Node 22 · Install · Java 21 · Build · Lint · Unit tests · Emulator integration tests 모두 통과.

### 팀 구조 진화 · 채널 리듬

**사용자 결정** (Buzz DM `e010a9946f6b`): **A+B** — 채널 활동 강화 + Designer 역할 신설.

- **`AGENTS.md` 갱신** (커밋 `46c1f59`): §2 세 자리 → 네 자리 (Head · Antigravity · Codex · Designer) · §8 신설 Designer 상설 규약 · §9 신설 채널 게시 리듬 (「슬라이스 병합 + 감사 결과 요약」만).
- **첫 채널 요약** — `#school_app` 채널 (`c11dde04-...`) event `36a9f1a664`. E2E 마일스톤 + 배운 4 함정.
- **Designer 페르소나** — 지금은 헤드가 UI 슬라이스에서 씀. 별도 에이전트로 분리는 나중.

### UI 재구성 v0.1 슬라이스 (진행 중)

- **사용자 결정** (Buzz DM `71af39591f19`): UI 정돈 방향 = 「레이아웃 재구성」. 참고 URL `https://masstige.io/index.html` (미니멀 모노크롬 · 볼드 산세리프 · 넉넉한 여백 · 「→」 어포던스).
- **UI_SYSTEM v1.0 봉인** (커밋 `cbf5228` → `cf8b2c0` 헤더 정리) — 컬러·타이포·간격·컴포넌트·상태·반응형·접근성·다크모드 값 전부 정의. 사용자 승인 반영 (Buzz DM `d44e17f244bf`: 그대로/아이콘 없음/Pretendard 확정).
- **NEXT.md 오더** (커밋 `cf8b2c0`) — `feat/ui-shell-v1` 브랜치, 5~7 커밋 분리. Shell + Sidebar + Topbar + login 재구성 + AppShell 래핑 + 다크 모드.
- **Antigravity 킥오프** — `#school_app` 채널 mention `5fb50b9df986`. 진행 중.

### 다음 세션에 이어갈 것

1. **Firebase Hosting 서비스 계정 프로비저닝** — `gcloud services identity create --service=firebasehosting.googleapis.com --project=school-app-5a636` → 그 다음 `gcloud run services add-iam-policy-binding` 5 개 함수에 `roles/run.invoker` 부여 (소문자 서비스명 사용).
2. **Antigravity UI 슬라이스 결과 리뷰** — 코드 · 스크린샷 · 감사 파견 · 병합 · 채널 요약.
3. **그룹·챗방·클래스룸 관리 기능** — 원본 `계정관리.gs` + `클래스룸관리.gs` 의 나머지 매핑.

### 오늘 핵심 커밋 (14 개)

`bebdf16` · `24a1ec9` · `1ac3699` · `67d5ce7` · `a1ad8dc` · `b243438` · `46c1f59` · `cbf5228` · `cf8b2c0` · `b009998` · `8187d23` · `4aa6071` · `58dc929` · `a148492` · `4735d1e` · `b8741f7`.

**감사 미완**: 오늘의 슬라이스는 Antigravity 결과 오면 Codex 감사 파견. UI 재구성 슬라이스는 별도 감사.

## 2026-09-08 · 채널 이전 + v0.89~v0.94 이력 갱신

### 채널 이전

- `#school_app` 대화 이력이 길어져 `#school_app_02` (`cfef52ba-5b47-4a4a-a70e-d604f73fe89c`) 로 이전.
- 인계 문서: `/Users/bliss00/.buzz/PLANS/SCHOOL_APP_CHANNEL_HANDOFF.md`.
- 채널 오프너 (event `34cb3d2abb86bf0e3ba9a6baa0dbe82255177734b9802acfb03d5d9c80a59cec`) 기준 HEAD: `31ea9f7` (v0.93).

### v0.89 ~ v0.93 병합 (2026-09-01 ~ 2026-09-07)

| 버전 | 병합 커밋 | 요약 |
|---|---|---|
| v0.89 | `53450c2` | classroom.list · year 엄격 검증 · batch invalidate 우회 |
| v0.90 | `ff6b5c0` | classroom.create callable + UI |
| v0.91 | `77c9dc7` | classroom batch create dialog |
| v0.92 | `2612324` | chat members CRUD (add · delete · list · Directory 리졸버) |
| v0.93 | `31ea9f7` | chat bulk invite dialog (basic_data → 학급 일괄 초대) |

v0.93 로컬 검증 수치: shared 27 + functions 356 + web 551 = 934 unit · emulator 43건.

### v0.89 ~ v0.93 Codex 감사 재요청 · 완료

- v0.93 뒤 감사가 사용자 한도 오류 (`86bee2d04f6f`) 로 완료 못 됨. 인계 파일에 「닫혀야 할 감사 누락」 로 명시됨.
- 새 채널 개시 후 Codex 에 고정 HEAD `31ea9f7`, 범위 `53450c2..31ea9f7` 로 재요청.
- 결과 (Codex 이벤트 `e2f5616856b1ef15…3c4e0c17ae65`, 파일 `/Users/bliss00/.buzz/RESEARCH/SCHOOL_APP_V089_V093_CODEX_AUDIT.md`): 실패 5건 확인.
  - **F1** `packages/functions/src/callable/classroom/studentsAdd.ts` — teacher 대상 코스 membership 사전 검증 없음.
  - **F2** `studentsDelete.ts` — 동일 문제.
  - **F3** `classroom/create.ts:106` — teacher `ownerId` 강제 없음.
  - **F4** `packages/web/src/routes/admin/CourseBulkCreateDialog.tsx:163` — `courses.create` `ALREADY_EXISTS` 는 alias 지정 시에만 발생 → 재실행이 skip 이 아니라 중복 코스 생성.
  - **F5** 같은 파일 `:135` — 선택 key `${grade}-${c}` `split('-')` 로 복원 → `A-1` 같은 반 이름이 `A` 로 잘림.
- Head 재검증: 5건 모두 실제 코드에서 재현 확인 (channel event `d4ea00aaeaa27a31…9dea`).

### v0.94 병합 (authz hotfix)

- 브랜치: `feat/authz-hotfix-v94`.
- 커밋:
  - `d59425d` — F1/F2 `packages/functions/src/authz/classroomTeacherMembership.ts` 신설 · `studentsAdd` · `studentsDelete` 에 teacher membership 사전 검증 삽입 · `classroomClient.courses.teachers.get` 인터페이스 추가 · unit 시나리오 6건 신설.
  - `fa4a1b1` — F3 `classroom/create.ts` teacher · ownerId != 'me' 거부 · unit 시나리오 4건 신설.
- 병합 커밋: `5a0f4df` (main).
- 로컬 관문: TypeScript build · ESLint · shared 27 + functions 366 + web 551 = **944 unit** (신규 시나리오 10건).
- Codex 감사 (`0f19ec862663812e3c4ddee70ce2b29bd32ea12cf01cc76ac86f402458db6744`): 통과 7 / 실패 0 / 판정불가 1 (emulator, Java 부재).

### v0.95 준비 (bulk create UX hotfix, F4/F5)

- 오더 문서 초안: `/Users/bliss00/.buzz/OUTBOX/SCHOOL_APP_V095_NEXT_DRAFT.md`.
- v0.94 병합 뒤 `docs/handoff/NEXT.md` 로 이동. Antigravity 위임 예정.
- 핵심 결정:
  - **F4**: `classroomCreate` callable 에 optional `id` (Google Classroom domain-scoped alias, `d:` prefix 필수) 추가. 클라이언트 bulk 는 `d:{year}-{grade}-{cls}` 를 alias 로 보내 Google 의 `ALREADY_EXISTS` 를 확정 skip 신호로 사용.
  - **F5**: 선택 상태를 `Set<string>` → `Map<string, {grade, cls}>` 로 재구성. 문자열 split 제거.

### 이 세션 함정 · 배운 것

- **에이전트가 「릴레이 게시 차단」 을 사유로 채널 게시 유보** — Codex 가 감사 결과를 워크스페이스 파일로만 기록하고 채널에는 승인 요청만 보냈다 (`e2f5616856b1ef15…3c4e0c17ae65`). Head 는 감사 파일 존재를 확인하고 요약을 Head 스레드로 전달, 사용자 승인 (`16ae1d90ce69`) 뒤 Codex 는 자유롭게 게시. 이 패턴은 앞으로 「감사물 파일이 있으면 요약 전달로 진행, 채널 게시 승인 별건 처리」 로 다룬다.

## 2026-09-08 · v0.95 / v0.96 bulk create hotfix (4 라운드 감사 · 병합)

### 진행 요약

Antigravity 가 v0.95 (F4/F5) 를 완료 후, Codex 가 3 라운드에 걸쳐 6 건 실패를 지적 (F6~F11). 각 라운드에서 Head 가 hotfix 를 자기 손으로 넣고 재감사. 4 라운드 째 통과. 병합 커밋 `e3dd87d`. 채널 이벤트: v0.94 병합 announce `ab63272352fc95…`, v0.96 병합 announce (예정).

### v0.95 (Antigravity) → v0.96 (Head 4 라운드)

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.95 | `95ef964` | 6/2/2 | F6 alias unicode / F7 NEXT.md NUL byte |
| v0.96 | `18b2ed5` | 6/2/2 | F8 legacy 미대조 / F9 grade coerce (`1e21`) |
| v0.96b | `bcf7992` | 6/2/2 | F10 list 실패 fail-open / F11 raw U+0001 key |
| v0.96c | `af6b693` | **7/0/2** 통과 | 없음 |

### 커밋 이력 (feat/alias-hash-v96)

- `c33b51a` F4 — classroomCreate optional `id?: string` (`d:` prefix 강제, `[A-Za-z0-9._@:\-]{1,100}` 검증).
- `95ef964` F5 — CourseBulkCreateDialog selection Set → Map. keyOf/naturalCompare 신설.
- `2ba4487` F6 — alias 를 raw cls 대신 `hashSlug(cls)` = FNV-1a 64-bit → 16자 hex 로 인코딩.
- `18b2ed5` F7 — `docs/handoff/NEXT.md` raw NUL byte 2건 → `\0` escape 표기.
- `bcf7992` F8 + F9 — `callClassroomList` 사전 조회 legacy `(name, section)` skip · aliasFor 를 전체 tuple hash `d:${hashSlug(\`${year}:${grade}:${cls}\`)}` 로 재구성.
- `af6b693` F10 + F11 — list 실패 fail-closed (전체 항목 `failed/legacy_list_failed`) · legacyKeys 원소 `JSON.stringify([name, section])`.

### 배운 것

- **Antigravity 오더가 「Google 은 alias 시 ALREADY_EXISTS」에만 의존하면 legacy 코스 대응이 빠진다** — 이번 F8 은 v0.91 이전 alias 없이 만든 코스가 남아 있을 때 재실행이 중복을 만드는 문제. 서버 alias-set 검사만으로는 부족하므로 client 층 사전 대조 필요.
- **`${1e21}` → `1e+21` coerce** — Number type 을 template literal 로 원문 삽입하면 exponent 표기가 나올 수 있다. alias 같은 안전 문자 제약이 있는 곳에서는 template 대신 hash payload 로 인코딩하는 편이 튼튼.
- **raw control byte 오염** — Edit tool 로 문자열 concatenation 을 작성했는데 어딘가에서 raw `\x01` 이 삽입돼 파일이 data 로 분류됐다. 원인 재현 어려움. 방어책: 문자열 concat 을 지양하고 `JSON.stringify([...])` 같은 explicit encoder 사용. `file` 명령어로 tracked source 가 text 인지 검증하는 게이트가 앞으로 필요.
- **다중 라운드 감사 대비 오더 상세도**: 이번 오더는 F4/F5 만 지시했는데, 실제로는 legacy 처리·grade coerce·control char 등 파생 실패가 나왔다. UX 슬라이스에서는 「엣지 반 이름 (한국어·특수문자)」 를 오더에 시나리오로 명시하는 게 좋다.

### v0.96 병합 · 배포

- 병합 커밋: `e3dd87d` (main).
- 배포 명령: `firebase deploy --only hosting,functions --project school-app-5a636` (bliss00 자동 승인 범위).
- STATUS.md · project_notes.md · NEXT.md 갱신 (이 커밋).

### 다음 세션에 이어갈 것

다음 제품 방향은 아직 미확정. STATUS 후보 (a) Classroom 코스와 Chat 스페이스 학급 통합 생성/배정, (b) admin console v2 (역할 관리 UI + capability matrix). bliss00 지시 대기.

## 2026-09-09 · v0.97 chat bulk create (Head 직접 + F12 hotfix · 병합)

### 진행 요약

사용자 확정 방향 (a) 「Classroom×Chat 학급 통합」 의 첫 절반. `basicData` 로 학급 단위 Chat 스페이스 일괄 생성 dialog. Antigravity 오더를 v0.97 로 커밋 (`6b98cbe`) 했으나 미응답 → 사용자 지시 「계속 이어서 작업」 에 따라 Head 가 직접 구현. Codex 첫 감사에서 F12 발견, hotfix 후 통과.

### 커밋 이력 (feat/chat-bulk-create-v97)

| 커밋 | 요약 |
|---|---|
| `7c50ccd` | feat(web): ChatBulkCreateDialog — Phase · Map selection · courseName/keyOf/isAlreadyExistsError 재사용 · 사전 callChatList · JSON.stringify legacy key · fail-closed on list 실패 · 시나리오 4건 |
| `a42f964` | feat(web): ChatSpacesTable 「학급 일괄 생성」 버튼 통합 |
| `5c7456b` | fix(chat,web): F12 displayName 128자 검증 (client + server) · 시나리오 3건 |

### v0.97 (Head) → v0.97b (Head, 1 라운드 hotfix)

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.97 | `a42f964` | 7/1/2 | F12 displayName 128자 미검증 |
| v0.97b | `5c7456b` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `f0cf35b` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 372 + web 565 = 964 unit.

### 배운 것

- **Codex 지적 「sole duplicate defense」 정정**: 첫 회 comment 에 「Chat 은 alias idempotency 없어서 사전 대조가 유일한 duplicate 방어」 로 썼지만 실제 `spaces.create` 는 조직 내 동일 displayName 에 ALREADY_EXISTS 를 반환. 사전 대조는 UX + API 절감 목적이지 유일한 방어는 아니다. → 사전에 API 문서 읽는 태도가 코드 comment 정확도로 이어진다.
- **길이 제약은 upstream 을 믿지 말고 명시 검증**: Google Chat displayName 128자 제한을 upstream 에 맡기면 좋은 사용자 경험이 안 나옴. 클라이언트 preview 층 + 서버 층 양쪽에 명시 검증하는 편이 견고.
- **Antigravity 미응답 대응**: 오더 커밋 후 20+ 분 무반응이면 Head 가 직접 구현. NEXT.md 오더 문서 자체는 유지 (다음 이 유사 슬라이스 반복 시 참고).

## 2026-09-09 · v0.98 classroom+chat pair 통합 (Head 직접 + F13 hotfix · 병합)

### 진행 요약

사용자 확정 방향 (a) 「Classroom×Chat 학급 통합」 의 두 번째 절반. 학급 선택 하나로 course + space 동시 생성. Antigravity 미응답 지속 → Head 직접 구현. Codex 첫 감사에서 F13 발견, hotfix 후 통과. (a) 완료.

### 커밋 이력 (feat/classroom-chat-pair-v98)

| 커밋 | 요약 |
|---|---|
| `e7f5222` | feat(web): ClassroomChatPairBulkCreateDialog — Phase 4 · Map selection · Promise.all([callClassroomList, callChatList]) · course 실패 시 chat=not_attempted · pair 결과 render · 시나리오 6건 |
| `acf35d0` | feat(web): ClassroomTable 「학급 통합 생성」 버튼 통합 |
| `c201c4e` | fix(web): F13 pair 사전 128자 검증 — course 도 만들지 않음 (orphan 방지) |

### v0.98 (Head) → v0.98b (Head, 1 라운드 hotfix)

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.98 | `acf35d0` | 7/1/2 | F13 128자 초과에도 course 생성 (orphan 발생) |
| v0.98b | `c201c4e` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `142fa23` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 372 + web 571 = 970 unit.

### 배운 것

- **통합 다이얼로그의 원자성 트레이드오프**: pair 는 성격상 「양쪽 다 원한다」 이므로 한 쪽이 확정 실패면 다른 쪽도 건드리지 않는 편이 낫다. best-effort 로 course 만 만들면 orphan course 가 남아 다음 실행이 legacy skip 으로 계속 밟히는 부작용. 「pair precheck」 개념 명시.
- **Codex 는 시나리오 기대값도 오답 지표로 본다**: 첫 시나리오 5 는 「course=ok, chat=failed」 를 정답으로 가정했는데 이 자체가 결함의 반영. Codex 는 「이 기대값이 완료를 고정」 이라고 지적. 시나리오는 최종 정답 기대값에 맞춰 재작성.
- **재사용 유틸의 축적 효과**: `aliasFor`, `keyOf`, `courseName`, `isAlreadyExistsError` 등 v0.91~v0.97 축적 유틸이 v0.98 코드를 짧게 유지. 잔뜩 export 해둔 게 이 시점에 값어치를 냈다.

### 다음 세션에 이어갈 것

방향 (a) 완결. STATUS 후보:
- (b) admin console v2 (역할 관리 UI + capability matrix).
- (c) 실 Workspace 확인 workflow — v0.94~v0.98 판정불가 (실 Google alias 충돌, 실 Chat 동일 이름 충돌, membership 반영 시차 등) 를 소거하는 실 리소스 테스트 스크립트 · 문서화.
- (d) 그 외 사용자 지시.

## 2026-09-09 · v0.99 admin console v2 첫 슬라이스 (capability matrix)

### 진행 요약

사용자 확정 방향 (b) admin console v2 의 첫 조각. 역할·capability 매트릭스 시각화 페이지 (`/super_admin/capabilities`). 서버 진실의 원본 `shared/roleCapabilities.ts` 를 UI 로 파생 렌더 (읽기 전용). Head 직접 구현. Codex 첫 감사에서 F14 (하단 안내 문구 부정확) 발견, 문구만 정정 후 통과.

### 커밋 이력 (feat/capability-matrix-v99)

| 커밋 | 요약 |
|---|---|
| `0934442` | feat(web): CapabilityMatrixPage — table 렌더 · shared 상수 순회 · 셀 O/·  · role 총합 · Vitest 시나리오 6건 |
| `bbb5146` | feat(web): SuperAdminPage 시스템 설정 → 역할·권한 매트릭스 링크 (App.tsx 라우트 등록 포함) |
| `c4b1ae0` | fix(web): F14 하단 문구 정정 (promote-user.mjs · Auth claim + Firestore role · 재로그인) |

### v0.99 (Head) → v0.99b (Head, 1 라운드 문구)

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.99 | `bbb5146` | 7/1/2 | F14 하단 문구 「Firestore custom claim」 부정확 |
| v0.99b | `c4b1ae0` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `1a5b0e0` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 372 + web 577 = 976 unit.

### 배운 것

- **UI 안내 문구도 감사 대상**: 코드가 정확해도 사용자 안내가 실제 운영 도구와 어긋나면 병합 차단 사유. Codex 는 「존재하지 않는 변경 수단」 을 정확히 지적. UI 문구 작성 시 도구/스크립트를 grep 하고 실제 동작을 확인하는 습관 필요.
- **파생 뷰 vs 진실의 원본**: 이 슬라이스는 shared 상수를 렌더만 하는 좋은 예. UI 에서 별도 매핑을 유지하지 않고 shared 를 직접 순회 → 서버·UI 정합 자동 보장. 라벨 (사용자 친화) 만 별도 맵으로 분리해 리터럴 안정성 + UI 유연성 확보.

### 다음 세션에 이어갈 것

방향 (b) 첫 슬라이스 완결. 다음 후보:
- (b2) admin console v2 다음 단계 — 실제 역할 변경 UI (super_admin 이 사용자의 role 을 웹에서 promote/demote). 서버 변경 필요 (`system.manage_roles` capability 를 실제 callable 에 매핑).
- (c) 실 Workspace 확인 workflow.
- (d) 그 외 사용자 지시.

## 2026-09-10 · v0.100 role management UI (b2 · 3 라운드 감사 · 병합)

### 진행 요약

사용자 확정 방향 (b2) admin console v2 다음 단계. super_admin 이 UI 에서 사용자 role 을 promote/demote 하는 서버 + 클라이언트 통합 슬라이스. 안전 핵심 (auth 경계 변경) 이라 Head 직접 구현. Codex 3 라운드 감사 (총 8 항목 지적) 후 통과.

### 커밋 이력 (feat/users-update-role-v100)

| 커밋 | 요약 |
|---|---|
| `b851321` | feat(functions): usersUpdateRole callable — system.manage_roles cap · Firebase Auth setCustomUserClaims + Firestore users doc · 본인 강등 방지 · 시나리오 11건 |
| `8dff3ae` | feat(web): usersUpdateRole API + useUsersUpdateRole hook · 시나리오 5건 |
| `8b4adcd` | feat(web): EditUserRoleDialog radio 다이얼로그 + AccountsTable 「역할」 진입점 (super_admin 전용) |
| `ecc9fea` | fix: F15 claim 보존 · F16 Firestore 실패 시 Auth rollback (partial failure escalate) · F17 usersGetRole callable + useUserRole hook · F18 Firestore email 병기 |
| `97975de` | fix: F19 getRole 은 Auth 원본 반환 · null 포함 모든 split 감사 · F20 dialog fail-closed on error · F21 update 성공 시 role query cache 즉시 갱신 |

### v0.100 (Head) → v0.100b → v0.100c (Head, 2 라운드 hotfix)

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.100 | `8b4adcd` | 7/4/2 | F15 claim overwrite · F16 rollback 부재 · F17 currentRole null · F18 email 누락 |
| v0.100b | `ecc9fea` | 7/3/2 | F19 Firestore 우선 오분류 · F20 dialog error 미차단 · F21 role cache 미갱신 |
| v0.100c | `97975de` | **8/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `2324255` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 393 + web 586 = 1006 unit.

### 배운 것

- **`setCustomUserClaims` 는 전체 덮어쓰기다** — 새 role 만 넣으면 다른 claim 이 사라진다. 항상 spread 후 갱신 (F15).
- **두 저장소 원자성 없이 갱신하면 실패 시 정합 깨진다** — Auth + Firestore 를 각각 쓰면 두 저장소가 갈라진다. Auth 를 먼저 쓰고, Firestore 실패 시 Auth 롤백. 롤백 실패는 internal escalate (F16). 이 패턴은 다른 이중 저장소 흐름에도 재사용 가능.
- **UI 안전 컷은 loading + error 둘 다** — 조회 오류 시 loading 만 방어하면 오강등 경로가 남는다. fail-closed 는 loading + error 둘 다 (F20).
- **Mutation 성공 시 관련 query cache 는 명시적으로 갱신** — invalidate 만으로는 stale 재사용을 완전 방지 못한다. `setQueryData` 로 즉시 값 갱신 + invalidate 조합이 안전 (F21).
- **읽기 원본은 authz 의 진실을 반영해야** — Firestore 는 display cache. Auth 가 authz 원본. getRole 이 Firestore 값을 반환하면 실제 권한과 다른 값을 사용자에게 보여줄 수 있다. Auth 반환 + split 감사 (F19).
- **Codex 는 3 라운드까지 파고든다** — 안전 핵심 슬라이스에서는 첫 감사 후에도 파생 결함이 나올 수 있다. F15/F16 이 해결되니 F19/F20/F21 이 남았다. 「fail closed」·「원자성」·「캐시 정합」 같은 시스템 속성 각각을 개별 시나리오로 검증하는 습관 필요.

### 다음 세션에 이어갈 것

방향 (b) admin console v2 두 슬라이스 완결. 다음 후보:
- (b3) 감사 로그 검색·필터 개선 · role_split 감사 이벤트 전용 view 등.
- (c) 실 Workspace 확인 workflow — v0.94~v0.100 판정불가 (실 Auth claim 전파, Auth→Firestore rollback, alias 충돌, 128자 실 API 응답 등) 를 소거하는 실 리소스 검증.
- (d) 사용자 지시 그 외.

## 2026-09-10 · v0.101 audit log filterAction (b3 · 2 라운드 감사 · 병합)

### 진행 요약

v0.100 usersUpdateRole 도입으로 role_split 이 새 감사 이벤트로 나타나면서, 감사 로그 필터에서 액션 단위 탐색 필요성이 커졌다. shared 카탈로그 + 서버 정확 매치 필터 + 웹 드롭다운을 추가. Codex 감사에서 Firestore 복합 인덱스 누락 (F22) 발견, 인덱스 파일에 추가하여 통과.

### 커밋 이력 (feat/audit-action-filter-v101)

| 커밋 | 요약 |
|---|---|
| `dc2841b` | feat: AUDIT_ACTIONS shared 카탈로그 · readAudit + list callable filterAction · web hook/dep 배열 · AuditLogTable 드롭다운 · q 검색 message 확장 · 시나리오 6건 |
| `cc551e6` | fix(firestore): F22 `audit_log(action ASCENDING, at DESCENDING)` 복합 인덱스 추가 |

### v0.101 → v0.101b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.101 | `dc2841b` | 7/1/2 | F22 Firestore 복합 인덱스 누락 |
| v0.101b | `cc551e6` | **4/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `bb5a8f5` (main).
- 배포: `firebase deploy --only hosting,functions,firestore:indexes --project school-app-5a636` (인덱스 포함).
- 로컬 관문: shared 27 + functions 397 + web 588 = 1012 unit.

### 배운 것

- **Firestore 복합 쿼리는 항상 인덱스가 필요** — `where(field, '==', v) + orderBy('at', desc)` 조합은 각 필드별로 복합 인덱스가 미리 있어야 실 런타임에서 동작. 로컬 mock 테스트는 인덱스를 검사하지 않으므로 회귀가 안 잡힌다. 서버 filter 추가 시 `firestore.indexes.json` 갱신을 병렬로 진행하는 습관 필요.
- **shared 상수는 UI 재료지 서버 제약이 아니다** — 서버가 임의 액션 문자열을 저장할 수 있어야 미래 신규 액션이 인프라 확장 없이 감사 로그로 들어온다. 카탈로그는 UI 드롭다운 편의 목적에만 사용.
- **부분 문자열 검색은 서버 정확 매치의 보완재** — Firestore 는 substring/contains 를 지원하지 않으므로 서버측 필터는 정확 매치만. UI 층 substring 은 이미 로드된 페이지 내에서 message/action 두 필드 매치. 두 기능은 겹치지 않고 상호보완.

### 다음 세션에 이어갈 것

방향 (b3) 완결. 다음 후보:
- (c) 실 Workspace 확인 workflow (v0.94~v0.100 판정불가 소거).
- (b4) 감사 로그 다중 액션·행위자 필터 · 액션 카탈로그 자동 동기화 (스크립트가 소스에서 추출).
- (d) 사용자 지시 그 외.

## 2026-09-10 · v0.102 Say Briefly 디자인 첫 슬라이스 (3 라운드 감사 · 병합)

### 진행 요약

사용자 요청 (channel event `b1119960a301da63…`) — 첨부 이미지 UI 구조 참고 + Say Briefly moodboard 디자인 적용. 큰 방향 전환이라 단계별로 나눠 진행. 첫 슬라이스 v0.102 는 디자인 토큰 재매핑, Google Fonts 로드, shell 시각적 재구성에 국한. Codex 3 라운드 감사에서 UI_SYSTEM 문서·WCAG AA·모바일 폰트 스케일·다크 hover·overflow 지적 순차 해결.

### 커밋 이력 (feat/saybriefly-v102)

| 커밋 | 요약 |
|---|---|
| `594b9cd` | feat(web): Say Briefly 팔레트/폰트/radii 토큰 재매핑 · Google Fonts (Bricolage 800 · Inter · Roboto Mono) · tailwind-merge 확장 · Sidebar logo 뱃지 · Topbar 시각 리프레시 |
| `207f005` | fix(web,docs): F23~F27 — UI_SYSTEM v2.0 재봉인 · fg-muted/state-danger/warning AA 상향 · Topbar dark hover 저대비 회피 · overflow 방어 (min-h/truncate/min-w-0/flex-1) · Sidebar logo Bricolage → Inter |
| `e9b0c53` | fix(web,docs): F28/F29 — Topbar 모바일 Inter 700/28px + md+ Bricolage 800/40px · dark fg-muted #737373 → #9ca3af AA |

### v0.102 → v0.102b → v0.102c

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.102 | `594b9cd` | 6/5/2 | F23 UI_SYSTEM 옛 봉인 · F24 fg-muted AA · F25 state AA · F26 dark hover · F27 Topbar overflow |
| v0.102b | `207f005` | 7/2/2 | F28 모바일 Bricolage 28px 규칙 위반 · F29 dark fg-muted AA |
| v0.102c | `e9b0c53` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `2b12361` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 397 + web 590 = 1014 unit.

### 배운 것

- **디자인 시스템 전환은 문서 재봉인부터** — 옛 UI_SYSTEM 이 실 코드와 반대로 남아 있으면 다음 슬라이스 (Antigravity·Designer 오더) 가 잘못된 원본을 참조한다. 팔레트 바꾼 커밋과 UI_SYSTEM 재작성 커밋을 같은 슬라이스에 함께 넣어야 「도구 = 원본」 정합 유지.
- **AA 대비 계산은 개별 색뿐 아니라 실제 사용 조합 (텍스트 위 배경) 마다 검증해야** — Say Briefly 원시 팔레트의 Pencil Gray/Terracotta 는 border/장식 용이라 「대비 낮음」 이 의도적. 하지만 이 값을 무비판적으로 semantic 텍스트 토큰에 매핑하면 AA 위반. semantic 매핑 시 배경 대비 계산이 필수.
- **font-family 규칙 (Bricolage 40px+) 은 반응형에서도 보존해야** — `text-subheading` (28px) 에 `font-display` 를 적용하면 「40px 이상」 규칙 위반. 모바일/데스크톱 브레이크포인트 별로 폰트 family 도 함께 전환.
- **다크 hover 는 라이트 hover 를 그대로 못 재사용** — 라이트의 highlighter-yellow 배경은 forest-ink 텍스트에 최적. 다크의 흰 텍스트는 노란 배경에서 저대비. `dark:hover:*` 로 분기 명시.
- **overflow 방어는 responsive 폰트만으론 부족** — 헤더에 40px 헤딩 + 컨트롤을 한 줄 배치하면 긴 email 페이지 제목이 컨트롤을 밀어낸다. flex-1 + min-w-0 + truncate + shrink-0 조합 필수.

### 다음 세션에 이어갈 것

v0.102 (토큰+shell) 완결. 다음 후보:
- **(e1)** 버튼/카드 radius 6/12px 전면 적용 — 기존 `rounded-none` 을 순차 대체.
- **(e2)** Super Admin dashboard hero (Bricolage headline + highlight-yellow wash + pastel accent 카드).
- **(e3)** 참고 이미지의 좌측 사이드바 확장 — 아이콘 · 시간 표시 · bottom docs/live chat/sign out.
- **(e4)** 개별 컴포넌트 (KPI 카드, 표, 다이얼로그) Say Briefly 명세 세부.

## 2026-09-10 · v0.103 Say Briefly revert + 아이콘 + 가독성 (3 라운드 감사 · 병합)

### 진행 요약

사용자 지시 (channel event `bddf1bf29de591a5…`) — v0.102 Say Briefly 실험이 마음에 안 들어 되돌리기 + 사이드바 아이콘 + 가독성. Codex 3 라운드 감사에서 UI_SYSTEM 정합, 아이콘/overflow 회귀 시나리오, SVG stroke-width 대조 assert 지적 순차 해결.

### 커밋 이력 (feat/revert-saybriefly-v103)

| 커밋 | 요약 |
|---|---|
| `435dbe8` | Revert v0.102 Say Briefly merge (전체 되돌리기) |
| `1699c7a` | feat: lucide-react 아이콘 (Sidebar 각 항목 · Topbar 로그아웃) · body 15→16px · small 13→14px · fg-muted #A3A3A3→#6B7280 (AA 4.83:1) · state 색 상향 · Sidebar 활성 항목 semibold |
| `59c6822` | fix: UI_SYSTEM v1.1 재봉인 (색 표·타입·Topbar·아이콘 정책 실제 구현과 정합) · Topbar overflow + Sidebar 아이콘 SVG aria-hidden 회귀 시나리오 4건 |
| `c0d3b7b` | fix: active/inactive SVG stroke-width 대조 assert (활성 2.25, 비활성 2) |

### v0.103 → v0.103b → v0.103c

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.103 | `1699c7a` | 7/3/2 | F30 UI_SYSTEM 색·타입 표 옛 값 · F31 Topbar/무아이콘 문구 옛 값 · F32 아이콘/overflow 회귀 부재 |
| v0.103b | `59c6822` | 8/1/2 | F33 stroke-width 대조 assert 부재 |
| v0.103c | `c0d3b7b` | **5/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `eca8056` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 397 + web 592 = 1016 unit.

### 배운 것

- **디자인 방향 변경 때 문서 재봉인이 필수** — v0.102 Say Briefly 봉인을 폐기하고 v1.1 masstige.io+아이콘 을 재봉인. UI_SYSTEM 색·타입 표를 실제 CSS/Tailwind 값에 맞추지 않으면 Codex 는 「문서와 코드 반대」 로 판정 (F30). 디자인 커밋 = 문서 커밋 함께 진행 원칙.
- **회귀 시나리오는 「존재」 뿐만 아니라 「대조」 도 검사** — F33: 「두꺼운 stroke」 라고 명시했지만 값 대조가 없으면 회귀 방어 부족. active vs inactive 대조 assert 로 명확히.
- **revert 는 필요한 개선까지 되돌린다** — Topbar overflow 방어 (min-w-0/truncate) 는 디자인 색과 무관한 순수 개선. revert 후 재적용. 개선 계층은 별도 커밋으로 분리해두면 revert 부담이 줄어든다 (교훈: 안정 계층과 디자인 계층 분리).

### 다음 세션에 이어갈 것

디자인 안정화. v0.104 후보:
- (b4) 감사 로그 다중 액션·행위자 필터.
- (c) 실 Workspace 확인 workflow.
- (d) 사용자 지시 그 외.

---

## 2026-09-10 · v0.105 SuperAdminPage role_split 감시 카드 (3 라운드 감사 · 병합)

### 진행 요약

v0.100 에서 도입한 `role_split` 감사 이벤트(Auth claim ≠ Firestore role) 를 super_admin 대시보드에서 「최근 조회 sample 안에서」 즉시 감지하는 카드. `useAuditLogList` 로 `users.read/error` 50건을 받고 client 에서 `message.startsWith('role_split')` 필터. Codex 3 라운드에서 「전수 대조」 오해 소거, 표본 명칭 정확도, JSX 안 markdown 오노출 순차 해결.

### 커밋 이력 (feat/role-split-card-v105)

| 커밋 | 요약 |
|---|---|
| `bae1d38` | feat(web): SuperAdminPage role_split 감시 카드 (AlertTriangle · 3건 미리보기 · action/result/q 전체 보기 링크) |
| `8ded7bb` | fix(web): F34/F35 「동기 상태」 단정 제거 · sample size (50) 노출 · hasMore pagination 안내 |
| `704c5c6` | fix(web): F36/F37 표본 명칭 「usersGetRole 호출」→「users.read/error 감사 이벤트」 · JSX `**…**` markdown → `<strong>` element 교체 |

### v0.105 → v0.105b → v0.105c

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.105 | `bae1d38` | 7/2/2 | F34 「두 저장소 동기 상태」 단정 (sample 범위 오해) · F35 hasMore pagination 무시 |
| v0.105b | `8ded7bb` | 6/2/2 | F36 표본 명칭 오도 (usersGetRole vs users.read/error) · F37 JSX 안 raw `**` markdown 노출 |
| v0.105c | `704c5c6` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `ef6fb16` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636` — 함수 무변경 (skipped) · hosting 만 재배포.
- 로컬 관문: shared 27 + functions 397 + web 596 = 1020 unit.

### 배운 것

- **client 표본 범위를 UI 에 노출** — Firestore 는 substring 필터 없어서 `role_split` prefix 는 client 에서 걸러야 함. sample size · hasMore 안내 없이 「감지 없음」 을 표시하면 사용자는 「전수 대조 통과」 로 오해. 카드 문구에 「최근 N건 sample 안에서만」 · 「조회된 적 없는 계정 제외」 를 명시적으로 박아 오해 소거 (F34/F35).
- **필터 조건 = 표본 명칭** — 서버 필터가 `users.read + error` 라면 실제 sample 은 `usersGetRole` 뿐 아니라 `usersList` error 등 모든 users.read/error 이벤트 포함. 「usersGetRole 호출 이벤트」 라는 좁은 명칭은 표본 출처를 왜곡. 필터 조건과 명칭을 일치시켜야 (F36).
- **JSX 문자열 안 markdown 은 렌더되지 않는다** — `<>...**bold**...</>` 는 raw asterisk 로 화면 노출. React 는 markdown 파서가 아님. 강조는 `<strong className="font-semibold">` 로 실제 element 사용해야 함. 로컬 테스트도 raw `**` 부재 assert 추가로 회귀 고정 (F37).
- **커밋 메시지 안 `**` 는 zsh 확장 가능성** — heredoc + printf 로 `**` 넣으면 shell 이 파일 glob 시도. `git commit -F <파일>` 로 우회.

### 다음 세션에 이어갈 것

v0.106 후보:
- v0.104 (audit multi-action filter) Codex 감사 응답 대기 (5시간+ 지연) · 재요청 검토.
- (c) 실 Workspace 확인 workflow (v0.94~ 판정불가 소거).
- server-side `role_split` 전용 action 필드 도입 (client filter 불필요).

---

## 2026-09-10 · v0.106 server-side role_split_detected action (2 라운드 감사 · 병합)

### 진행 요약

v0.105 client filter 를 server-side 전용 action `system.role_split_detected` 로 이전. shared catalog 에 등록, getRole callable 이 split 감지 시 새 action 으로 기록. super_admin 카드는 `filterAction` 하나로 정확 count → empty state 가 확정 상태 (「없음 = 정말 없음」). caveat 은 sample-scope → trigger-scope (「역할 편집 대화상자를 열어본 계정에서만」) 로 단일화.

### 커밋 이력 (feat/role-split-action-v106)

| 커밋 | 요약 |
|---|---|
| `d33bfc0` | feat(shared,functions,web): system.role_split_detected action 도입 · getRole action 이전 · super_admin 카드 server 필터 · client filter 제거 · caveat trigger-scope 로 재작성 |
| `35e1c01` | fix(web): F38 hasMore 안내를 `!loading && !error && hasMore` 로 가드 · loading/error 회귀 시나리오 2건 |

### v0.106 → v0.106b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.106 | `d33bfc0` | 7/1/2 | F38 useAuditLogList 초기·오류 cursor undefined → hasMore=true 로 떨어져 pagination 안내가 loading/error 중에도 렌더됨 |
| v0.106b | `35e1c01` | **5/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `9db5dd0` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636` — hosting + functions 전체 재배포 (functions build hash 변경으로 all update).
- 로컬 관문: shared 27 + functions 397 + web 598 = 1022 unit.

### 배운 것

- **useAuditLogList 초기 hasMore=true 는 「데이터 있음」 이 아니라 「cursor 없음」 의 결과** — 실제 pagination 이 가능한지는 loading·error 완료 이후에만 판단 가능. hook 반환값을 UI 문구에 그대로 매핑하면 존재하지 않는 pagination 을 안내하게 됨. 가드 조합 `!loading && !error && flag` 는 async list hook 을 UI 에서 쓸 때의 기본 pattern (F38).
- **회귀 시나리오는 「긍정」 뿐 아니라 「음성」 도 강제 필요** — 「hasMore=true → 안내 표시」 만 있으면 loading 중 hasMore=true 시나리오가 무커버리지. Codex 는 hook 내부까지 읽고 「초기 cursor undefined → hasMore=true」 를 잡아냈음. 상태별 (loading/error/success) × flag (true/false) 조합을 명시적으로 회귀에 걸어야 함.
- **client filter → server filter 이전 시 empty state 의미가 바뀐다** — v0.105 empty = 「최근 50건 안에 없음」, v0.106 empty = 「전체 없음」. UI 문구 · caveat · 링크 URL 을 함께 갱신하지 않으면 사용자에게 옛 오해를 이어가게 됨. shared 카탈로그 · server callable · client hook · UI 문구 · 회귀 test 5 계층을 하나로 묶어 커밋해야 함.
- **과거 events 는 마이그레이션 대신 audit 페이지 q 검색 위임 가능** — v0.105 이전에 기록된 `users.read + error + role_split:` events 는 새 action 이 아니라 여전히 users.read 지만, 감사 페이지에서 q=role_split substring 필터로 조회 가능. 신규 events 만 새 action 으로 두고 마이그레이션 안 함 (backfill 스크립트 부담 vs 옛 데이터 소량). 카드 링크는 「전체 보기」 를 신규 action exact filter 로 두어 최신 데이터 정확성 우선.

### 다음 세션에 이어갈 것

v0.107 후보:
- v0.104 (audit multi-action filter) Codex 감사 응답 대기 (6시간+ 지연) · 재요청 검토.
- (c) 실 Workspace 확인 workflow (v0.94~ 판정불가 소거).
- role_split 자동 복구 (Auth ↔ Firestore 동기화) callable.
- 감사 로그 CSV/JSON export.

---

## 2026-09-10 · v0.104 audit multi-action filter (2 라운드 감사 · 병합)

### 진행 요약

v0.101 단일 액션 필터 (server `==`) 를 다중 액션 필터 (Firestore `in`, 최대 30) 로 확장. 서버 필터 + client checkbox multi-select popover (URL `?action=a,b,c`). Codex 6시간+ 응답 지연 후 F39 (정규화 배열 계약 불일치) · F40 (WAI-ARIA listbox → checkbox pattern) 지적 해결.

### 커밋 이력 (feat/audit-multi-action-v104)

| 커밋 | 요약 |
|---|---|
| `470d854` | feat(functions,web): v0.104 audit log 다중 액션 필터 (readAudit filterActions 배열 · list.ts input 정제 · AuditLogTable multi-checkbox popover · URL 콤마 구분 · 10 시나리오) |
| `5898142` | fix(functions,web): v0.104b F39/F40 대응 (dedup+30 fail-closed callable 경계 이동 · readAudit slice 제거 · listbox→group role + aria-multiselectable 제거 · 4 회귀) |

### v0.104 → v0.104b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.104 | `470d854` | 7/2/2 | F39 readAudit 이 조용히 slice(0,30) 잘라서 callable audit log 는 원본 전체 적용된 것처럼 남음 · F40 role=listbox 안에 checkbox 자식이라 semantics 불일치 |
| v0.104b | `5898142` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `5b721c5` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636` — hosting + functions 전체 재배포.
- 로컬 관문: shared 27 + functions 407 + web 596 = 1030 unit.

### 배운 것

- **정규화는 경계에서 한 번, 신뢰는 아래에서** — v0.104 처음엔 readAudit 이 방어적으로 dedup + slice 하는 사이 callable 은 원본 배열을 감사 log 에 남기고 있었음. 두 곳에서 각각 정규화 = 「무엇이 실제 적용됐는가」 를 감사가 잘못 기술. Fix: callable 이 유일한 정규화 지점, readAudit 은 상위 계약 신뢰. 이렇게 하면 callable 이 만드는 정규화 배열이 query·audit·success message 모두에 동일하게 흘러 「기록 = 실행」 이 성립.
- **defense-in-depth 이 감사 무결성을 깰 수 있다** — 방어적 slice 는 「어쨌든 초과분은 잘라서 계속 진행」 이라는 실패 은닉. 감사 log 는 「31개 적용」 이라고 기록되지만 실제 30 개만. Codex 는 이 불일치를 잡음. 지금 방식: fail-closed (거부 + 감사 log 에 명시적 error 기록) → 초과 요청을 조용히 숨기지 않고 caller 에게 실체를 알림.
- **WAI-ARIA 는 role 과 자식 구조가 짝** — `role=listbox` 는 자식이 `role=option` 이어야. checkbox 를 listbox 안에 넣으면 스크린리더가 「option」 을 기대해서 keyboard/selection semantics 어긋남. checkbox 묶음은 `role=group` (aria-multiselectable 은 listbox 전용 · group 에 붙이면 무효). 공식 참고: WAI-ARIA APG Checkbox Pattern.
- **Codex 응답 지연 시 병렬 슬라이스가 통함** — v0.104 감사 6시간+ 지연 동안 v0.105/v0.106 별 브랜치로 병합·배포 완료. 재요청 (수동 pinging) 은 감사 응답이 오지 않을 때 마지막 수단. 이번엔 재요청 후 8분 만에 응답.

### 다음 세션에 이어갈 것

v0.107 슬라이스 진행 중:
- role_split 자동 복구 callable (usersResolveRoleSplit) — Firestore = Auth 동기화.
- 신규 action `system.role_split_resolved`.
- super_admin 카드 복구 버튼.
- 서버 완료, client UI 진행 중.

---

## 2026-09-10 · v0.107 role_split 자동 복구 + 상태 재확인 (7 라운드 감사 · 병합)

### 진행 요약

super_admin 이 감지된 role_split 을 클릭 한 번으로 Firestore = Auth 로 동기화. Auth 는 authz 소스이므로 방향 하나만 지원 (반대 방향은 EditUserRoleDialog + usersUpdateRole 이 이미 원자적으로 처리). 서버 aggregation callable 로 두 audit source (`system.role_split_resolved` + `users.update_role`) 를 통합, 전용 recheck callable 로 unknown row 재확인 흐름 분리. Codex 감사 7 라운드에서 CAS · pagination · race handling · post-write recovery · domain enforcement 을 순차적으로 강화.

### 커밋 이력 (feat/role-split-resolve-v107)

| 커밋 | 요약 |
|---|---|
| `0a3f3d3` | feat: usersResolveRoleSplit callable · 카드 복구 버튼 · CAS 기대치 (uid + expectedAuthRole + expectedFirestoreRole) |
| `5522eec` | fix: F41 detected append-only 소거 (resolved feed 병합) · F42 Firestore transaction CAS · rebase onto main (v0.104) |
| `54a87c8` | fix: F43 자동 흡수 · F44 auditLogUnresolvedRoleSplits aggregation callable (server-side reconcile) · F45 post-write Auth 재검증 |
| `ca2487d` | fix: F46 users.update_role 도 sync 신호로 인정 · F47 post-write 3-way 분기 (정상/우연수렴/새split) |
| `4a1202e` | fix: F48 post-write getUser 실패 복구 (detected auth=unknown 기록) · F49 client error 경로 invalidate · F50 convergence 응답 실제 최종값 |
| `3558d03` | fix: F51 usersRecheckRoleSplit read-only callable · unknown row 는 「상태 재확인」 버튼으로 분기 |
| `5922e4e` | fix: F52 recheckRoleSplit ALLOWED_DOMAIN 강제 |

### v0.107 → v0.107g

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.107 | `0a3f3d3` | 7/2/2 | F41 detected append-only · F42 read-write race |
| v0.107b | `5522eec` | 6/3/2 | F43 resolved 결과 미필터 · F44 pagination 불완결 · F45 post-write race |
| v0.107c | `54a87c8` | 7/2/2 | F46 updateRole sync 미인정 · F47 post-write error 정체 |
| v0.107d | `ca2487d` | 7/3/2 | F48 post-write getUser 실패 · F49 error 경로 미invalidate · F50 convergence 응답 stale |
| v0.107e | `4a1202e` | 7/1/2 | F51 auth=unknown row 파싱 실패 고착 |
| v0.107f | `3558d03` | 8/1/2 | F52 recheck ALLOWED_DOMAIN 누락 |
| v0.107g | `5922e4e` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `f7e5bb4` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636` — hosting + functions 전체 재배포.
- 로컬 관문: shared 27 + functions 445 + web 615 = 1087 unit.

### 배운 것

- **Auth ↔ Firestore atomicity 는 진정 불가능 · CAS + 재검증만 가능** — Firebase Auth 는 Firestore transaction 밖. 한 개의 원자적 write 를 만들 수 없으므로 pre-CAS (읽어서 기대치 대조) + post-CAS (쓴 후 재확인 + 필요 시 보상) 조합 이 실제 가능한 최대 보증. 그리고 이 조합 안에서도 post-write 재조회 자체가 실패하면 상태를 알 수 없으므로 「auth=unknown」 을 명시적으로 기록해서 상위 로직 (aggregation + client UI) 이 인식 가능한 상태로 두어야 함.
- **감사 이벤트는 상태 전이의 진실** — audit log 를 「기록만 남기는」 것으로 보지 말고, aggregation query 의 진실 소스로 사용. append-only 특성 때문에 detected 이벤트가 그대로 남으면 「미해결」 로 보이므로, resolved 이벤트를 target 별 최신 시각으로 병합해서 「detected.at > resolved.at」 만 unresolved 로 필터. 여기서 resolved 신호는 여러 action 이 될 수 있음 (`system.role_split_resolved` + `users.update_role` result=ok). action 하나로 좁히면 다른 경로로 sync 된 경우 놓침 (F46).
- **client-server contract 는 message 포맷도 포함** — client parser 가 auth=X 를 role 4개 (`super_admin/admin/teacher/null`) 만 허용하는 상태에서 server 가 `auth=unknown` 을 기록하면 parsing 실패로 UI 가 고착 (F51). 서버가 새 marker 를 도입할 때 client 도 그 marker 를 어떻게 처리할지 결정 필요. F51 은 unknown row 를 별도 recheck 흐름으로 분기해서 UI 가 「상태 재확인」 버튼 제공.
- **7 라운드 감사 = 각 라운드마다 새 concurrency 문제 노출** — 처음엔 simple resolver 였다가 CAS 도입 → race window 인식 → post-write 재검증 → 재검증 실패 처리 → unknown 상태 관리 → 도메인 강제 순으로 발견. 각 fix 가 새 attack surface 를 만들었음. 이 정도 깊이의 감사는 설계 단계에서 미리 파악하기 어렵고, Codex 라운드 구조 자체가 depth-first 발견에 강함.
- **read-only mutation 은 confirm 없이** — resolve 는 Firestore 를 쓰므로 window.confirm 유지. recheck 는 오직 audit log 만 남기므로 confirm 불필요. UI affordance 는 mutation 의 실제 영향과 맞춰야 함.
- **rebase 는 --force-with-lease 로만** — v0.107 은 v0.104 병합 이전 main 위에서 시작. v0.104 병합 후 rebase 하고 `git push --force-with-lease origin <branch>`. force push 는 feature branch 만, main 은 절대 안 됨 (AGENTS.md 규약).

### 다음 세션에 이어갈 것

v0.108 후보:
- (c) 실 Workspace 확인 workflow — v0.94~v0.101 판정불가 소거.
- role_split 감시 카드에 자동 재확인 (배포 후 첫 로드 시 auth=unknown row 자동 recheck).
- 감사 로그 CSV export 개선 (JSON export 추가 · 필터 요약 포함 파일명).
- (d) 사용자 지시 그 외.
