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

---

## 2026-09-10 · v0.108 감사 로그 JSON export + 파일명 필터 요약 (2 라운드 감사 · 병합)

### 진행 요약

기존 CSV export 옆에 JSON export 추가. JSON payload 는 `exportedAt` · `filter` metadata · `partial`/`hasMore` · `count` · `entries` (rich 필드 + before/after) 구조. 파일명은 filesystem-safe 필터 요약 접미어 포함해서 여러 export 를 구분. Codex 2 라운드에서 pagination · 타입 계약 · 정규화 metadata 를 강화.

### 커밋 이력 (feat/audit-json-export-v108)

| 커밋 | 요약 |
|---|---|
| `26339aa` | feat(web): JSON export + downloadBlob 공통 헬퍼 + filterSummaryForFilename + CSV 파일명 적용 |
| `9b1c15c` | fix(web): F53 partial/hasMore · F54 before/after 보존 · F55 정규화된 hook 인자 metadata |

### v0.108 → v0.108b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.108 | `26339aa` | 6/3/2 | F53 hasMore 누락 · F54 before/after 누락 · F55 metadata URL 원문 |
| v0.108b | `9b1c15c` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `a70689e` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636` — hosting 재배포.
- 로컬 관문: shared 27 + functions 445 + web 621 = 1093 unit.

### 배운 것

- **export payload 는 「어떤 조건으로 뽑았는가」 를 스스로 문서화해야** — filter metadata 를 부실하게 넣으면 export 파일이 나중에 정체 불명이 됨. 특히 hasMore 같은 pagination 상태를 안 넣으면 partial export 가 complete 처럼 보임 (F53). export 는 self-describing 원칙.
- **타입 계약과 export 매핑 gap** — `AuditLogEntryRead` 타입에 before/after 가 있는데 export 매핑에서 빼면 「타입이 약속한 필드가 파일에서 사라짐」. 타입 vs 매핑 gap 은 정적 검사로 잡히지 않으므로 review 나 codex 감사가 필요.
- **URL 원문 vs 서버 정규화** — search params 원문을 그대로 metadata 에 넣으면 서버가 실제 처리한 조건과 다를 수 있음. actionList (dedup 완료), atMinMs (유효 검증 통과) 같은 정규화된 hook 인자에서 만드는 게 진실 (F55).
- **작은 슬라이스도 감사 라운드 필요** — v0.107 은 7 라운드였지만 v0.108 은 UI-only 이고도 2 라운드. 모든 export payload 는 self-describing 하고 정확해야 한다는 원칙이 있어서 「단순한 JSON dump」 로 취급하면 여러 지적 발생. Codex 는 payload 설계도 spec 으로 취급함.

### 다음 세션에 이어갈 것

v0.109 후보:
- (c) 실 Workspace 확인 workflow — 판정불가 소거.
- role_split 자동 재확인 (카드 mount 시 unknown row 자동 recheck).
- 감사 로그 배치 export (전체 페이지 순회 후 통합 JSON/CSV).
- (d) 사용자 지시 그 외.

---

## 2026-09-10 · v0.109 role_split unknown row 자동 재확인 (4 라운드 감사 · 병합)

### 진행 요약

v0.107f 에서 auth=unknown row 는 「상태 재확인」 수동 버튼으로 분기했음. v0.109 는 카드 mount 시 unknown row 를 자동으로 recheck 트리거해서 super_admin 이 발견하고 클릭하는 단계 제거. Codex 4 라운드에서 concurrency · TanStack Query semantics · mount 총량 상한 을 순차적으로 강화.

### 커밋 이력 (feat/role-split-auto-recheck-v109)

| 커밋 | 요약 |
|---|---|
| `13e41fa` | feat: mount 시 auth=unknown row auto recheck. session-scoped Set 으로 중복 방지 |
| `629a53c` | fix: F56 batch limit 5 + hook automatic invalidate 제거 + caller invalidate. pending 카운터 방식 (초기) |
| `767dee2` | fix: F57 mutateAsync + Promise.allSettled (TanStack consecutive mutate callback 오류 회피) |
| `2afa2f6` | fix: F58 autoRecheckBudget useRef<number> mount-scoped 총량 상한 |

### v0.109 → v0.109d

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.109 | `13e41fa` | 6/1/2 | F56 concurrency 없이 N mutate + N invalidate 증폭 |
| v0.109b | `629a53c` | 6/1/2 | F57 consecutive `mutate` per-call callback 마지막 것만 실행 |
| v0.109c | `767dee2` | 6/1/2 | F58 batch limit 은 per-batch, invalidate 후 다음 5개 추가 발화 |
| v0.109d | `2afa2f6` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `ef5fef8` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636` — hosting 재배포.
- 로컬 관문: shared 27 + functions 445 + web 631 = 1103 unit.

### 배운 것

- **TanStack Query 의 consecutive `mutate` 는 per-call callback 을 덮어씀** — 같은 mutation observer 에 연속 `mutate({}, {onSuccess, onError})` 호출 시 마지막 호출의 callbacks 만 실행됨 (공식 문서). pending 카운터 로 batch settle 을 감지하려면 `mutateAsync` + `Promise.allSettled` 를 사용해야 함. `mutate` 는 fire-and-forget 성격.
- **useRef 는 mount-scoped state 의 도구** — Set 은 동일 UID 중복 방지에는 좋지만 「총량 상한」 은 별도 카운터가 필요. useRef<number> budget 으로 초기값 5, 매 발화마다 차감. mount 동안 누적 유지, unmount 시 리셋 (자연스러운 「재로드 = 새 시도」 계약).
- **자동화의 리스크는 증폭** — 「N unknown 자동 처리」 는 N 개 Functions 호출 + N 개 invalidate → N 개 refetch → N 개 useEffect 재실행 → ... 폭주 가능. 상한 (budget) + 단일 invalidate 조합으로만 안전.
- **Codex 는 hook 라이브러리 semantics 도 감사 대상** — Codex 가 TanStack Query 공식 문서 링크를 근거로 F57 을 지적. hook 반환값 (mutate vs mutateAsync) 의 사용 맥락을 정확히 이해해야 pass. 단순히 「테스트가 통과했다」 로는 충분 안 함.

### 다음 세션에 이어갈 것

v0.110 후보:
- (c) 실 Workspace 확인 workflow — 판정불가 소거.
- 감사 로그 배치 export (전체 페이지 순회 후 통합 JSON/CSV).
- 감사 로그 필터 preset 저장 (자주 쓰는 필터 조합).
- (d) 사용자 지시 그 외.

---

## 2026-09-10 · v0.110 미해결 role_split KPI 카드 (3 라운드 감사 · 병합)

### 진행 요약

SuperAdminPage KPI 로우에 5번째 카드 「미해결 role_split」 추가. server aggregation callable 반환값을 count 로 표시, 클릭 시 role_split section anchor scroll. Codex 3 라운드에서 scanIncomplete 방향성 (`+`/`?`) · 반응형 grid 를 순차 강화.

### 커밋 이력

| 커밋 | 요약 |
|---|---|
| `53f2c60` | feat: KPI 5번째 카드 + role-split-section id + smooth scroll |
| `39c8434` | fix: F59 scanIncomplete → `N+` · F60 grid md:2 lg:3 xl:5 |
| `4af9a35` | fix: F61 resolvedHasMore → `N?` (방향 불확실), detectedHasMore → `N+` (하한) 분리 |

### v0.110 → v0.110c

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.110 | `53f2c60` | 6/2/2 | F59 scanIncomplete 은닉 · F60 md 폭 부족 |
| v0.110b | `39c8434` | 6/1/2 | F61 resolvedHasMore 시 `N+` 는 하한 의미가 거짓 |
| v0.110c | `4af9a35` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `7b7a9bd` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 445 + web 638 = 1110 unit.

### 배운 것

- **partial 집계의 방향 (over vs under) 을 UI 에 명확히** — `hasMore` 는 단순히 「완전 아님」 이 아니라 방향 (과대 vs 과소) 정보를 담아야 함. detected 미완성 = 미해결이 더 있을 수 있음 (N+ 하한). resolved 미완성 = 현재 N 이 실제 해결된 것을 놓쳤을 수 있음 (N? 방향 불확실). 두 신호를 같은 접미어로 표시하면 사용자를 오도.
- **반응형 grid 는 실제 container 폭에서 검증해야** — Tailwind `md:` breakpoint (768px) 는 window 폭 기준이지만 실제 카드는 sidebar + padding 뺀 main container 폭에서 놓임. `xl:` (1280px) 는 5열 감당하지만 그 이하는 3열/2열 로 fallback 해야. Codex 는 sidebar 폭 + padding 을 계산 근거로 제시.
- **hook return 계약을 그대로 UI 로 매핑하면 실수** — server aggregation callable 이 두 hasMore 플래그를 각각 반환하는데 이를 하나의 `scanIncomplete = a || b` 로 합치면 방향 정보 유실. 두 플래그를 각각 UI 문구로 매핑해야 진실 보존.

### 다음 세션에 이어갈 것

v0.111 후보:
- (c) 실 Workspace 확인 workflow — 판정불가 소거.
- 감사 로그 배치 export.
- 필터 preset 저장.
- (d) 사용자 지시 그 외.

---

## 2026-09-10 · v0.111 audit page role_split quick filter (3 라운드 감사 · 병합)

### 진행 요약

AuditLogTable 상단 프리셋 로우 옆에 「role_split」 액션 preset button. click → URL 을 `?action=system.role_split_detected,system.role_split_resolved` 로 설정 (v0.104 multi-action 재사용). 3 라운드에서 empty-state 필터 판정 · aria-pressed · trim 일치 순차 강화.

### 커밋 이력

| 커밋 | 요약 |
|---|---|
| `0411b1a` | feat: role_split preset button + toggle |
| `0260a4a` | fix: F62 empty-state 필터 판정 · F63 aria-pressed |
| `63c7772` | fix: F64 empty-state trim 로직 일치 |

### v0.111 → v0.111c

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.111 | `0411b1a` | 6/2/2 | F62 empty-state 필터 판정 부재 · F63 aria-pressed 없음 |
| v0.111b | `0260a4a` | 6/1/2 | F64 공백-only q 판정 mismatch |
| v0.111c | `63c7772` | **5/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `7ef2057` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 445 + web 648 = 1120 unit.

### 배운 것

- **empty-state 판정은 실제 필터 로직과 대칭** — filteredEntries 가 `.trim()` 후 판정하면 empty-state 도 `.trim().length > 0` 사용해야 UI 문구가 일관. raw truthy 검사와 실제 필터 검사가 다르면 사용자 오도 (F64).
- **aria-pressed 로 toggle button 상태 노출** — CSS class 는 시각 사용자 전용. `aria-pressed` 는 screen reader 사용자를 위한 상태 표현. 계산된 활성값을 class 와 aria-pressed 가 공유해야 두 채널 일관 (F63).
- **printf `%` 이스케이프 주의** — `%20%20` 같은 URL-encoded 문자열은 printf 에서 format directive 로 오해. `%%20%%20` 로 이스케이프 or 다른 이스케이프 방식.

### 다음 세션에 이어갈 것

v0.112 후보:
- (c) 실 Workspace 확인 workflow.
- 감사 로그 배치 export.
- 필터 preset 저장.
- (d) 사용자 지시 그 외.

---

## 2026-09-11 · v0.112 audit page 「필터 초기화」 버튼 (1 라운드 통과 · 병합)

### 진행 요약

AuditLogTable toolbar 에 「필터 초기화」 버튼. 활성 필터가 하나라도 있으면 활성. 개별 필터 각각 지우기 대신 한 번에 모든 URL query param 원자적 제거. 공백-only q 는 v0.111c 결정 대칭 (실제 필터 미적용이므로 초기화 대상 아님). Codex **첫 라운드에 6/0/2 통과** — 명세와 구현이 이미 대칭적으로 정합했기 때문.

### 커밋 이력

| 커밋 | 요약 |
|---|---|
| `6b53021` | feat: 「필터 초기화」 button + 4 회귀 |

### 병합 · 배포

- 병합 커밋: `0fd1848` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 445 + web 652 = 1124 unit.

### 배운 것

- **기존 결정과 대칭적으로 설계하면 감사 라운드 단축** — v0.112 disabled 조건이 v0.111c empty-state 필터 판정 (trim 규칙 포함) 과 완전히 동일한 구조. 새 코드에 새 규칙 도입 안 하고 기존 검증된 규칙 재사용 → Codex 가 「이미 정합」 으로 통과. 슬라이스 간 일관성을 유지하면 감사 부담 낮아짐.

### 다음 세션에 이어갈 것

v0.113 후보:
- (c) 실 Workspace 확인 workflow.
- 감사 로그 배치 export.
- 필터 preset 저장.
- (d) 사용자 지시 그 외.

---

## 2026-09-11 · v0.113 BulkResetPasswordDialog + ROADMAP.md (3 라운드 감사 · 병합)

### 진행 요약

사용자 지시 「로드맵 정리 + 다음 개발」. `docs/handoff/ROADMAP.md` 신규 (v0.93~v0.112 4 phase 완료 · Phase 5~8 후보 분류). Phase 5 첫 슬라이스로 원본 Apps Script 「비밀번호 일괄 변경」 (`updateUserPasswords`) 포팅. BulkSuspendDialog 패턴 재사용.

### 커밋 이력

| 커밋 | 요약 |
|---|---|
| `f064c77` | feat: BulkResetPasswordDialog + ROADMAP.md · 6 회귀 |
| `6070948` | fix: F65 sensitive state clear · F66 label htmlFor · F67 ROADMAP 정정 (BasicData UI 이미 있음) |
| `b546c76` | fix: F68 「취소」 버튼 handleOpenChange 경로 |

### v0.113 → v0.113c

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.113 | `f064c77` | 7/3/2 | F65 평문 잔존 · F66 label 없음 · F67 ROADMAP 오기재 |
| v0.113b | `6070948` | 6/1/2 | F68 취소 버튼이 handleOpenChange 우회 |
| v0.113c | `b546c76` | **5/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `5cfca49` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 445 + web 661 = 1133 unit.

### 배운 것

- **평문 비밀번호는 close 경로 마다 clear** — dialog 는 unmount 되지 않고 open toggle 만 되는 경우가 많음. state 는 mount 동안 유지되므로 사용자가 「취소」 로 닫아도 memory 잔존. 모든 close entry (button click · Radix outside click · Esc) 가 `handleOpenChange` 통과하도록 → 중앙 `clearSensitiveState` 실행. 실행 시작 시에도 local 변수로 실행값 고정 후 state clear 하면 done phase 에서도 잔존 없음.
- **취소 버튼은 `handleOpenChange` 경로 필수** — 부모 prop `onOpenChange` 직접 호출은 handleOpenChange 의 running/done 처리와 clearSensitiveState 을 우회. dialog 내부 close entry 는 반드시 handleOpenChange 통해야.
- **label htmlFor + id 는 접근성 기본** — form input 은 label 로 접근 가능해야 screen reader 가 필드 구분. `getByLabelText` 로 테스트 가능. UI_SYSTEM 규약에 명시 안 돼도 semantic HTML 관례.
- **ROADMAP 은 실제 코드 기준 검증** — 문서 작성 시 「미구현」 이라고 적기 전에 실제 구현 여부 확인. Codex 는 문서와 코드 불일치도 감사 대상 (F67).

### 다음 세션에 이어갈 것

v0.114 후보 (ROADMAP Phase 5 남은 항목 or Phase 6):
- 클래스룸 소유자 이관 / archived 관리.
- 전입생 계정 UX 개선.
- 감사 로그 배치 export.
- 필터 preset 저장.

---

## 2026-09-11 · v0.114 audit filter preset 저장 (2 라운드 감사 · 병합)

### 진행 요약

Phase 6 (통합·자동화) 첫 슬라이스. super_admin 이 자주 쓰는 필터 조합을 이름 붙여 localStorage 에 저장 → 다음 방문 시 chip 클릭 한 번으로 복원. Codex 1 라운드에서 write 실패 · read 정규화 · UI/유틸 일관성을 지적, hotfix 로 통과.

### 커밋 이력

| 커밋 | 요약 |
|---|---|
| `672d28e` | feat: filterPresets 유틸 (localStorage) + AuditLogTable 저장/불러오기/삭제 UI + 16 회귀 |
| `2029425` | fix: F69 write status 반환 · F70 read 정규화 (trim·dedup·상한) · F71 이름 정규화 UI/유틸 공유 |

### v0.114 → v0.114b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.114 | `672d28e` | 6/3/2 | F69 write 실패 삼킴 · F70 read 정규화 부재 · F71 UI/유틸 일치 안 함 |
| v0.114b | `2029425` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `30e5c25` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 445 + web 687 = 1159 unit.

### 배운 것

- **localStorage write 는 실패 status 를 명시적으로 반환** — quota/private-mode/security 오류를 조용히 삼키면 UI 는 저장된 것처럼 보이나 새로고침 시 사라짐. `SavePresetResult { status, presets }` 로 명시. UI 는 status 별 분기 · storage_error 시 state 갱신 skip → persisted 상태와 UI 일치 유지.
- **read 경로에도 정규화 적용** — 구버전 데이터 · 손상 파일 · 다른 브라우저 탭에서 잘못 쓴 값이 있어도 UI 불변식 (dedup, name 길이, 상한) 을 유지해야. 「write 시점에만 정규화」 로는 부족. read/write 양쪽에서 같은 규칙 적용.
- **UI 사전 판정과 유틸 판정은 같은 함수 공유** — `normalizePresetName` 을 export 해서 UI 도 유틸 규칙 재사용. 「UI 는 trim, 유틸은 60자 컷」 같은 미묘한 불일치가 20 개 상태에서 61자 입력 시 stale error 유발.

### 다음 세션에 이어갈 것

v0.115 후보:
- 클래스룸 소유자 이관 (Phase 5 남음).
- 클래스룸 archived 관리 (Phase 5).
- 감사 로그 배치 export (Phase 6).
- classroom 상세 페이지 (Phase 6).

---

## 2026-09-11 · v0.115 클래스룸 archived bulk 관리 + F72/F73 hotfix

**슬라이스** — 원본 Apps Script `archiveClassrooms` 포팅. ClassroomTable 에 다중 선택 (`selectedIds: Set<string>`, eligible = ACTIVE|ARCHIVED) + bulk actions bar (선택 아카이브 / 선택 복구, 방향별 disabled, 선택 개수 라벨). `BulkArchiveClassroomDialog` 는 BulkSuspend 3-phase 재사용 (confirm/running/done): 대상 개수 숫자 입력 확인 · 순차 for-loop + 개별 실패 수집 · progress bar · running 중 close 차단 · done 후 `onDone` 콜백으로 selection reset. server 는 기존 `classroomPatch` callable 재사용 (신규 audit action 없음).

### 커밋

| 커밋 | 요약 |
|---|---|
| `7f72985` | feat(web): ClassroomTable 다중 선택 + BulkArchiveClassroomDialog + 7 회귀 |
| `f2725fc` | fix: F72 patch teacher membership 사전 검증 + F73 confirm 시점 courses·direction snapshot 고정 |

### v0.115 → v0.115b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.115 | `7f72985` | 6/2/2 | F72 teacher 담당 외 코스 아카이브 가능 · F73 dialog courses 재계산으로 done 화면 성공 수 0 뒤집힘 |
| v0.115b | `f2725fc` | **7/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `2da65ca` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 448 + web 695 = 1170 unit.

### 배운 것

- **teacher 캡 = 담당 코스 경계** — teacher role 이 `classroom.archive` cap 을 갖더라도, Google Workspace 관리자이면서 app-role 만 teacher 로 매핑된 계정은 담당 외 코스도 patch 요청이 통과된다. Google API 가 permission-denied 를 안 돌려주므로 앱 층에서 반드시 `courses.teachers.get(courseId, me)` 로 사전 검증. 이미 `assertTeacherInCourseIfTeacherRole` helper 가 있으니 이런 write 경로마다 재사용. **admin/super_admin 은 우회** (helper 내부 early return) — 광범위 관리 경로 보존.
- **bulk workflow 는 confirm 시점에 대상을 snapshot 으로 고정** — dialog 가 render 마다 부모 prop 을 그대로 반영하면, 완료 후 list invalidation 이 대상 filter 를 바꿀 때 done 화면의 총량·성공 수가 뒤집힌다. `snapshot: { courses, direction }` state 에 확정 시점 값을 잠그고, running/done phase 는 snapshot 을 원본으로 삼는다. confirm phase 는 부모 prop 을 그대로 반영해서 선택 변경 즉시 반영.
- **회귀 테스트 형태** — 「부모가 courses=[] 로 rerender 해도 done 화면의 성공 수·patch 호출 수 유지」 처럼 데이터 라이프사이클 회귀는 `rerender` 로 부모 prop 을 바꿔서 재현. 단순히 dialog 를 다시 열어 확인하는 테스트로는 잡을 수 없음.

### 다음 세션에 이어갈 것

v0.116 후보 (ROADMAP Phase 5/6 남음):
- 클래스룸 소유자 이관 (Phase 5 남음, `transferClassroomOwnership` Apps Script 포팅).
- classroom 상세 페이지 (Phase 6).
- 감사 로그 배치 export (Phase 6).

---

## 2026-09-11 · v0.116 클래스룸 소유자 이관 (4 라운드 Codex 감사)

**슬라이스** — 원본 Apps Script `transferClassroomOwnershipAndUpdateSheet` 포팅. `classroom.transfer_owner` cap (super_admin/admin 전용) 으로 gate 된 신규 callable. `teachers.get(courseId, newOwnerEmail)` → 404 시 `teachers.create` 로 자동 추가 후 `patch({ownerId, updateMask:"ownerId"})`. Dialog 는 이메일 입력 + rollback 상태별 UI 안내 (ok/failed/skipped).

### 커밋

| 커밋 | 요약 |
|---|---|
| `52e91e9` | feat: transferOwnership callable + Dialog + ClassroomTable row gate + 9+7 회귀 |
| `ba3268d` | fix: F74 ALLOWED_DOMAIN 서버 강제 + F75 add-then-patch 4xx 보상 삭제 (rollback=ok/failed/skipped) |
| `07f1094` | fix: F76 patch try 좁히기 (성공 audit 실패 오분류 방지) + F77 partial HttpsError.details wire (UI rollback 별 안내) |
| `311efd6` | fix: F78 writeAuditWithBackup helper (3x retry + Cloud Logging fallback) + F79 partial HttpsError 를 audit 앞에 구성 (details 유실 방지) |

### v0.116 → v0.116d Codex 4 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.116 | `52e91e9` | 6/2/2 | F72 teacher 담당 외 (v0.115 잔재 아님, 새 경로) · F73 은 v0.115 fix — 여기선 F74/F75 |
| v0.116b | `ba3268d` | 7/2/2 | F76 patch 성공 audit 오분류 · F77 client details 도달 불가 |
| v0.116c | `07f1094` | 7/2/2 | F78 durable audit · F79 partial details 유실 |
| v0.116d | `311efd6` | 7/1/2 | F78 durable audit sink 인프라 (배포 리소스 부재) |

**F78 잔재** — Codex 4라운드는 Cloud Logging 기본 `_Default` 버킷 보존 30 일 + BigQuery/GCS sink 별도 구성 필요 + fallback→audit_log 복구 경로 미구현을 지적. bliss00 결정 (2026-09-11): **A 옵션 (지금 병합 + audit sink 는 별도 슬라이스)**. 이유: Cloud Logging fallback 은 practical 30일 durability 제공, 사람이 눈치채고 복구 가능. 완전 durable audit_log 는 사용자 조치 (BigQuery sink 배포 · 조직 정책) 요구되므로 별도 인프라 슬라이스로 분리.

### 병합 · 배포

- 병합 커밋: `70fac11` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 465 + web 708 = 1200 unit.

### 배운 것

- **teacher.create fallback + patch 는 partial fail 처리를 별도 설계 필요** — Google Classroom API 는 새 owner 가 course teacher 여야 patch 허용. 원본 flow 를 그대로 재현하면 「teacher.create 성공 → patch 실패」 시 orphan teacher 남음. 4xx 는 보상 삭제, 5xx/timeout 은 skip. rollback 상태를 감사 message + HttpsError.details 로 양쪽에 실어야 UI 가 사용자에게 「교사 남아 있음」 을 안내 가능.
- **patch 성공 후 audit 실패는 성공을 뒤집으면 안 됨** — Google 상태는 이미 바뀐 상태에서 UI 를 실패 처리하면 재시도 → double transfer. audit 는 accountability side-effect 이며 patch 결과와 독립. narrow try/catch 로 patch 만 감싸고, audit 은 best-effort (retry + Cloud Logging fallback).
- **HttpsError.details 는 Firebase callable protocol 로 wire 전달** — fetch 계층에서 body.error.details 를 Error.details 에 재부착하면 client mutation 이 그대로 소비 가능. 별도 audit union type 확장 없이 rollback 상태를 UI 로 전달.
- **partial HttpsError 를 audit 호출 앞에 미리 구성** — audit 실패가 던져진 error 를 덮지 않도록 순서 중요. audit 은 non-throwing helper 로 처리.
- **인프라와 앱 경계** — Codex 감사가 요구하는 「durable audit sink」 는 앱 코드가 아니라 GCP 인프라 (Cloud Logging sink → BigQuery/GCS 라우팅 + retention 정책) 문제. 앱은 3x retry + structured log fallback 까지가 최선. 인프라 슬라이스는 별도로 분리해 사용자 조치와 분리 가능하게.

### 다음 세션에 이어갈 것

v0.117 후보:
- classroom 상세 페이지 (Phase 6, 앱-only 슬라이스).
- 감사 로그 배치 export (Phase 6, 앱-only 슬라이스).
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.117 classroom 상세 페이지 (2 라운드 Codex 감사)

**슬라이스** — `/admin/classrooms/:id` 신규 상세 페이지 도입. `ClassroomTable` 이름 컬럼을 `Link` 로 전환해 유일한 진입점. 기존 `CourseMembersDialog` 를 `CourseMembersPanel` 로 리팩터해 dialog 컴포넌트 제거. 상세 페이지는 코스 정보 카드 · 멤버 관리 패널 · super_admin 감사 이력 링크를 담고, inline actions 로 아카이브/복구 · 소유자 이관 · 삭제를 노출. Delete 성공 시 목록으로 자동 이동.

### 커밋

| 커밋 | 요약 |
|---|---|
| `e91f2ca` | feat(web): `/admin/classrooms/:id` 라우트 + Panel 리팩터 + Table Link 전환 + 10+23 회귀 |
| `d626be7` | fix: F80 audit target URL param 서버 필터 + F81 CourseMembersPanel onPendingChange 로 코스 mutation 세 액션 disabled |

### v0.117 → v0.117b

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.117 | `e91f2ca` | 8/2/2 | F80 `?q=<id>` 는 client-side action/message 검색만 · F81 `onPendingChange` 미연결 → 코스 mutation 이 pending 중에도 활성 |
| v0.117b | `d626be7` | **8/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `c44f73f` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 465 + web 717 = 1209 unit.

### 배운 것

- **audit 링크는 서버 필터 URL 로 연결** — 감사 화면의 `q` 는 현재 페이지 내 client-side action/message 부분 문자열 검색이라 pagination 뒤 이벤트는 놓친다. 서버 exact-match (`filterTarget`) URL param 을 추가하고, 감사 페이지 UI 도 target 입력 · 필터 초기화 · empty-state · JSON export · 파일명 요약에 일관되게 반영해야 딥링크 목적 (target 이력 검색) 이 실효를 갖는다.
- **Dialog → Panel 리팩터 시 pending state 부모 노출 필수** — Dialog 는 modal backdrop 이 클릭을 막지만, 페이지에 임베드된 Panel 은 부모의 다른 액션과 시간 격리가 없음. 자식이 `onPendingChange(pending)` 콜백으로 mutation 상태를 부모에 알리고, 부모가 인접 액션을 disabled 처리하는 명시적 계약이 필요. Codex F81 이 정확히 이 지점.
- **Dead code 정책** — CourseMembersDialog 를 완전 제거해 dead code 방지. 상세 페이지가 유일한 진입점이 되고 「멤버」 dialog 진입점은 사라진다. 테이블 이름 클릭이 유일한 진입 액션 → 딥링크·URL 공유·뒤로가기 자연스러움. 리팩터 시 「임시로 남겨둠」 을 피하는 게 리뷰·유지보수에 좋음.
- **URL 인코딩 페어링** — `encodeURIComponent(courseId)` 로 인코딩하고 `useParams` + `decodeURIComponent` 로 복원. audit target 도 `courses/<id>` 전체를 `encodeURIComponent` — `/` 가 `%2F` 로 인코딩돼 서버에서 정확한 exact-match. hash character 나 querystring separator 같은 특수문자 안전.

### 다음 세션에 이어갈 것

v0.118 후보 (ROADMAP Phase 6 남은 항목):
- 감사 로그 배치 export (전체 페이지 순회).
- admin/users 검색 필터.
- super_admin 대시보드 위젯.
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.118 감사 로그 배치 export (5 라운드 Codex 감사)

**슬라이스** — 기존 JSON export (v0.108) 은 현재 페이지 `filteredEntries` 만 밀어냈고 `hasMore=true` 여도 partial 로 표시하고 끝. 이번 슬라이스는 서버 pagination 을 hasMore=false 까지 순회해 하나의 통합 payload 로 저장. 「전체 JSON」 버튼 · progress banner + 취소 · 서버 cursor 안정화 · client-side q 필터 반영 · 오류 UI.

### 커밋

| 커밋 | 요약 |
|---|---|
| `6a585a1` | feat: fetchAllAuditLog helper + AuditLogTable 「전체 JSON」 버튼 + progress/cancel + 9 회귀 |
| `65e6556` | fix: F82 compound cursor + F83 abort race + F84 q filter + F85 error UI |
| `11ac027` | fix: F86 Timestamp full precision + F87 AbortError 흡수 + F88 legacy cursor 명시 거부 |
| `f75ea68` | fix: F89 cursor 정수/범위 검증 (Number.isInteger, nanoseconds 0..999_999_999) |
| `12af002` | fix: F90 seconds 상한 (253_402_300_799 = 9999-12-31T23:59:59Z) |

### v0.118 → v0.118e Codex 5 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.118 | `6a585a1` | 6/4/2 | F82 서버 cursor ties · F83 abort race · F84 q filter 미적용 · F85 error UI 부재 |
| v0.118b | `65e6556` | 7/3/2 | F86 ms 정밀도 · F87 AbortError · F88 legacy cursor 조용히 drop |
| v0.118c | `11ac027` | 7/1/2 | F89 정수/범위 검증 부족 |
| v0.118d | `f75ea68` | 6/1/2 | F90 seconds 상한 (Timestamp MAX) |
| v0.118e | `12af002` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `4a00f85` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 477 + web 732 = 1236 unit.

### 배운 것

- **Firestore pagination cursor 는 (Timestamp, docId) compound 로 안정화 필수** — `at < before` 단일 필드 cursor 는 같은 timestamp 이벤트가 여러 개일 때 (batch write, serverTimestamp 동시성) 페이지 경계에서 유실 발생. `orderBy(at DESC, __name__ DESC).startAfter(atTs, docId)` 로 tiebreak. Firestore composite index 는 __name__ 을 암묵적으로 포함하므로 별도 index 없이 동작.
- **Timestamp precision 은 ms 로 truncate 하면 안 됨** — Firestore Timestamp 는 microsecond (nanoseconds/1000) 정밀도. cursor 를 `{seconds, nanoseconds, id}` 로 full precision 보존해야 sub-ms ties 도 안전. `Timestamp.fromMillis(ms).toMillis()` 왕복은 nanoseconds 를 항상 0 으로 만든다.
- **AbortSignal 은 wire 까지 전파 + AbortError 는 정상 취소로 흡수** — `AbortController.abort()` 은 fetch 를 즉시 취소 (in-flight 도) 하려면 signal 을 `fetch(url, {signal})` 로 forward 해야. 그리고 fetch reject 시 발생하는 `AbortError` (DOMException 또는 Error.name === 'AbortError') 는 정상 취소로 흡수해서 UI 에 「실패」로 표시 안 되게. 여러 브라우저 호환성 위해 `signal.aborted` 상태와 이름 둘 다 확인.
- **Rolling deploy 중 legacy wire 는 조용히 drop 하지 말고 명시 거부** — 서버 wire protocol 변경 (숫자 cursor → object cursor) 시 legacy input 을 undefined 로 조용히 drop 하면 old client 가 loadMore 시 첫 페이지를 다시 받아 dedup 없이 중복 append. `invalid-argument` 로 명시 거부해 refresh 유도.
- **Input validation 은 constructor 예외를 catch 하지 말고 사전 판정** — `new Timestamp(seconds, nanoseconds)` 는 non-integer 나 out-of-range 시 RangeError. 이걸 catch 하지 않으면 최종 `unknown` HttpsError 로 변환되어 「명시 거부」 계약 미달. `Number.isInteger` + 범위 (0..999_999_999, 1..253_402_300_799) 를 constructor 앞에 확인.
- **Codex 5 라운드 반복 지적의 패턴** — 각 라운드마다 이전 fix 의 「edge case」를 파고 든다. F82 ties → F86 microsecond → F89 정수/범위 → F90 상한. 처음부터 「Timestamp full precision + Number.isInteger + range」 를 다 갖췄으면 5 라운드가 1~2 라운드로 줄었을 것. **wire protocol 변경 시 constructor 계약을 처음부터 완전히 반영하는 게 라운드 수 감소**. Codex 는 이 부분에 대해 상세하고 신뢰할 만한 catch 를 제공한다.

### 다음 세션에 이어갈 것

v0.119 후보 (ROADMAP Phase 5/6):
- super_admin 대시보드 위젯 (Phase 6, 앱-only 슬라이스).
- 전입생 계정 개별 생성 UX 개선 (Phase 5, `laterAccountSetup` 포팅).
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.119 CreateUserDialog OU 드롭다운 + 클래스룸 자동 배정 (4 라운드 Codex 감사)

**슬라이스** — bliss00 지시: 워크스페이스 계정 생성 시 (1) 조직 단위를 기존 목록 드롭다운 + 직접 입력, (2) 기존 클래스룸을 체크박스로 선택해 계정 생성 후 자동 배정. 신규 `orgunitsList` callable (Directory API `orgunits.list`) + `useOrgunitsList` React Query 훅 + `CreateUserDialog` combobox 리팩터 + 순차 classroom add 파이프라인.

### 커밋

| 커밋 | 요약 |
|---|---|
| `b1b4639` | feat: orgunitsList callable + DirectoryClient orgunits + CreateUserDialog combobox + classroom checkbox + 6+7 회귀 |
| `d6dd485` | fix: F91 OU 안내 정정 + F92 form snapshot/busy lock + F93 password clear + F94 useClassroomList open gate |
| `7c641d4` | fix: F95 busy 중 handleClose 차단 (X/Escape/outside dismissal 커버) |
| `c73da10` | fix: F96 event-based 회귀로 소스 문자열 검사 대체 |

### v0.119 → v0.119d Codex 4 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.119 | `b1b4639` | 7/4/2 | F91 misleading OU 안내 · F92 form race · F93 password 잔존 · F94 open gate 부재 |
| v0.119b | `d6dd485` | 7/1/2 | F95 busy 중 X/Escape close 차단 부재 |
| v0.119c | `7c641d4` | 5/1/2 | F96 회귀가 소스 문자열만 검사 |
| v0.119d | `c73da10` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `cb743e5` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 484 + web 745 = 1256 unit.

### 배운 것

- **Wire 계약과 UI 안내는 반드시 일치** — 「직접 입력 가능」 안내는 Google Directory API 가 실제로 자동 생성해줘야 유효. `users.insert` 는 orgUnitPath 를 자동 생성 안 함 (별도 `orgunits.insert` 필요). 안내 문구가 백엔드 계약과 어긋나면 사용자가 400 응답을 원인 없이 받게 됨. Codex 가 정확히 잡은 지점.
- **Async submit 은 제출 시점을 snapshot 으로 고정** — role/selection state 를 await 뒤에 다시 읽으면 사용자가 실행 중 값을 바꿔 원 선택과 다른 결과 발생. `handleSubmit` 초입에 필요한 state 를 로컬 변수로 캡처. 실행 중에는 입력 요소 disabled 로 사용자 오해도 방지 (2중 안전).
- **Busy 중 Dialog close 차단은 Radix 의 controlled onOpenChange 한 지점에서** — X 버튼 · Escape · outside click 모두 Radix 가 `onOpenChange(false)` 로 라우팅하므로 우리 `handleClose` 가 busy gate 하면 세 경로 모두 커버. footer 취소 버튼 disabled 만으로는 부족 (Radix 는 여러 dismissal 경로 제공).
- **Password 는 계정 생성 성공 즉시 state 에서 제거** — 부분 실패 배너로 dialog 가 유지되는 경우 password 가 메모리에 계속 남는 것은 감사·보안 위험. `setPassword('')` 를 `usersCreate` 성공 직후 수행.
- **AccountsTable 처럼 dialog 를 항상 mount 하는 컨테이너에서는 React Query 훅에 `enabled=open` gate 필수** — 안 그러면 dialog 가 닫혀 있어도 API 호출 · 감사 이벤트 발생. 트래픽/비용/audit noise 모두 낭비.
- **회귀 테스트는 소스 문자열 검사 대신 실제 이벤트로** — Codex 감사 표준. `fireEvent.keyDown(Escape)` · Radix Close 버튼 `screen.getByRole('button', {name: /닫기/})` 로 실사용 경로를 재현해야 계약이 제거되거나 Radix 연결이 깨져도 잡힘.

### 다음 세션에 이어갈 것

v0.120 후보 (ROADMAP Phase 5/6):
- super_admin 대시보드 위젯 (Phase 6, 앱-only 슬라이스).
- orgunits.insert 신규 OU 생성 UI (v0.119 잔재, 지금은 기존 OU 만).
- 전입생 계정 개별 생성 UX 개선 (Phase 5).
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

**하이브리드 위임 시작** (bliss00 승인 2026-09-11) — v0.120 마무리 사이클부터 안티그래비티에 「병합 + 배포 + 4 문서 갱신 + 채널 공지」 위임. 오더 template 은 `docs/handoff/NEXT.md` 「안티그래비티 위임 template」 섹션. Head 는 신규 슬라이스 구현 · Codex 감사 응답 · hotfix 담당.

---

## 2026-09-11 · v0.120 super_admin 대시보드 「오늘 액션별」 위젯 (2 라운드 Codex 감사)

**슬라이스** — SuperAdminPage 에 오늘 감사 이벤트를 action 종류별로 집계하는 위젯 신설. `auditLogSummary` 를 확장해 서버가 500 개 sample 을 in-memory 그룹핑, top action 은 count 내림차순 bar-list. 각 row 는 audit filter 링크 (action + atMin=today). sample truncated 시 배너로 명시.

### 커밋

| 커밋 | 요약 |
|---|---|
| `20e6ce7` | feat: auditLogSummary 확장 + SuperAdminPage 「오늘 액션별」 위젯 + 3+4 회귀 |
| `0b76820` | fix: F97 `actionCounts=undefined` (구 응답 backward-compat) 구분 |

### v0.120 → v0.120b Codex 2 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.120 | `20e6ce7` | 7/1/2 | F97 구 응답 (actionCounts 필드 없음) 이 `count>0` 이어도 「이벤트 없음」 오표시 |
| v0.120b | `0b76820` | **5/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `6be9db7` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 487 + web 750 = 1264 unit.

### 배운 것

- **Response schema 확장은 optional 필드 + undefined vs {} 구분** — 신규 필드를 optional 로 추가하는 것은 backward-compat 하지만, 클라이언트가 `?? {}` 로 통일해서 처리하면 「구 서버 응답 (필드 부재)」 과 「신규 서버 응답 + 실제 빈 집계」를 못 구분한다. 실제 UX 로 「이벤트 없음」 오표시로 이어짐. `undefined` 분기와 `{}` 분기를 명시.
- **Sample-scope caveat 은 UI 에도 반영** — 500 sample 상한으로 in-memory 그룹핑하면 `count > sampleSize` 일 때 전체와 다를 수 있음. Codex 는 v0.105 에서 이미 표본 범위 caveat 을 요구했고, v0.120 도 같은 패턴 (`sampleTruncated` 배너로 명시). 이 caveat 이 없으면 사용자가 partial 집계를 정확한 것처럼 오해.
- **가벼운 위젯 슬라이스도 test isolation 이슈에 주의** — `auditLogSummary` 를 확장하면서 `readAuditEntries` 를 두 번 호출하게 되면, 기존 tests 의 `mockResolvedValueOnce` 큐가 부족. `beforeEach` 에 default `mockResolvedValue` 지정으로 해결.

### 다음 세션에 이어갈 것

v0.121 후보:
- orgunits.insert 신규 OU 생성 UI (v0.119 잔재).
- 이번 주/월 window breakdown (v0.120 은 「오늘」만).
- 전입생 계정 개별 생성 UX 세부 (Phase 5).
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.121 orgunits.insert 신규 OU 생성 UI (2 라운드 Codex 감사)

**슬라이스** — v0.119 잔재였던 「신규 OU 생성」 완료. `admin.directory.orgunit` (read/write) scope 를 별도로 요구하는 `orgunitsCreate` callable 신설, CreateUserDialog 안에 「+ 새 OU 만들기」 인라인 폼 (name/parent/description) 추가. 성공 시 폼 접힘 + orgUnitPath 자동 채움 + orgunits list 캐시 invalidate. bliss00 자율 진행 지시 (2026-09-11) 하에 Head 단독 실행.

### 커밋

| 커밋 | 요약 |
|---|---|
| `c3feb12` | feat: orgunitsCreate callable + DirectoryClient orgunits.insert + CreateUserDialog 인라인 폼 + 서버 12/클라 7 회귀 |
| `e373632` | fix: F98 (insert 성공 후 audit 실패 시 성공 응답 보존 — writeAuditWithBackup + 회귀 2건) |

### v0.121 → v0.121b Codex 2 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.121 | `c3feb12` | 8/1/2 | F98 성공 후 `writeAudit` 실패 시 이미 생성된 외부 OU 를 일반 실패로 반환 → client `orgUnitPath` 유실 → 재시도 409 |
| v0.121b | `e373632` | **6/0/2** 통과 | 없음 |

### 병합 · 배포

- 병합 커밋: `5aef31f` (main). PR 없이 fast-forward merge (non-fast-forward `--no-ff` merge commit).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`. 새 함수 `orgunitsCreate` 첫 배포 자동 (Workspace 정책 override 이후 firebase-tools 가 `allUsers` invoker IAM 자동 부여, 2026-09-02 발견).
- 로컬 관문: shared 27 + functions 501 + web 757 = 1,285 unit. TypeScript · lint · Vite build 통과.

### 배운 것

- **Google API 성공 뒤 감사 실패는 성공 응답을 뒤엎지 말 것** — v0.116 F78 (transferOwnership) 에서 이미 확립된 원칙이지만 v0.121 초기 작성에서 놓쳤다. 외부 자원 (OU, classroom owner 등) 이 이미 변경된 상태에서 감사 write 실패로 error throw 하면, client 는 새 자원 식별자를 못 받고 재시도 시 중복 오류 (409 already-exists). 원칙: **외부 side-effect 성공 후의 감사는 `writeAuditWithBackup` 로 격리하고 성공 응답을 그대로 반환** — 감사 유실은 Cloud Logging fallback (structured JSON, severity=ERROR) 로 재구성 가능.
- **성공 경로 재구조화 시 mapUpstreamError 의 범위 축소** — 기존 하나의 try/catch 안에 validation · Google 호출 · orgUnitPath 검증 · audit 를 모두 포함하면 audit 실패도 mapUpstreamError 를 거쳐 「unknown」 으로 감쌈. 각 단계를 별도 try 경계로 분리해야 audit-only 실패를 응답 반환으로 전환할 수 있다.
- **TypeScript `Awaited<ReturnType<...>>` 두 단계** — `insert` 는 함수 필드라 `ReturnType` 을 두 번 씌워야 반환 값을 얻는다: `Awaited<ReturnType<ReturnType<typeof getDirectoryClient>['orgunits']['insert']>>`. 첫 build 에서 하나만 쓰면 「함수 타입」 을 대입하려 해서 TS2322.
- **bliss00 자율 진행 지시가 있으면 하이브리드 위임 skip 가능** — 「내가 중요한 의사결정을 해야하는 상황이 생기기 전까지 작업 진행을 계속 해줘」 (2026-09-11) 지시 하에서, 병합/배포/문서/공지 사이클도 Head 가 직접 실행. Antigravity 위임의 오버헤드 (오더 작성 · 응답 대기) 를 회피하는 것이 자율 진행 지시와 부합.

### 다음 세션에 이어갈 것

v0.122 후보:
- 이번 주/월 window breakdown (v0.120 은 「오늘」만).
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅).
- 클래스룸 소유자 이관 UI (v0.116 서버는 있으나 UI 미완).
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.122 SuperAdminPage 액션별 위젯 window breakdown (1 라운드 Codex 감사)

**슬라이스** — v0.120 위젯은 「오늘」만 지원했으나 사용자가 이번 주/이번 달 도 볼 수 있도록 segmented control 추가. auditLogSummary 는 이미 `atMin`/`atMax` 를 받으므로 서버 변경 없이 UI 만 확장. bliss00 자율 진행 지시 하에 Head 단독 실행.

### 커밋

| 커밋 | 요약 |
|---|---|
| `d8b1348` | feat: SuperAdminPage 액션별 위젯에 오늘/이번 주/이번 달 segmented control + 회귀 6건 |

### Codex 감사

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.122 | `d8b1348` | **7/0/2** 통과 | 없음 (판정불가: 브라우저 timezone 실행 · emulator Java) |

### 병합 · 배포

- 병합 커밋: `6f925f8` (main).
- 배포: `firebase deploy --only hosting --project school-app-5a636` (functions 변경 없음).
- 로컬 관문: shared 27 + functions 501 + web 763 = **1,291 unit**.

### 배운 것

- **Headline metric 안정성 vs. 인터랙티브 위젯 분리** — 대시보드에 window selector 를 추가할 때, 「오늘 이벤트」 KpiCard 나 preview 처럼 headline metric 은 항상 「오늘」 을 유지하고 breakdown 위젯만 별도 query 로 전환하는 것이 UX 명확성에 유리. 하나의 selector 가 페이지 전체 view 를 뒤집으면 사용자가 「지금 보는 게 뭐지」 라는 혼란을 겪는다.
- **date-fns 없이도 이번 주/이번 달 경계 계산은 표준 Date API 로 충분** — 월요일 offset = (day+6)%7, 월 시작 = `new Date(y, m, 1, 0, 0, 0, 0)`. dependency 추가 없이 짧게 처리. 사용자의 로컬 timezone 을 그대로 따르므로 「이번 주 = 사용자가 살고 있는 이번 주」 로 일치.
- **1 라운드 통과 슬라이스도 판정불가는 명시** — 브라우저 timezone 이나 emulator Java 처럼 로컬 환경에서 실행 불가한 케이스는 판정불가로 남긴다. F# 라벨을 열지 않아도 「무엇을 안 봤나」 는 감사 원본에 명시.

### 다음 세션에 이어갈 것

v0.123 후보:
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅).
- 클래스룸 소유자 이관 UI (v0.116 서버는 있으나 UI 미완).
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.123 BulkRestoreDialog — AccountsTable 「선택 복구」 (2 라운드 Codex 감사)

**슬라이스** — BulkSuspendDialog 는 있으나 「일괄 복구 (bulk unsuspend)」 UI 가 없어 정지된 계정을 하나씩 개별 「복구」 버튼으로만 되돌릴 수 있었다. BulkSuspend 와 대칭인 UI 를 추가. 서버 API 는 `callUsersUpdate({suspended:false})` 재사용.

### 커밋

| 커밋 | 요약 |
|---|---|
| `3f63988` | feat: BulkRestoreDialog + AccountsTable 「선택 복구」 버튼 + 5건 회귀 |
| `c251481` | fix: F99 (confirm 시 emails snapshot 확정) + F100 (label htmlFor 연결) + 회귀 2건 |

### v0.123 → v0.123b Codex 2 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.123 | `3f63988` | 6/2/2 | F99 emails prop live reference, F100 label htmlFor 누락 |
| v0.123b | `c251481` | **6/0/2** 통과 | 없음 (판정불가: 브라우저 close 시각 흐름 · emulator Java) |

### 병합 · 배포

- 병합 커밋: `75eac51` (main).
- 배포: `firebase deploy --only hosting --project school-app-5a636` (functions 변경 없음).
- 로컬 관문: shared 27 + functions 501 + web 770 = **1,298 unit**.

### 배운 것

- **비동기 실행 도중 부모 prop 변경 방어 = confirm-time snapshot 패턴** — 다이얼로그가 confirm 순간 부모의 selection state 를 승인 대상으로 삼았지만 live prop 을 그대로 순회하면, 실행 중 부모가 selection 을 clear/변경하면 실제 처리 대상이나 완료 집계가 달라진다. 해결: `useState<string[] | null>(null)` snapshot 을 phase 전환과 동시에 확정하고, 이후 렌더/순회는 `displayEmails = runEmails ?? emails` 로 phase 별 소스 분기.
- **label semantics 는 htmlFor + id 가 primary source of truth** — 시각적으로 label 이 input 위에 있어 사용자는 관계를 짐작할 수 있어도, 스크린리더는 프로그램적 연결 (`htmlFor` ↔ `id`) 로만 인식. testing-library 의 `getByLabelText` 도 이 연결을 파싱하므로 회귀 테스트로도 계약을 고정 가능. v0.99 UI_SYSTEM.md 208 라인 label semantics 가 이미 문서화.
- **BulkSuspendDialog 에도 동일 버그 존재하지만 범위 유지** — v0.123 감사는 BulkRestoreDialog 신규 파일만 대상. 같은 패턴을 그대로 clone 했기 때문에 BulkSuspendDialog 에도 F99/F100 동일. 이번 슬라이스에서는 스코프 유지하고 별도 후속 슬라이스로 분리 예정 (AGENTS.md 규약: opportunistic refactor 금지).

### 다음 세션에 이어갈 것

v0.124 후보:
- **BulkSuspendDialog 도 F99/F100 적용** (opportunistic refactor 아니라 명시적 accountability + a11y 슬라이스).
- **감사 액션별 위젯 정확 count aggregation** — v0.120/v0.122 는 sample-scope (max 500) breakdown. Firestore `count()` aggregation 으로 각 action 별 정확 count 구할 수 있을지 검토.
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅) — 도메인 규칙 필요.
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.124 BulkSuspendDialog F99/F100 대칭 적용 (1 라운드 Codex 감사)

**슬라이스** — v0.123b 감사에서 BulkRestoreDialog 만 고쳤던 두 갭 (F99 emails prop live reference · F100 label htmlFor 누락) 을 BulkSuspendDialog 에도 적용. v0.123 에서 스코프 유지를 위해 pre-existing BulkSuspendDialog 는 별도 슬라이스로 분리해 두었던 항목.

### 커밋

| 커밋 | 요약 |
|---|---|
| `ae751d4` | feat: BulkSuspendDialog 에 F99/F100 대칭 적용 + 회귀 2건 |

### Codex 감사

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.124 | `ae751d4` | **6/0/2** 통과 | 없음 (판정불가: 브라우저 시각 흐름 · emulator Java) |

### 병합 · 배포

- 병합 커밋: `963495c` (main).
- 배포: `firebase deploy --only hosting --project school-app-5a636` (functions 변경 없음).
- 로컬 관문: shared 27 + functions 501 + web 772 = **1,300 unit** (첫 1300 넘김).

### 배운 것

- **동일 패턴을 두 파일에 clone 했을 때는 두 파일 모두 감사 한 사이클 안에 통과시켜야 규율이 유지된다** — v0.123 에서 「스코프 유지」 라는 명분으로 pre-existing BulkSuspendDialog 를 남겨뒀는데, 결과적으로 v0.124 라는 한 슬라이스 더 소비. AGENTS.md 「opportunistic refactor 금지」 는 「같은 문제를 이미 알고 고치는 중」 인 경우와는 구분되어야. 앞으로 같은 패턴 clone 슬라이스는 audit 제안된 fix 를 쌍둥이 파일에도 함께 적용하는 것이 규율에 더 부합.
- **대칭 slice 는 Codex 감사도 매우 빠르게 통과** — 이미 v0.123b 에서 통과 확인된 fix 패턴이라 Codex 도 첫 라운드에 clean 통과. 이런 mechanical slice 는 병합/배포/문서 사이클을 빠르게 돌릴 수 있음.

### 다음 세션에 이어갈 것

v0.125 후보:
- **감사 액션별 위젯 정확 count aggregation** — v0.120/v0.122 는 sample-scope (max 500) breakdown. `count()` aggregation 으로 각 action 별 정확 count 구할 수 있을지 검토.
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅) — 도메인 규칙 필요.
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.125 AccountsTable 「필터 초기화」 button + F101/F102 (2 라운드 Codex 감사)

**슬라이스** — v0.112 에서 AuditLogTable 에 도입했던 「필터 초기화」 버튼 패턴을 AccountsTable 에도 적용. 검색 · KPI 필터 · 정렬을 한 번에 원자적 clear. 개별 필터를 하나씩 되돌리는 것보다 UX 훨씬 빠름.

### 커밋

| 커밋 | 요약 |
|---|---|
| `5e26ee6` | feat: AccountsTable 「필터 초기화」 button + 5건 회귀 (기본 disabled · q/filter/sort enabled · clear 후 disabled 복원) |
| `d31720e` | fix: F101 (raw vs normalized 혼용) + F102 (URL/DOM 검증 부실) + 4건 boundary 회귀 |

### v0.125 → v0.125b Codex 2 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.125 | `5e26ee6` | 4/2/2 | F101 raw vs normalized 혼용 · F102 test 부실 |
| v0.125b | `d31720e` | **6/0/2** 통과 | 없음 (판정불가: 브라우저 좁은 화면 배치 · emulator Java) |

### 병합 · 배포

- 병합 커밋: `6025fe1` (main).
- 배포: `firebase deploy --only hosting --project school-app-5a636` (functions 변경 없음).
- 로컬 관문: shared 27 + functions 501 + web 781 = **1,309 unit**.

### 배운 것

- **활성 판정은 실제 적용 규칙 기준으로 정규화** — URL param 존재 (raw) 와 실제 필터 적용 (normalized) 는 다를 수 있다. 예: `?q=%20` 는 URL 에 존재하지만 trim 후 미적용, `?filter=weird` 는 존재하지만 allowlist 밖이라 미적용, `?dir=desc` 단독은 sort 없이 무의미. 「필터 초기화」 버튼의 활성 판정을 raw 로 하면 disabled/enabled 표시와 실제 필터 상태가 어긋난다. **정규화 파이프라인 (`searchQuery.trim()`, `sortColumn` normalized non-null, kpiFilter allowlist) 을 그대로 판정에도 사용**해야 UX 일관성 유지.
- **정확한 활성 판정은 「인터랙션 무효」 방지에도 도움** — dir 단독 URL 에서 초기화 버튼을 활성으로 표시하면 사용자가 클릭했을 때 URL 은 비어지지만 표시된 데이터는 변화 없음 → 사용자는 「버튼이 동작 안 함」 이라고 느낀다. 활성 조건을 「실제 필터 규칙」 기준으로 좁히면 이런 경험 회피.
- **UI 버튼 activation UT 는 disabled 뿐 아니라 side-effect 검증도 필요** — 첫 라운드 테스트는 「필터 없으면 disabled · 필터 있으면 enabled」 만 확인해서 F101 을 놓쳤다. LocationSpy 로 URL search 값 자체 · DOM 사용자 복원 · boundary case (공백-only q · 잘못된 filter · dir 단독) 를 함께 검증해야 정규화 대칭 보장.

### 다음 세션에 이어갈 것

v0.126 후보:
- **감사 액션별 위젯 정확 count aggregation** — v0.120/v0.122 는 sample-scope (max 500) breakdown. Firestore `count()` aggregation 으로 각 action 별 정확 count 검토.
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅) — 도메인 규칙 필요.
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).
