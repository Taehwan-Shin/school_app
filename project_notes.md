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

---

## 2026-09-11 · v0.126 감사 액션별 위젯 정확 count aggregation (2 라운드 Codex 감사)

**슬라이스** — v0.120/v0.122 위젯의 breakdown 은 sample-scope (최신 500) 라 count > 500 시 truncated. 사용자가 「정확 카운트 보기」 를 누르면 서버가 `AUDIT_ACTIONS` 28 개를 Firestore `count()` aggregation 으로 병렬 조회 → 전체 window 의 정확 per-action count 반환. v0.101b 의 `(action, at DESC)` 복합 인덱스 재사용, 추가 인덱스 배포 불필요.

### 커밋

| 커밋 | 요약 |
|---|---|
| `4572939` | feat: server `auditLogSummary.exact?` + `exactActionCounts?` + Promise.all count() 병렬 + 클라이언트 toggle |
| `7445a7c` | fix: F103 (합계 불변식 + `_other` bucket) + F104 (handleWindowChange 원자적) + 회귀 강화 |

### v0.126 → v0.126b Codex 2 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.126 | `4572939` | 6/2/2 | F103 AUDIT_ACTIONS 비강제 카탈로그로 미등록 action 누락 · F104 window 전환 시 exact=true 중간 render leak |
| v0.126b | `7445a7c` | **7/0/2** 통과 | 없음 (판정불가: 실 Firestore aggregation · emulator Java) |

### 병합 · 배포

- 병합 커밋: `c2832fb` (main).
- 배포: `firebase deploy --only hosting,functions --project school-app-5a636`.
- 로컬 관문: shared 27 + functions 506 + web 786 = **1,319 unit**.

### 배운 것

- **합계 불변식 (invariant) 은 catalog-free 시스템의 정확성 보증에 필수** — `AUDIT_ACTIONS` 는 UI 필터 드롭다운 편의를 위한 카탈로그일 뿐, 서버는 임의 action 문자열 저장을 허용한다 (auditActions.ts 주석). 이 상태에서 「카탈로그만 세면 정확」 이라고 가정하면 미등록 action 이 누락되고 UI 는 「전부 정확 집계」 오표기. **해결**: 서버가 `total count` 와 `sum(catalog counts)` 를 비교해 차이를 `_other` bucket 으로 명시적으로 보존. 합계 불변식 `sum(all keys, including _other) === total count` 를 코드와 테스트로 고정. 이 패턴은 앞으로 catalog-free 필드를 집계할 때 재사용 가능.
- **여러 setter 를 useEffect 로 조율하는 대신 event handler 안에서 함께 호출** — React batched update 는 같은 event handler 안의 setState 를 한 번의 render 로 묶는다. 반면 useEffect 로 파생 state 를 리셋하면 첫 render 는 「전환 중」 상태 (새 window + 이전 exact=true) 로 나타나 부작용 (React Query 새 요청) 이 발화 가능. **원칙**: 「A 를 바꾸면 B 도 리셋」 이 필요하면 handleXChange 함수를 만들어 A + B 를 같은 이벤트에서 함께 갱신. useEffect 는 진짜 파생 계산 (외부 API sync 등) 에만.
- **판정불가 항목 (실 Firestore) 을 성능/비용 관점에서 명시** — v0.126 은 28 개 count() 병렬. Firestore aggregation 은 조건에 매치되는 doc 개수 상관없이 read 1 로 과금. 즉 exact 요청 1 회 = 총 29 reads (total + 28 per-action). sampleTruncated 시에만 사용자가 명시적으로 요청하도록 UI 게이팅 → 서버 비용 최소.

### 다음 세션에 이어갈 것

v0.127 후보:
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅) — 도메인 규칙 필요.
- audit_log durable sink 인프라 (v0.116 F78 잔재, 사용자 조치 필요).

---

## 2026-09-11 · v0.127 GroupsTable 「필터 초기화」 button + F105 (2 라운드 Codex 감사)

**슬라이스** — v0.125 AccountsTable · v0.112 AuditLogTable 의 「필터 초기화」 패턴 세 번째 적용. GroupsTable 은 이미 q + filter + sort/dir 를 URL 로 관리하고 있었으나 clear 버튼 미보유. 대칭 UX 확립.

### 커밋

| 커밋 | 요약 |
|---|---|
| `a71ad9e` | feat: GroupsTable 「필터 초기화」 버튼 (v0.125 대칭) + 9건 회귀 |
| `64650d9` | fix: F105 (allowlist 밖 filter fail-closed → fail-open 대칭) + DOM 회귀 강화 |

### v0.127 → v0.127b Codex 2 라운드

| 라운드 | HEAD | Codex 결과 | 실패 항목 |
|---|---|---|---|
| v0.127 | `a71ad9e` | 6/1/2 | F105 fail-closed 로 인한 dead state (invalid URL 에서 목록 사라짐 · 복구 버튼 disabled) |
| v0.127b | `64650d9` | **6/0/2** 통과 | 없음 (판정불가: 브라우저 layout · emulator Java) |

### 병합 · 배포

- 병합 커밋: `5d8b083` (main).
- 배포: `firebase deploy --only hosting --project school-app-5a636` (functions 변경 없음).
- 로컬 관문: shared 27 + functions 506 + web 795 = **1,328 unit**.

### 배운 것

- **대칭 슬라이스는 실제 코드 semantic 도 대칭이어야 안전** — 같은 UI 버튼 패턴 (「필터 초기화」) 을 세 번째 테이블에 clone 하면서 발견: AccountsTable 은 invalid filter 를 fail-open (필터 미적용 → 목록 유지), GroupsTable 은 fail-closed (필터 부재 취급 → 빈 목록) 로 이전부터 semantic 이 어긋나 있었다. 「같은 UI」 를 붙이는 순간 이 어긋남이 dead state 로 노출됨 (`?filter=weird` → 목록 사라짐 → 초기화 버튼 disabled 라 복구 불가). v0.124 의 clone slice 교훈 (「clone 하면서 발견된 fix 는 쌍둥이에도 적용」) 과 유사한 원리: 대칭 UX 슬라이스는 데이터 처리 semantic 도 함께 감사해야.
- **fail-open vs fail-closed 의 선택은 사용자 복구 가능성 기준** — URL param 은 사용자 손에서 오타 가능. 이 경우 fail-closed 는 사용자에게 「내가 뭘 잘못했지?」 라는 인지 부하만 주고 실질 방어 이득 없음 (일반 공격 벡터도 아니고). fail-open (invalid 무시) + 복구 가능한 UI (초기화 버튼) 조합이 UX 관점에서 더 견고. 진짜 security-critical 판정 (예: role gate) 만 fail-closed 유지.
- **Codex 는 「UI 버튼 disabled 판정 ↔ 실제 데이터 처리」 mismatch 를 잘 잡는다** — v0.125b F101 (raw vs normalized), v0.127 F105 (fail-open vs fail-closed) 모두 「버튼 상태와 실제 앱 상태의 불일치」 패턴. Codex 감사가 이런 계약 어긋남에 특히 강함을 확인.

### 다음 세션에 이어갈 것

v0.128 후보 (남은 후보 모두 사용자 조치 필요):
- 전입생 계정 개별 생성 UX 세부 (Phase 5, `laterAccountSetup` 포팅) — 도메인 규칙 필요.
- audit_log durable sink 인프라 (v0.116 F78 잔재) — Firebase console 조치 필요.
- 소소한 UX slice (필요 시): CreateGroupDialog · CreateClassroomDialog 인라인 검증 강화, 감사 로그 필터 quick preset 확장 등.

---

## 2026-09-11 · Bulk 하드닝 시리즈 완주 (v0.123~v0.131)

### 완주 표

| # | 슬라이스 | 발견 | 시리즈 커밋 | 병합 커밋 |
|---|---|---|---|---|
| 1 | BulkRestoreDialog (신규) | v0.123 Codex F99/F100 | `c251481` | `75eac51` |
| 2 | BulkSuspendDialog | v0.123 clone → v0.124 대칭 | `ae751d4` | `963495c` |
| 3 | BulkDeleteDialog | 자체 진단 (v0.128) | `77a4c28` | `a914fc9` |
| 4 | BulkMoveOuDialog | 자체 진단 (v0.129) | `89edb4c` | `25f1722` |
| 5 | BulkResetPasswordDialog | 자체 진단 (v0.130, F100 이미 v0.113b) | `a483136` | `00501e9` |
| 6 | BulkRemoveMembersDialog | 자체 진단 (v0.131) | `82e0d06` | `33aebd7` |

### 규범화된 패턴

모든 파괴적 bulk dialog 가 이제 다음 두 계약을 만족:

**F99 (accountability)**: 사용자가 confirm 을 누른 순간의 emails prop 을 `[...emails]` 로 snapshot. running/done phase 는 `displayEmails = runEmails ?? emails` 로 snapshot 을 우선 사용. 실행 중 부모 selection 이 바뀌어도 승인 대상 == 처리 대상 == 완료 집계.

**F100 (a11y)**: confirmation input 의 label 은 `htmlFor="bulk-{action}-confirm-input"` + input `id` 매칭. `getByLabelText` 로 접근 가능. UI_SYSTEM label semantics 규약 준수.

### 배운 것 (시리즈 전체)

- **Codex 감사가 첫 파일 (BulkRestoreDialog) 에서 F99/F100 을 발견한 뒤, 시리즈 완주로 모든 유사 파일에 확산** — 원래 v0.123 Codex 감사가 「BulkSuspend 대칭 신규 파일」 하나만 검토했지만, 발견된 패턴이 여섯 다이얼로그 전부에 존재. 이 원리는 「같은 패턴 여러 파일이면 clone slice 감사 때 발견된 fix 는 쌍둥이에도」 (v0.124 배운 것) 를 시리즈 규모로 실증.
- **소소한 mechanical slice 는 audit 도 빠르게 통과** — v0.129~v0.131 각 1 라운드 통과. 이런 반복형 hotfix 는 audit 사이클 오버헤드가 작고, 시간이 지날수록 slice 하나당 20~30분에 완료.
- **패턴 완주 자체가 문서 (project_notes) 로 남기 좋은 마일스톤** — 여섯 slice 를 개별로 둘러보면 아래 규범 계약을 읽기 어렵지만, 완주 표로 한 곳에 모으면 「이제 이 패턴은 codebase 전반에서 강제」 라는 상태를 명시할 수 있음.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.132+):
- **전입생 계정 UX 세부** (Phase 5) — 도메인 규칙 필요 (사용자 조치).
- **audit_log durable sink 인프라** (v0.116 F78 잔재) — Firebase console 조치 필요.
- 다른 소소한 UX 개선.

---

## 2026-09-13 · v0.134 클래스룸 일괄 이름 변경 (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `87e65d2` | classroomPatch 서버 확장 + BulkRenameClassroomDialog UI + 통합 + 21 신규 테스트 |
| 라운드 1 hotfix | `4806cbc` | F118 (ARCHIVED 제외) · F119 (API 한도 750/2800 정정) · 4 신규 테스트 |
| 병합 | `870522b` | Merge into main + Firebase deploy |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `87e65d2` | 통과 6 / 실패 2 / 판정불가 0 | F118 ARCHIVED · F119 API 한도 |
| 2 | `4806cbc` | 통과 11 / 실패 0 / 판정불가 1 (SHA 오탈자) | 코드상 실패 없음 |

### 서버 확장

`classroomPatch` 는 원래 courseState 만 (ACTIVE ↔ ARCHIVED) 지원. v0.134 는:

- `name?: string` · `section?: string` optional 필드 추가. 요청에 최소 하나의 업데이트 필드 필요 (`no_fields_to_update`).
- **동적 updateMask**: 요청 필드 조합에 따라 comma-joined (`courseState,name` 등).
- **cap 분리**: courseState 변경은 `classroom.archive` 유지, name/section 변경은 `classroom.write`. 복합 요청은 두 cap 모두 assert.
- **검증**: name/section 은 trim 후 length (name 1..750, section 0..2800, empty 는 section clear 허용).
- **audit message**: 필드별 값을 `;` 로 결합, name/section 값은 `JSON.stringify` 로 quote (세미콜론 포함 이름 안전).
- F72 (teacher 담당 코스 사전 검증) 는 필드 종류와 무관하게 유지.

### UI: BulkRenameClassroomDialog

원본 Apps Script `updateAndLogClassroomNames` 포팅. 다중 선택 코스에 대해:

- **패턴 (선택)**: 찾기/바꾸기 (단순 문자열 `split(find).join(replace)` — 정규식 아님) · 전체 적용 · 원래대로.
- **개별 편집 (필수)**: 각 코스별 새 이름 input · 변경/무변경/무효 상태 색 구분 · aria-invalid.
- **3-phase confirm/running/done**: BulkArchive 대칭. F99 snapshot (부모 courses prop 변화 방어) · F100 label htmlFor/id 연결.
- **변경 대상만 순차 patch**: `originalName === newName` 인 행은 API 호출 skip.
- **useEffect dep 에서 courses 제외 (의도적)**: open 변경 시에만 rows 재계산. 열려있는 다이얼로그의 편집 상태를 부모 list invalidation 으로부터 보호. 재열기 시 새로운 selection 반영은 ClassroomTable 의 조건부 렌더 (unmount/remount) 로 보장.

### F118 (ARCHIVED 제외)

Codex 라운드 1 지적: `bulkRenameCourses` 가 ACTIVE + ARCHIVED 코스 모두 대상. 그러나 Classroom REST v1 은 ARCHIVED 코스의 name/section 변경을 거부 (courseState 만 변경 허용). ARCHIVED 를 포함시키면 부분 실패 확정.

수정: `bulkRenameCourses` 필터에서 ARCHIVED 제외, ACTIVE 만 통과. ClassroomTable 테스트에 2 시나리오 (ACTIVE + ARCHIVED 선택 시 count=1 · ARCHIVED 만 선택 시 disabled).

### F119 (API 한도 정정)

Codex 라운드 1 지적: NAME_MAX=255 · SECTION_MAX=255 는 Google Directory Course 스키마 참조에서 유도한 값이나, Classroom REST v1 공식 한도는 name 750자 · section 2800자. 낮은 상한은 정상 변경을 차단.

수정: NAME_MAX=750 · SECTION_MAX=2800 로 정정 + 상수 위 주석에 근거 URL. 테스트 시나리오 15 는 751 로 조정, 15b (정확히 750 boundary) 및 15c (section 2801) 신규 추가.

### 배운 것

- **API 문서를 명시적으로 확인하지 않고 상한을 추정하지 마라**. 원본 (Apps Script) 에도 명시가 없었고, Directory Course 스키마 (인접 API) 의 값을 그대로 옮긴 것이 문제. Codex 가 공식 REST 문서 URL 로 즉시 반박함. 상수를 코드에 넣기 전 근거 URL 을 주석에 남겨두면 후속 감사도 빠르게 검증 가능.
- **API state 제약을 UI 층에서 사전 필터**. 서버가 어차피 거부할 요청 (ARCHIVED rename) 을 UI 에서 미리 제외하면 부분 실패 UX 를 완전히 회피. 서버 검증은 최후 방어선으로 유지.
- **재열기 시 selection 재계산 문제는 unmount/remount 로 우아하게 해결**. useEffect dep 에 `courses` 를 포함시키면 편집 중 rows 초기화 위험, 제외하면 재열기 시 stale. 조건부 렌더로 컴포넌트 자체를 새 인스턴스로 만들면 두 문제 모두 해결 (개별 상태 vs prop 반영 사이의 tension 해소).
- **audit message 포맷 선택**: JSON.stringify 는 이름에 세미콜론이나 quote 가 포함될 때 파싱 가능성 유지 목적. 현재 파싱 소비자 (BigQuery SQL 등) 는 없으나 미래 확장을 위한 방어. Codex 도 「불필요한 방어인가?」 를 묻고 「고정 커밋 내 파서 없음, 안전한 보존」 으로 통과 판정.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.135+):
- **전입생 계정 UX 세부** (Phase 5) — `laterAccountSetup` 의 「학번/반 자동 배정 + 그룹 자동 추가」 매크로.
- **계정 삭제 안내 메일** — SendGrid 등 3rd party.
- **감사 로그 사용자 정의 window** — v0.122 의 3-way 를 임의 일수로 확장.
- **첫 audit fallback 검증** — v0.133 sink 배포 완료, 실 fallback 발생 후 BigQuery 조회 smoke test 필요.

---

## 2026-09-13 · v0.135 감사 대시보드 window 「지난 N일」 (3 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `efb2b5e` | BreakdownWindow union 확장 (nDays) · sanitize · atMin=(오늘-N-1)일 · 4th chip + 프리셋 7/30/90 + numeric input · F104 원자성 유지 · 5 신규 테스트 |
| 라운드 2 hotfix | `9da2613` | F120 대응 — 테스트 강화 시도 + UX aria-invalid + 「범위 밖」 문구 |
| 라운드 3 hotfix | `d5fa1b4` | F120b/c 대응 — 두 F104 회귀 테스트 순서 재구성 (전제 조건 확립 → leak 검사) |
| 병합 | `a5d3e38` | Merge into main + Firebase deploy (hosting only, functions no change) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `efb2b5e` | 통과 6 / 실패 1 / 판정불가 0 | F120: F104 회귀 테스트가 leak 부재 미검증 |
| 2 | `9da2613` | 통과 6 / 실패 2 / 판정불가 0 | F120a/b: 테스트 두 경로 여전히 preset/input handler 리셋 제거 회귀 못 잡음 |
| 3 | `d5fa1b4` | 통과 5 / 실패 0 / 판정불가 2 (감사 환경 write 제약) | 통과 · 병합 승인 |

### 설계

- **BreakdownWindow union 확장**: `'today' | 'week' | 'month'` → `'today' | 'week' | 'month' | 'nDays'`.
- **nDaysSanitized 정규화**: `/^\d+$/` 만 통과 · `1..365` 범위 밖은 `30` fallback. 소수·음수·지수 표기 모두 fallback.
- **atMin 계산**: `(오늘 00:00) - (N-1)일`. N=1 이면 오늘 00:00 == today window 와 일치.
- **UI**: 상위 4-way segmented control · nDays 선택 시 sub-controls 노출 (7/30/90 프리셋 + `<input type=number min=1 max=365>`).
- **F104 원자성 유지**: `handleNDaysPreset` 과 `handleNDaysInputChange` 둘 다 `setExactAggregation(false)` + window/N 갱신을 같은 이벤트 handler 에서 batched 로 처리 → (새 nDays atMin, exact=true) leak 방지.
- **aria-invalid + fallback 문구**: input 이 범위 밖일 때 red border + `aria-invalid=true` + 「범위를 벗어나 {N}일로 적용됨 (1~365)」 시각 힌트.

### F120 3 라운드 이야기

라운드 1 감사가 F120 을 지적: 「나의 F104 신규 테스트가 마지막 exact=false 만 확인 · 실제 leak 부재 미검증」.

라운드 2 에서 두 경로 (preset/input) 각각에 대해 `(nDays atMin, exact=true) leak 부재 + (nDays atMin, exact=false) 발생 확인` 을 추가했지만, 감사가 다시 지적: 「테스트 순서상 window-nDays 진입이 이미 exact=false 로 리셋 → 이후 preset/input 은 exact=false 상태에서 시작하므로 handler 의 exact 리셋 제거 회귀는 여전히 잡히지 않음」.

라운드 3 에서 두 테스트 순서를 재구성:
1. nDays 진입 (exact=false, N=30 기본).
2. **그 상태에서 exact-btn 클릭** → (nDays=30, exact=true) 로 진입.
3. **전제 조건 확인**: (nDays=30 atMin, exact=true) 호출이 실제 발생함을 assertion.
4. 대상 액션 (preset-7 or input=14).
5. 새 atMin + exact=true 조합 leak 부재 검증.

이제 handler 의 `setExactAggregation(false)` 를 제거하면 실제로 leak 이 발생하고 테스트가 실패 → 회귀 방지 계약 강화.

### 배운 것

- **회귀 테스트는 실제로 회귀를 잡는지 검증하라**. 「이 시나리오에서 이 값이 되어야 한다」 만 확인하는 것과 「이 handler 를 없앴을 때 실패하는가」 는 다르다. Codex 가 라운드 2 에서 이를 정확히 지적: "handler 의 exact 리셋을 제거해도 테스트 통과 = 회귀 방지 못함". Head 는 라운드 1 · 2 모두 자신의 테스트가 충분하다고 판단했으나 감사가 더 엄격. 앞으로 회귀 테스트를 쓸 때는 「이 테스트를 유지한 채 대상 코드를 없애면 실패하는가?」 를 스스로 물어라.
- **테스트 시나리오 pre-condition 확립을 명시적으로**: v0.135b 라운드 2 실수는 window 전환 자체가 pre-condition 을 오염시키는 것을 놓친 것. 시나리오의 시작 상태 (nDays + exact=true) 를 명시적으로 확립하고 assertion 으로 확인한 뒤 대상 액션을 트리거하면 이런 오염을 피할 수 있음.
- **Codex 감사 소프트 권고도 반영 가치 있음**: 라운드 1 의 UX 소프트 권고 (aria-invalid + 「범위 밖」 문구) 를 라운드 2 에 함께 반영. 감사 라운드 수를 하나 절약하고 사용자 경험도 개선.
- **Antigravity 위임 첫 실전 결과**: v0.135 마무리 사이클을 `@Antigravity` 에게 NEXT.md antigravity template 오더로 위임했으나 ~15 분 무응답 → Head 폴백. Antigravity 의 활성화 상태 · @mention 인식 여부 · 오더 파싱 능력을 별도 확인 필요. bot 이 대응 안 하면 Head 가 계속 폴백하는 것으로 실무는 굴러가지만 위임 template 의 실질 효과가 없음.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.136+):
- **전입생 계정 UX 세부** (Phase 5) — `laterAccountSetup` 매크로 (도메인 규칙 필요).
- **계정 삭제 안내 메일** — SendGrid 등 3rd party.
- **첫 audit fallback 검증** — v0.133 sink 실 데이터 흐름 smoke test.
- **Antigravity 위임 재시도** — 첫 시도 무응답 원인 확인 · 활성 확인 후 재시도.

---

## 2026-09-13 · v0.136 개별 클래스룸 rename (1 라운드 Codex 통과)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `9709bc8` | feat: v0.136 개별 클래스룸 이름 · 섹션 변경 UI (classroomDetail inline) |
| 소프트 권고 반영 | `4a018f3` | test: v0.136b Codex 소프트 권고 반영 (ClassroomDetailPage 통합 테스트 추가) |
| 병합 | `4d95124` | Merge feat/classroom-rename-inline-v136 into main (Firebase deploy hosting only, functions skipped) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `9709bc8` | 통과 8 / 실패 0 / 판정불가 0 | 통과 승인. 소프트 권고: ClassroomDetailPage 통합 테스트 추가 권고 (v0.136b `4a018f3` 로 4개 시나리오 반영 완료) |

### 설계

- **Bulk 와 Individual 대비**:
  - v0.134 BulkRenameClassroomDialog 는 다중 선택 일괄 검색/치환 및 행별 편집 중심.
  - v0.136 RenameClassroomDialog 는 개별 classroomDetail 페이지 내 inline modal 로 단일 클래스룸의 이름과 섹션을 직접 수정.
  - 서버 `classroomPatch` 는 v0.134 에서 확장된 `name`, `section`, 동적 `updateMask` 를 그대로 재사용 (서버 변경 없음).
- **F118 UX 차단**:
  - Classroom REST v1 제약으로 ARCHIVED 코스는 name/section 변경 불가.
  - classroomDetail 페이지에서 `isActive` (`course.courseState === 'ACTIVE'`) 일 때만 「이름 변경」 버튼 노출. ARCHIVED / PROVISIONED 는 사전 차단.
  - `membersPending` 상태 시 버튼 disabled 처리 (F81 대칭).
- **target snapshot 및 폼 검증**:
  - 다이얼로그 open 시 target 을 snapshot 으로 고정 (F99 대칭), 백그라운드 list invalidation 이나 부모 갱신으로부터 편집 상태 격리.
  - label htmlFor / input id 연결 (F100 대칭).
  - F119 상한 준수: name 최대 750자, section 최대 2800자. 빈 이름이나 상한 초과 시 red border + aria-invalid + 안내 문구.
  - 변경된 필드만 요청에 포함 (name-only, section-only, 둘 다).

### 배운 것

- **Codex 소프트 권고를 라운드 없이 후속 커밋으로 반영**:
  - 1 라운드 통과 승인을 받은 상태에서 감사자가 제시한 소프트 권고 (ClassroomDetailPage 통합 테스트 4건) 를 별도 라운드 감사 요청 없이 v0.136b 로 즉시 반영하여 회귀 방어력을 높임.
- **Antigravity 위임 2번째 시도 결과**:
  - v0.135 첫 시도 무응답 (Head 폴백) 이후, v0.136 에서 2번째 위임 사이클을 정상 수신하여 브랜치 병합, 전체 빌드 및 테스트 (1,410건 통과), Firebase Hosting 배포 (Functions 44개 no changes 감지 및 skip, Hosting 릴리스 완료), 4개 문서 갱신 및 채널 공지까지 자율 일괄 완료.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.137+):
- **전입생 계정 UX 세부** (Phase 5) - `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일** - SendGrid 등 3rd party.
- **첫 audit fallback 검증** - v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-13 · v0.137 ClassroomTable 검색·필터·정렬 (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `d80d20d` | feat: v0.137 ClassroomTable 검색 · KPI 필터 · 정렬 · 「필터 초기화」 (AccountsTable v0.125 · GroupsTable v0.127 대칭) |
| 감사 대응 | `60e6721` | fix: v0.137b Codex F121/F122/F123 대응 (indeterminate · pagination · 정렬·checked·boundary 테스트) |
| 병합 | `e71286c` | Merge feat/classroom-search-filter-v137 into main — v0.137 ClassroomTable 검색·KPI 필터·정렬·「필터 초기화」 (AccountsTable/GroupsTable 대칭) + F121/F122/F123 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `d80d20d` | 통과 10 / 실패 3 / 판정불가 0 | 재작업 필요. F121: indeterminate 가 visibleSelectedCount 만 사용 → 필터 밖 선택만 남으면 미검출. F122: 필터 결과 0 일 때 pagination 미렌더. F123: 정렬 실 행 순서 미검증 · checked/indeterminate 직접 단언 누락 · 25/26 boundary 미검증. 소프트 권고: 정렬 헤더 키보드 접근성 · dir 단독/unknown sort 초기화 미활성 테스트 |
| 2 | `60e6721` | 통과 7 / 실패 0 / 판정불가 0 | 병합 승인. F121/F122/F123 대응 완료. 소프트 권고(정렬 헤더 키보드 접근성 등)는 v0.138+ 로 유보 |

### 설계

- **AccountsTable / GroupsTable 대칭**:
  - `q` (이름/섹션/id 부분 일치, trim 및 소문자 정규화), `filter` (active/archived allowlist, fail-open), `sort/dir` (name/section/state asc↔desc) URL params 지원.
  - 검색·KPI·정렬 변경 시 0페이지 리셋 (`setPage(0)`).
  - 「필터 초기화」 버튼: `q.trim()`, allowlist `filter`, non-null `sort` 중 하나라도 활성화 시 표시, 클릭 시 빈 `URLSearchParams` 로 원자적 클리어.
- **selectedIds ⨯ filter 상호작용**:
  - 전체 선택: 필터 결과 내 eligible 코스 기준 토글.
  - 선택 상태 보존: 필터 밖에서 이미 선택된 항목도 `selectedIds` 에 유지되며 bulk action 은 전체 courses 기준으로 실행.
  - `indeterminate` 판정: 필터 결과 중 일부 선택 또는 필터 밖 선택만 남아있는 경우(`hasAnySelection && !isAllEligibleSelected`)에도 `indeterminate = true` 설정 (F121).
- **pagination boundary**:
  - 원본 코스 데이터가 존재하는 한, 필터 검색 결과가 0건이라도 pagination 컨트롤을 항상 렌더하여 상태(0/0 및 disabled 버튼)를 명확히 노출 (F122).
  - 25개 페이지네이션 단위 기준 경계(25개 disabled, 26개 2페이지 활성화) 보장.

### 배운 것

- **indeterminate 상태는 뷰(필터) 밖의 선택도 반영해야 함**:
  - 필터로 인해 화면에 보이는 선택 항목이 0개라도 전체 선택 집합에 요소가 남아있다면 헤더 체크박스를 indeterminate 로 표시해야 사용자가 선택이 잔존함을 인지할 수 있음 (F121).
- **결과 0건이어도 pagination 은 항상 렌더**:
  - 결과가 비었을 때 pagination 을 숨기면 레이아웃 점프가 생기고 현재 페이지 위치 인지가 어려움. 빈 결과에서도 disabled 상태로 일관 렌더링 유지 (F122).
- **Antigravity 위임 3번째 사이클 성공**:
  - v0.136 에 이어 v0.137 도 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 delegation reply 스레드 event id 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.138+):
- **정렬 헤더 키보드 접근성** (Codex 소프트 권고) — `<th onClick>` 대신 `<button>` 또는 keydown 처리.
- **전입생 계정 UX 세부** (Phase 5) — `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일** — SendGrid 등 3rd party.
- **첫 audit fallback 검증** — v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-13 · v0.138 정렬 헤더 키보드 접근성 (1 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `5f4400f` | feat: v0.138 정렬 헤더 키보드 접근성 3화면 대칭 (Codex v0.137 소프트 권고 반영) |
| 병합 | `60c404b` | Merge feat/sort-header-a11y-v138 into main (v0.138 정렬 헤더 키보드 접근성 3화면 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `5f4400f` | 통과 8 / 실패 0 / 판정불가 2 | 통과 · 병합 승인. 판정불가: read-only sandbox EPERM (Vitest 미실행, Head 가 web 881 통과 확인) · repo lint=tsc. 소프트 권고 3건(helper 단위 테스트, 프롬프트 오기, ESLint 관문)은 v0.139+ 로 유보 |

### 설계

- **sortHeaderKbdProps helper 공유**:
  - `packages/web/src/routes/admin/sortHeader.ts` 신설.
  - `sortHeaderKbdProps(onActivate, className?)`: `role="columnheader"` 기본 TableHead 위에서 `tabIndex={0}`, `onKeyDown` (Enter/Space 키 감지 시 `e.preventDefault()` 후 `onActivate()`), focus-visible ring 스타일(`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary`) 반환.
  - 3화면 (ClassroomTable 3열, AccountsTable 3열, GroupsTable 3열) 총 9개 sortable 헤더에 spread 적용. 기존 `onClick` 핸들러 유지하여 마우스 클릭 회귀 보존.
- **React.KeyboardEvent 타입만 참조**:
  - helper 에서 React 런타임 import 없이 `import type { KeyboardEvent } from 'react'` 타입만 참조하여 번들 오버헤드 최소화.
- **TableHead cn 병합 및 정렬 클래스 보존**:
  - `components/ui/table.tsx` 의 TableHead 가 `cn()` (tailwind-merge) 으로 병합하므로 GroupsTable 의 `directMembersCount` 등 `text-right` 정렬 클래스가 기본 `text-left` 를 안전하게 대체하고 focus ring 보존.

### 배운 것

- **Codex 소프트 권고를 별도 슬라이스로 반영하는 흐름**:
  - v0.137 감사에서 제기된 접근성 소프트 권고(정렬 헤더 키보드 트리거 및 dir 단독/unknown sort 비활성화 명시 테스트)를 즉시 다음 슬라이스(v0.138)의 명확한 독립 단위로 분리하여 반영.
  - 슬라이스 범위를 작고 집중되게 유지함으로써 1 라운드 만에 8건 전원 통과 및 병합 승인 획득.
- **v0.137 학습 template 즉시 반영**:
  - 이전 사이클에서 학습된 CLI 제약(`buzz messages send` 가 `--content @/tmp/xxx` 미지원, stdin 파이프 필요)을 NEXT.md 안티그래비티 위임 template 및 공지 파이프라인에 즉시 반영하여 운영 실패 원인을 사전 제거.
- **Antigravity 위임 4번째 사이클 성공**:
  - v0.136, v0.137 에 이어 v0.138 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 delegation reply 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.139+):
- **Codex v0.138 소프트 권고 반영**: `sortHeader.ts` helper 단위 테스트 추가, ESLint 관문 구성.
- **전입생 계정 UX 세부** (Phase 5) - `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일** - SendGrid 등 3rd party.
- **첫 audit fallback 검증** - v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-13 · v0.139 sortHeader helper 단위 테스트 (1 라운드 Codex 감사 + v0.139b)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `46f3c10` | test: v0.139 sortHeader.ts helper 단위 테스트 (Codex v0.138 소프트 권고 반영) |
| 소프트 권고 | `9dad561` | test: v0.139b invocationCallOrder assertion 추가 (Codex 소프트 권고 반영) |
| 병합 | `4ad74c9` | Merge feat/sort-header-unit-test-v139 into main — v0.139 sortHeader helper 단위 테스트 (Codex v0.138 소프트 권고) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `46f3c10` | 통과 5 / 실패 0 / 판정불가 1 | 통과 · 병합 승인. 판정불가: read-only sandbox EPERM (Vitest 미실행, Head 가 web 887 통과 확인). 소프트 권고(호출 순서 assertion)는 v0.139b (`9dad561`) 로 즉시 반영 |

### 설계

- **신규 `packages/web/tests/sortHeader.test.ts` (6 케이스)**:
  - Enter 키 감지 시 `preventDefault` 후 `onActivate` 가 순서대로 호출됨 (`invocationCallOrder` 고정).
  - Space 키 감지 시 `preventDefault` 후 `onActivate` 가 순서대로 호출됨 (`invocationCallOrder` 고정).
  - Tab, a, Escape, ArrowDown, A, 1 등 비매칭 키에서는 `preventDefault` 및 `onActivate` 미호출.
  - 반환 객체의 3 필드 shape (`className`, `onKeyDown`, `tabIndex: 0`) 검증.
  - `extraClassName` 인자 전달 시 trim 처리 및 클래스명 정상 append.
  - focus-visible ring, cursor-pointer, select-none 기본 스타일 클래스 문자열 포함 검증.
- **소프트 권고 v0.139b 즉시 반영**:
  - Codex 라운드 1 소프트 권고였던 호출 순서 assertion (`onActivate` 보다 `preventDefault` 가 먼저 호출되는 불변식) 을 `9dad561` 로 즉시 추가.

### 배운 것

- **소프트 권고 즉시 반영 흐름**:
  - 감사에서 병합 차단은 아니지만 품질을 높이는 소프트 권고(호출 순서 검증)가 나오면 v0.139b 서브 커밋으로 즉시 흡수하여 병합 전 완성도 확보.
- **3-화면 integration + helper unit 이중 방어**:
  - v0.138 에서는 3개 테이블 컴포넌트 실 DOM 상에서 키보드 이벤트 트리거를 테스트했고, v0.139 에서는 `sortHeaderKbdProps` 순수 helper 의 세부 계약(호출 순서, 키 필터링, 스타일 조합)을 단위 테스트로 격리 검증하여 향후 테이블 추가나 리팩터링 시에도 안정적인 재사용 기반 마련.
- **Antigravity 위임 5번째 사이클 성공**:
  - v0.136, v0.137, v0.138 에 이어 v0.139 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 delegation reply 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.140+):
- **ESLint 관문 추가** (Codex v0.138 잔여 소프트 권고) — repo lint 를 tsc 외 eslint 구성 및 pnpm lint 추가.
- **전입생 계정 UX 세부** (Phase 5) — `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일** — SendGrid 등 3rd party.
- **첫 audit fallback 검증** — v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-13 · v0.140 web ESLint 관문 (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `6e0cb63` | feat(web): eslint.config.js 신규 + lint 스크립트 확장 (functions 대칭) |
| 라운드 1 hotfix | `89e9ee9` | fix(web): F124 react-hooks 5.2 -> 7.1.1 업그레이드 (ESLint 10 peer 지원) |
| 병합 | `52e41bf` | Merge feat/web-eslint-v140 into main - v0.140 web ESLint 관문 (Codex v0.138 소프트 권고) + F124 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `6e0cb63` | 통과 6 / 실패 1 / 판정불가 1 | F124: react-hooks@5.2 peer 범위 ESLint 9까지 (ESLint 10 미지원). 판정불가: read-only sandbox EPERM |
| 2 | `89e9ee9` | 통과 10 / 실패 0 / 판정불가 1 | 통과 · 병합 승인. eslint-plugin-react-hooks 7.1.1 업그레이드로 ESLint 10 peer 충족. 판정불가: read-only sandbox EPERM |

### 설계

- **functions 대칭**:
  - `packages/web/eslint.config.js` 신설하여 functions 와 동일한 flat config 구조 구성.
  - `package.json` 의 lint 스크립트를 `tsc --noEmit && eslint src tests` 로 확장하여 monorepo 일관성 확보.
- **react-hooks warn only**:
  - `rule = 'react-hooks/exhaustive-deps: warn'` 으로 설정하여 기존 빌드/린트 파이프라인을 차단하지 않으면서 잠재적인 훅 의존성 누락을 감시.
- **disable 주석 계약 유지**:
  - 기존 코드에 존재하던 4곳의 eslint-disable 주석이 실제 린터 계약과 연결되도록 체계화.

### 배운 것

- **peer 범위 확인 필수**:
  - major 패키지 업그레이드 및 신규 도입 시 peer dependency 범위(ESLint 10 vs plugin 지원 버전)를 사전에 면밀히 확인해야 런타임/설치 시점 충돌 방지 가능 (F124 교훈).
- **warning 은 tech debt 로 분류 가능**:
  - 대규모 기존 코드베이스에 새 정적 분석 규칙을 도입할 때, 일괄 수정으로 인한 회귀 위험을 피하기 위해 warn 수준으로 시작하고 파일별 점진적 해결을 위한 기술부채로 관리하는 전략이 안전.
- **Antigravity 위임 6번째 사이클 성공**:
  - v0.136, v0.137, v0.138, v0.139 에 이어 v0.140 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 delegation reply 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.141+):
- **exhaustive-deps warning 13건 fix**: 첫 배치 = `auditLogList.ts` (4건).
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-14 · v0.141 exhaustive-deps logical expression fix (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `8207dd3` | fix: v0.141 exhaustive-deps logical expression 6건 fix (13 → 7) |
| 라운드 1 정정 | `804b079` | docs: v0.141b Codex R1 정정 반영 (남은 warning breakdown 명시) |
| 병합 | `0c8905e` | Merge feat/exhaustive-deps-logical-v141 into main - v0.141 exhaustive-deps logical expression 6건 fix (13 → 7) + F125 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `8207dd3` | 통과 8 / 실패 1 / 판정불가 1 | F125: 커밋 메시지가 「남은 7건은 missing dependency 패턴」이라 서술했으나 실제 breakdown 은 missing dep 5 + complex dependency expression 2. 판정불가: read-only sandbox EPERM (Vitest/Vite build 재실행 불가, Head 가 web 887 통과 실 확인) |
| 2 | `804b079` | 통과 10 / 실패 0 / 판정불가 1 | 통과 · 병합 승인. ClassroomTable.tsx:103 주석에 정확한 breakdown 명시 (missing dep 5 · complex expression 2). 남은 warning 위치 5곳 근거 확인. 판정불가: read-only sandbox EPERM |

### 설계

- **useMemo 로 fallback 안정 참조**:
  - `ClassroomTable.tsx` (courses 4건), `ChatBulkInviteDialog.tsx` (rosters 1건), `ClassroomBulkInviteDialog.tsx` (rosters 1건) 의 `const x = data?.foo ?? []` 공통 패턴 fix.
  - `useMemo(() => data?.foo ?? [], [data?.foo])` 로 감싸 falsy path 에서 매 렌더 빈 배열 `[]` 이 신규 생성되는 것을 방지.
- **TanStack Query dep 안정성**:
  - query 캐시 데이터가 실제로 변경될 때만 참조가 갱신되도록 보장하여, 이를 의존하는 하위 useMemo / useEffect 의 불필요한 재계산 및 렌더링 루프 차단.

### 배운 것

- **Codex 는 메시지 정확성도 감사**:
  - 코드 변경의 타당성뿐만 아니라 커밋 메시지나 문서상의 서술(남은 warning 분류 등)도 정밀 감사 대상임 (F125 교훈).
- **남은 warning breakdown 관리 필수**:
  - 기술부채로 유보한 잔여 경고(7건)에 대해 정확한 분류(missing dep 5건 + complex expression 2건)와 대상 위치(`auditLogList.ts:154,180`, `AddChatMemberDialog.tsx:36`, `ChatSpaceMembersDialog.tsx:57`, `CreateClassroomDialog.tsx:53`)를 명확히 기록해두어야 후속 슬라이스에서 혼선 없이 작업 가능.
- **Antigravity 위임 7번째 사이클 성공**:
  - v0.136, v0.137, v0.138, v0.139, v0.140 에 이어 v0.141 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 delegation reply 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.142+):
- **exhaustive-deps 잔여 7건 fix**: missing dep 5건 + complex expression 2건 (`auditLogList.ts`, `AddChatMemberDialog.tsx`, `ChatSpaceMembersDialog.tsx`, `CreateClassroomDialog.tsx`).
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-14 · v0.142 exhaustive-deps missing dep 실제 fix (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `27c0934` | fix: v0.142 exhaustive-deps missing dep 3건 fix (7 → 4) |
| 라운드 1 정정 | `a82ddd0` | fix: v0.142b Codex F126 대응 (disable 대신 실제 fix · react-query reset stable) |
| 병합 | `d4932e9` | Merge feat/exhaustive-deps-missing-v142 into main - v0.142 exhaustive-deps missing dep 3건 실제 fix (7 → 4) + F126 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `27c0934` | 통과 7 / 실패 2 / 판정불가 1 | F126: `CreateClassroomDialog.tsx:53` resetMutation 이 신규 참조라는 주석은 사실 오류 (tanstack-query 5.102.8 `mutationObserver.ts:54,62` 에서 reset 은 stable bind). `CreateClassroomDialog.tsx:39` resetForm 을 `useCallback([resetMutation])` 로 안정화 가능하므로 disable 주석 불필요. 판정불가: read-only sandbox EPERM (Vitest 재실행 불가, Head 가 web 887 통과 실 확인) |
| 2 | `a82ddd0` | 통과 7 / 실패 0 / 판정불가 1 | 통과 · 병합 승인. AddChatMemberDialog (`resetAddMutation = addMutation.reset` 구조분해 · deps `[open, resetAddMutation]`), ChatSpaceMembersDialog (`resetDeleteMutation = deleteMutation.reset` 구조분해 · deps `[open, spaceName, resetDeleteMutation]`), CreateClassroomDialog (resetForm `useCallback(..., [resetMutation])` 안정화 · deps `[open, resetForm]`). disable 주석 3개 완전 제거. 남은 4 warning (`auditLogList.ts:154,180`) 만 존재. 판정불가: read-only sandbox EPERM |

### 설계

- **react-query reset stable bind 특성 활용**:
  - `addMutation.reset` 과 `deleteMutation.reset` 은 TanStack Query `MutationObserver` 인스턴스 생성 시점에 바인딩된 stable 함수(`mutationObserver.ts:62`).
  - 구조분해 할당(`const { reset: resetAddMutation } = useAddChatMemberMutation()`)으로 추출하여 `useEffect` 의 deps 에 직접 전달해도 매 렌더 재실행되지 않고 안전함.
- **useCallback 으로 함수 참조 안정화**:
  - `CreateClassroomDialog` 의 `resetForm` 은 내부에서 `resetMutation()` 및 React `useState` setter 들(`setName`, `setSection`, `setCustomId`, `setError`)을 호출.
  - React setter 는 규약상 stable 참조가 보장되므로, `useCallback(..., [resetMutation])` 으로 감싸면 `resetForm` 자체도 stable 참조가 됨.
  - 결과적으로 `useEffect(..., [open, resetForm])` 에서 disable 주석 없이 온전히 ESLint exhaustive-deps 규칙을 준수.

### 배운 것

- **Codex 는 실 라이브러리 소스 근거로 감사**:
  - tanstack-query 소스 코드(`mutationObserver.ts`) 레벨에서 reset 메소드의 바인딩 방식을 직접 검증하여 무분별한 disable 주석 사용을 반박함.
- **disable 은 최후 수단**:
  - 의존성 경고가 발생했을 때 disable 주석으로 회피하기 전, 함수 분해/useCallback/stable 바인딩 등을 통해 실제 올바른 hook 규칙으로 리팩터링 가능한지 먼저 탐색해야 함.
- **Antigravity 위임 8번째 사이클 성공**:
  - v0.136, v0.137, v0.138, v0.139, v0.140, v0.141 에 이어 v0.142 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 delegation reply 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.143+):
- **exhaustive-deps 잔여 4건 fix**: `auditLogList.ts:154,180` (filters missing dep + complex expression) - filters hook 자체 재구성 필요.
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-14 · v0.143 auditLogList filters hook 재구성 (2 라운드 Codex 감사 + F127)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `bad7d46` | fix: v0.143 exhaustive-deps 마지막 4건 fix (auditLogList filters hook) |
| 라운드 1 정정 | `9b7b4d4` | fix: v0.143b F127 (join collision -> JSON.stringify key) |
| 병합 | `f370ea2` | Merge feat/audit-filters-hook-v143 into main - v0.143 auditLogList filters hook 재구성 (warning 4 -> 0 완주) + F127 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `bad7d46` | 통과 7 / 실패 1 / 판정불가 1 | F127: filterActions.join(',') 은 원소 내 쉼표가 있을 때 충돌 위험 (예: `['a,b', 'c']` vs `['a', 'b,c']`). 안전한 직렬화(JSON.stringify)로 대체 필요. 판정불가: read-only sandbox EPERM (Vitest 재실행 불가, Head 가 web 887 통과 실 확인) |
| 2 | `9b7b4d4` | 통과 8 / 실패 0 / 판정불가 1 | 통과 · 병합 승인. `filterActionsKey = useMemo(() => JSON.stringify(filterActionsList ?? []), [filterActionsList])` 로 안정 키 생성. filters 원시 필드 분해 및 filterActionsList dep 제외(참조 신규 위험 방지, disable 주석에 이유 명시). warning 4 -> 0 완주. lint exit 0. 판정불가: read-only sandbox EPERM |

### 설계

- **filters 필드 원시 분해**:
  - `filters` 객체는 호출측 인라인 객체라 매 렌더 새 참조를 생성함.
  - `filterActor`, `filterTarget`, `filterResult`, `filterAction`, `filterActionsList`, `atMin`, `atMax` 로 원시 필드를 분해하여 `fetchPage` 와 `useEffect` 의 의존성으로 사용.
- **filterActionsKey 문자열 키 안정화 (F127 대응)**:
  - `filterActions` 배열도 인라인 생성 시 참조 신규 위험이 있으나 배열 내용을 기준으로 의존성을 감지해야 함.
  - `join(',')` 방식의 구분자 충돌(`['a,b', 'c']` vs `['a', 'b,c']`)을 방지하기 위해 `useMemo(() => JSON.stringify(filterActionsList ?? []), [filterActionsList])` 로 정규화된 JSON 문자열 키를 추출하여 감지.
  - `filterActionsList` 배열 자체는 의존성에서 제외하고 disable 주석에 명확한 사유를 기재하여 무한 루프 위험 원천 차단.

### 배운 것

- **배열 키 직렬화 시 구분자 충돌(join collision) 방어**:
  - 배열 요소를 단일 문자열 키로 합칠 때 단순 `join(',')` 은 요소 자체에 구분자가 포함된 경우 충돌(collision)을 일으킬 수 있으므로, `JSON.stringify` 와 같은 완결된 직렬화 방식을 채택해야 함 (F127 교훈).
- **exhaustive-deps warning 13 -> 0 완주**:
  - v0.140 에서 ESLint 관문 도입 후 발견된 13개 경고를 논리 표현식 안정화(v0.141, 13 -> 7), React Query reset 안정 참조 및 useCallback 적용(v0.142, 7 -> 4), hook 필드 분해 및 배열 키 안정화(v0.143, 4 -> 0)의 3단계로 점진적이고 안전하게 전량 해결.
- **Antigravity 위임 9번째 사이클 성공**:
  - v0.136, v0.137, v0.138, v0.139, v0.140, v0.141, v0.142 에 이어 v0.143 마무리 사이클(병합, 배포, 문서 갱신)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.144+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-14 · v0.144 CreateUserDialog 클래스룸 UX 개선 (1 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `2820e70` | feat: v0.144 CreateUserDialog 클래스룸 UX 개선 (bliss00 실 피드백) |
| 병합 | `e88730b` | Merge feat/create-user-classroom-ux-v144 into main - v0.144 CreateUserDialog 클래스룸 UX 개선 (bliss00 실 UX 피드백 반영) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `2820e70` | 통과 6 / 실패 0 | 통과 · 병합 승인. bliss00 실 UX 피드백 반영. DialogContent max-w-4xl 폭 확장 및 2컬럼 grid, activeClassrooms 이름순 정렬(localeCompare), 검색 input(이름/섹션/id), 검색 필터 시 selectedIds 보존, resetForm 검색어 초기화, 리스트 max-height 96. 웹 890 (+3) 유닛, lint exit 0, 서버 변경 없음. |

### 설계

- **다이얼로그 폭 및 2컬럼 grid 레이아웃**:
  - `DialogContent` 폭을 `max-w-md` 에서 `max-w-4xl` 로 확장.
  - 폼 필드 (이메일, 이름, 비밀번호, 조직 단위) 는 왼쪽 컬럼, 클래스룸 배정 체크박스 영역은 오른쪽 컬럼으로 배치 (`grid grid-cols-1 md:grid-cols-2 gap-6`).
  - 클래스룸 스크롤 영역의 높이를 `max-h-40` 에서 `max-h-96` 으로 확장하여 시인성 확보.
- **이름순 정렬**:
  - `activeClassrooms` 를 `courses.filter(...).sort((a, b) => a.name.localeCompare(b.name))` 로 정렬하여 이름 오름차순으로 안정적 제공.
- **검색 및 선택 상태 분리/유지**:
  - `searchTerm` 상태를 추가하여 클래스룸 이름, 섹션(`section`), ID 부분 일치(대소문자 무시) 검색 지원.
  - 검색 필터링(`filteredClassrooms`)은 화면 표시용으로만 적용되며, 실제 선택된 목록(`selectedIds`)은 필터링 여부와 무관하게 온전히 유지되어 계정 생성 시 정상 배정됨.
  - 검색어 초기화는 다이얼로그가 닫히거나 폼이 초기화될 때(`resetForm`) 함께 수행.
  - 검색 결과가 없는 경우 「검색 결과가 없습니다」 안내 및 카운트(`선택됨 · 검색 결과 M/N`) 표시.

### 배운 것

- **실사용자 UX 피드백 반영**:
  - 계정 생성 시 배정할 클래스룸이 많을 때 1컬럼 협소한 레이아웃과 무정렬/비검색 환경이 주는 피로도를 해소함.
  - 다이얼로그 폭 확대 시 폼과 연계 선택 영역을 2컬럼으로 병렬 배치하면 입력 흐름과 선택 흐름이 동시에 보존됨.
- **필터링과 다중 선택 상태의 직교성(orthogonality)**:
  - 리스트를 검색/필터링할 때 화면 밖으로 숨겨진 요소의 선택 상태(`selectedIds`)를 클리어하지 않고 독립적으로 유지함으로써 사용자가 여러 검색어를 오가며 원하는 항목들을 누적 선택할 수 있게 됨.
- **Antigravity 위임 10번째 사이클 성공**:
  - v0.136~v0.143 에 이어 v0.144 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.145+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-15 · v0.145 나이스 CSV 일괄 클래스룸 생성 + 초대 (1 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `34fe149` | feat: v0.145 나이스 CSV 일괄 클래스룸 생성 + 초대 (원본 createAndInviteClassrooms 포팅) |
| 병합 | `2f66aa0` | Merge feat/neis-csv-import-v145 into main - v0.145 나이스 CSV 일괄 클래스룸 생성 + 초대 (원본 Apps Script createAndInviteClassrooms 웹 포팅) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `34fe149` | 통과 6 / 실패 0 | 통과 · 병합 승인. bliss00 실 요청 반영. 원본 Apps Script createAndInviteClassrooms 웹 포팅. 3 CSV drop → papaparse 파싱 → preview → 실행 원버튼. 원본 컬럼 인덱스 그대로 (classroom C1/E/F/G/H · teacher B/G · student B/K · 헤더 3/1/1행 skip). Classroom.Courses.create({courseState:ACTIVE}) 로 원본 create+patch 2단계를 1단계로 단축. Owner: CSV C1 우선 · 없으면 me. 신규 papaparse + @types/papaparse, neisCsvParse.ts, NeisCsvImportDialog.tsx, ClassroomTable 액션바 통합. 웹 898 (+8) 유닛, lint exit 0, 서버 변경 없음 (기존 API 재사용). |

### 설계

- **원본 Apps Script 3개 탭 조합 워크플로우 웹 포팅**:
  - 원본 createAndInviteClassrooms 흐름(`1.클래스룸생성&초대`, `교사과목정리`, `학생과목정리`)을 웹에서 그대로 수행할 수 있도록 3개 CSV 파일 업로드 인터페이스 구축.
  - `classroom.csv`: C1=ownerEmail, row 4+ 데이터, E열=과목-반(`subjectClass`), F열=코스이름(`courseName`), G열=만들기(TRUE/FALSE), H열=classroomId (output).
  - `teachers.csv`: row 2+ 데이터, B열=과목-반(`subjectClass`), G열=교사 이메일(`email`).
  - `students.csv`: row 2+ 데이터, B열=과목-반(`subjectClass`), K열=학생 이메일(`email`).
- **파싱 및 플랜 생성 (`neisCsvParse.ts`)**:
  - edge case(따옴표, 쉼표, 개행 등)에 견고한 `papaparse` 라이브러리를 채택하여 브라우저 환경에서 안정적인 CSV 파싱 구현.
  - 양식별 헤더 행 자동 스킵 (classroom 3행, teachers 1행, students 1행 건너뛰기).
  - G열이 'TRUE'(대소문자 무관)인 row 만 필터링하여 생성 대상 추출.
  - `subjectClass` 를 매칭 키로 사용하여 대상 코스에 배정될 교사/학생 목록을 매핑하는 실행 플랜(`ImportPlan`) 구축.
  - 소유자(Owner) 결정: `classroom.csv` 의 C1 셀 이메일 우선 적용, 미지정 시 로그인 사용자(`me`) 적용.
- **3-Phase 실행 다이얼로그 (`NeisCsvImportDialog.tsx`)**:
  - Select Phase: 3개 파일 drag & drop 또는 개별 파일 선택 UI.
  - Preview Phase: 파싱 결과 요약(생성 코스 N개, 매칭 교사 M명, 학생 K명) 및 코스별 상세 테이블 미리보기 제공.
  - Running/Done Phase: 순차 생성 (`classroomCreate({courseState: ACTIVE})` 로 원본 create + patch 2단계를 1단계로 단축), 과목별 교사/학생 순차 추가 (`classroomTeachersAdd`, `classroomStudentsAdd`).
  - 개별 실패 격리: 특정 교사/학생 추가 실패가 전체 배치를 중단시키지 않고 실패 목록에 기록되며 다음 항목 계속 진행. 진행률 표시줄 및 완료 요약(생성된 courseId, 교사/학생 성공/실패 카운트) 제공.
- **ClassroomTable 액션바 통합**:
  - 클래스룸 관리 화면 상단 액션바에 「나이스 CSV 일괄 생성」 버튼 신설.
  - 다이얼로그를 conditional mount 로 구성하여 불필요한 useQueryClient hook 실행 및 테스트 환경 충돌 회피.

### 배운 것

- **사용자 기존 업무 양식 보존의 가치**:
  - 나이스에서 내보낸 기존 CSV/엑셀 3개 파일 양식을 그대로 활용할 수 있도록 설계하여 사용자의 수동 편집 및 재가공 피로도를 최소화함.
- **API 호출 단계 단축 및 효율화**:
  - 원본 스크립트는 코스를 생성한 뒤 별도의 patch 호출로 `ACTIVE` 상태를 활성화했으나, 웹 포팅에서는 `create` 시점에 `courseState: ACTIVE` 를 전달함으로써 호출 횟수를 절반으로 줄이고 중간 실패 지점을 제거함.
- **Antigravity 위임 11번째 사이클 성공**:
  - v0.136~v0.144 에 이어 v0.145 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.146+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-15 · v0.146 CreateUserDialog OU 목록 에러 상세 + login scope 누락 fix (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `c192bbf` | fix: v0.146 CreateUserDialog OU 목록 에러 상세 표시 + 재시도 (bliss00 리포트) |
| 라운드 1 대응 | `884e4d9` | fix: v0.146b F128 대응 (login scope 에 admin.directory.orgunit(.readonly) 2개 추가) |
| 병합 | `479b075` | Merge fix/orgunits-error-detail-v146 into main - v0.146 CreateUserDialog OU 목록 에러 상세 표시 + login scope 누락 fix (bliss00 리포트) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `c192bbf` | 통과 3 / 실패 1 | 실패 1 (F128): CreateUserDialog 에서 「다시 로그인」 안내를 표시했으나, 실제 GOOGLE_LOGIN_SCOPES 에 admin.directory.orgunit(.readonly) 스코프가 누락되어 재로그인해도 서버에서 insufficient_scope 가 계속 발생하는 근본 원인 지적. |
| 2 | `884e4d9` | 통과 4 / 실패 0 | 통과 · 병합 승인. bliss00 실 버그 리포트 fix. GOOGLE_LOGIN_SCOPES 에 admin.directory.orgunit.readonly 및 admin.directory.orgunit 스코프 2개 추가. CreateUserDialog 에러 UI (실제 서버 응답 메시지 노출 · 「다시 시도」 refetch 버튼 · 401/403/scope 감지 시 재로그인 안내). tests/auth.test.ts 11 → 13 스코프 갱신. 웹 898 유닛 유지, lint exit 0, 서버 변경 없음. |

### 설계

- **Google Login Scope 누락 보완 (`packages/web/src/lib/auth.tsx`)**:
  - v0.119(`orgunitsList`) 및 v0.121(`orgunitsCreate`) 도입 시점에 서버 callable은 해당 scope를 요구했으나, 클라이언트 `GOOGLE_LOGIN_SCOPES` 에 `admin.directory.orgunit.readonly` 와 `admin.directory.orgunit` 가 누락되어 있었음.
  - 로그인 시 사용자에게 해당 권한 동의를 요청하도록 2개 스코프를 추가하여, 재로그인 시 유효한 access token을 발급받을 수 있도록 수정.
  - `tests/auth.test.ts` 의 provider.addScope 호출 횟수(11 -> 13) 및 파라미터 검증 갱신.
- **CreateUserDialog 에러 UI 및 진단성 강화 (`packages/web/src/routes/admin/CreateUserDialog.tsx`)**:
  - 기존에는 OU 목록 로드 실패 시 단순히 「OU 목록 로드 실패」 텍스트만 표시되어 원인 파악이 어려웠음.
  - `orgunitsQuery.error` 로부터 실제 에러 메시지(예: `insufficient_scope`, `http_403`)를 추출하여 함께 표시.
  - 목록을 다시 불러올 수 있는 「다시 시도」 버튼 (`refetch`) 제공 (`isFetching` 중 disabled).
  - 401, 403, scope, permission 키워드 감지 시 「로그아웃 후 다시 로그인하여 권한을 승인해 주세요」 안내(state-warning) 노출.

### 배운 것

- **권한 누락 버그의 근본 원인 추적**:
  - UI 에러 처리(재로그인 유도 등)를 추가하더라도, 인증 흐름 자체에서 필요한 OAuth scope를 요청하지 않으면 사용자가 아무리 재로그인해도 동일한 `insufficient_scope` 오류가 반복됨.
  - Codex 감사를 통해 표면적인 UI 개선에 그치지 않고 로그인 스코프 정의 누락이라는 근본 원인(F128)을 조기에 적발하여 해결할 수 있었음.
- **실사용자 환경에서의 OAuth 동의 갱신 필요성**:
  - 스코프가 추가된 배포 이후에도 기존 세션은 구 스코프로 발급된 토큰을 가지고 있으므로, 반드시 사용자가 로그아웃 후 재로그인하여 구글 재동의 화면에서 새 권한을 승인해야 정상 작동함. 공지 및 안내에 이 점을 명시하는 것이 필수적임.
- **Antigravity 위임 12번째 사이클 성공**:
  - v0.136~v0.145 에 이어 v0.146 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.147+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-16 · v0.147 CreateUserDialog OU 목록 재로그인 자동 복구 버튼 (3 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `ed55753` | fix: v0.147 OU 목록 재로그인 자동 복구 버튼 (prompt=consent 강제) |
| 라운드 1 대응 | `9957a06` | test: v0.147b F129 (forceConsent · reauthorizeWithGoogle 회귀 3건) |
| 라운드 2 대응 | `6672c34` | test: v0.147c F130 (reauthorize 세션 clear→signOut 실 순서 assertion) |
| 병합 | `6894567` | Merge fix/orgunits-reauth-button-v147 into main - v0.147 OU 목록 재로그인 자동 복구 버튼 (bliss00 리포트 대응) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `ed55753` | 통과 3 / 실패 1 | 실패 1 (F129): reauthorizeWithGoogle 및 signInWithGoogle({forceConsent}) 에 대한 단위 테스트 부재로 prompt 파라미터 전달 및 재인증 흐름 회귀 방어 불가 지적. |
| 2 | `9957a06` | 통과 3 / 실패 1 | 실패 1 (F130): reauthorizeWithGoogle 테스트에서 session token clear 와 Firebase signOut 간의 실제 실행 순서 검증 및 clear assertion 이 부실하여 세션 누수 방지 계약 불완전 지적. |
| 3 | `6672c34` | 통과 4 / 실패 0 | 통과 · 병합 승인. session token clear -> signOut -> signIn(consent) 실 순서 assertion 및 auth.test.ts 회귀 3건 완비. CreateUserDialog 에러 UI 에서 「Google 재로그인」 버튼 클릭 시 원클릭 자동 복구. 웹 901 (+3) 유닛, lint exit 0, 서버 변경 없음. |

### 설계

- **reauthorizeWithGoogle 헬퍼 및 forceConsent 지원 (`packages/web/src/lib/auth.tsx`)**:
  - Google OAuth `prompt: 'select_account'` 는 계정 선택만 유도하고 기 승인된 scope에 대해 동의 화면을 건너뛰므로 새 scope 인가 기회가 주어지지 않음.
  - `signInWithGoogle({ forceConsent?: boolean })` 옵션을 도입하여 `forceConsent: true` 시 `prompt: 'consent'` 를 설정하여 Google 동의 화면을 강제 표시하도록 구현.
  - `reauthorizeWithGoogle` 헬퍼에서 `clearGoogleAccessTokenFromSession()` -> `firebaseSignOut()` -> `signInWithGoogle({ forceConsent: true })` 순서로 세션을 초기화하고 강제 재동의를 수행.
  - `packages/web/tests/auth.test.ts` 에 default prompt, forceConsent prompt, 그리고 clear -> signOut -> signIn 호출 순서 및 세션 비움 assertion 3건 추가.
- **CreateUserDialog 에러 화면 원클릭 자동 복구 (`packages/web/src/routes/admin/CreateUserDialog.tsx`)**:
  - OU 목록 로드 실패 시 401, 403, scope, permission 키워드가 감지되면 기존 단순 안내 문구 대신 **「Google 재로그인 (권한 재승인)」** 버튼을 노출.
  - 사용자가 버튼을 클릭하면 `reauthorizeWithGoogle()` 을 호출하여 브라우저에서 즉시 권한 재승인 팝업을 띄우고, 재인증 성공 시 자동으로 OU 목록 재조회(`refetch()`)를 수행.
  - 재인증 진행 중(`isReauthorizing`) 버튼 비활성화 및 로딩 상태 표시, 실패 시 에러 알림.

### 배운 것

- **OAuth 권한 갱신 UX 자동화의 중요성**:
  - 스코프 추가 후 사용자에게 수동 "로그아웃 -> 재로그인"을 안내하더라도 Google의 기본 `select_account` 프롬프트로 인해 동의 화면이 생략될 수 있으며 사용자에게 번거로움을 줌. `prompt: 'consent'` 강제 및 원클릭 복구 버튼 제공으로 UX 마찰을 최소화하고 권한 불일치를 안정적으로 해소함.
- **순서 계약의 철저한 테스트 검증 (F129/F130)**:
  - 인증 세션 정리 작업은 비동기 호출 간의 실행 순서가 매우 중요함. Mock 객체의 호출 횟수뿐만 아니라, signOut 시점에 세션이 이미 비워졌는지, signIn 전에 signOut이 완료되었는지를 명시적으로 검증해야 함.
- **Antigravity 위임 13번째 사이클 성공**:
  - v0.136~v0.146 에 이어 v0.147 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.148+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-18 · v0.148 classroom 상세 페이지 학생/교사 명단 CSV 내보내기 (1 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `ff39dde` | feat: v0.148 classroom 상세 학생/교사 명단 CSV 내보내기 (원본 명단 확인 대응) |
| 병합 | `559ac45` | Merge feat/course-members-csv-export-v148 into main - v0.148 classroom 상세 페이지 학생/교사 명단 CSV 내보내기 (원본 명단 확인 대응) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `ff39dde` | 통과 5 / 실패 0 | 통과 · 병합 승인. classroom 상세 페이지 학생/교사 명단 CSV 내보내기 (원본 명단 확인 대응). CourseMembersPanel 에 「CSV 내보내기 (N)」 버튼 추가, UTF-8 BOM, 이름/이메일/userId 3개 컬럼 CSV 생성 및 다운로드 트리거. 파일명 sanitize (`/ \ : * ? " < > |` -> `_`), items 0 또는 anyPending 시 disabled 처리 및 title 툴팁 안내. 유닛 테스트 4건 (disabled, enabled+click download, 탭 전환, 파일명 sanitize) 추가. 웹 905 (+4) 유닛, lint clean, 서버 무변경. |

### 설계

- **CourseMembersPanel CSV 내보내기 버튼 (`packages/web/src/routes/admin/CourseMembersPanel.tsx`)**:
  - 교사/학생 탭 헤더 우측에 「CSV 내보내기 (N)」 버튼을 배치 (학생 탭에서는 기존 「학급 일괄 초대」 버튼 좌측에 위치).
  - 현재 활성 탭(`activeTab`: 'teachers' | 'students')의 명단 배열(`items`)을 기준으로 CSV 생성.
  - CSV 헤더: `이름,이메일,userId`. 데이터 행: `name,email,userId` 값에 대해 큰따옴표 이스케이프 (`"value"` 형태) 처리.
  - Excel 호환성을 위해 `\uFEFF` (UTF-8 BOM) 추가 후 Blob (`text/csv;charset=utf-8;`) 생성.
  - 임시 `<a>` 태그를 생성하여 `URL.createObjectURL` 로 다운로드 트리거 후 `revokeObjectURL` 로 메모리 정리.
- **파일명 sanitize 및 비활성화 조건**:
  - 파일명 형식: `<코스이름>-<교사|학생>-<YYYY-MM-DD>.csv` (오늘 날짜 KST/로컬 기준 YYYY-MM-DD).
  - 파일시스템에서 금지되는 특수문자 (`/ \ : * ? " < > |`)는 정규식을 통해 `_` 로 치환하여 OS 파일 저장 오류 방지.
  - 명단이 비어있거나(`items.length === 0`), 작업 중(`anyPending`)일 때 버튼을 `disabled` 처리하고 `title` 툴팁으로 사유를 안내.
- **회귀 방어 단위 테스트 (`packages/web/tests/CourseMembersPanel.test.tsx`)**:
  - 명단 없을 때 disabled 상태 및 툴팁 텍스트 검증.
  - 명단 존재 시 enabled 상태, 클릭 시 Blob 생성 내용(UTF-8 BOM 및 CSV 행 데이터)과 a.download 파일명 확인.
  - 교사 탭에서 학생 탭으로 전환 시 버튼 텍스트 및 다운로드 파일명(학생) 반영 확인.
  - 코스명에 특수문자(`Math / Science: 2026*?`) 포함 시 sanitize 치환 파일명(`Math _ Science_ 2026__-교사-...`) 다운로드 검증.

### 배운 것

- **클래스룸 명단 확인 업무의 웹 포팅**:
  - 기존 스프레드시트/스크립트 환경에서 운영되던 클래스룸 구성원 명단 확인 작업을 웹 상세 페이지에서 원클릭 CSV 추출로 바로 대응할 수 있게 됨.
  - UTF-8 BOM을 삽입하여 한글 Windows 환경의 Excel에서도 인코딩 깨짐 없이 즉시 열람 가능하도록 지원.
- **파일명 안전성(Sanitization) 보장**:
  - 사용자 입력 기반의 코스명은 슬래시나 콜론 등 다양한 특수문자를 포함할 수 있으므로, 파일 다운로드 시 OS 파일시스템 예약어를 사전에 치환하는 방어 로직이 필수적임.
- **Antigravity 위임 14번째 사이클 성공**:
  - v0.136~v0.147 에 이어 v0.148 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.149+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.
---

## 2026-09-18 · v0.149 반 그룹 명단 밖 자동 제거 (2 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `df1410a` | feat: v0.149 반 그룹 「명단 밖 자동 제거」 (원본 assignGroups 제외 워크플로우) |
| fix | `ea40e35` | fix: v0.149b F131 (rosters 미설정 반 스캔 제외 · 모든 MEMBER 제거 위험 방지) |
| 병합 | `f68837f` | Merge feat/auto-remove-non-roster-v149 into main - v0.149 반 그룹 명단 밖 자동 제거 (원본 assignGroups 제외 워크플로우) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `df1410a` | 통과 5 / 실패 1 | F131 지적: rosters 미설정 반(undefined)을 빈 Set 으로 처리하여 그룹 내 모든 MEMBER 가 명단 밖으로 오인되어 삭제 후보에 오르는 위험. F131 수정: rosters 가 설정되지 않은 반은 스캔 대상에서 제외(skip)하도록 방어 (빈 배열인 경우는 정상 스캔 대상으로 유지). |
| 2 | `ea40e35` | 통과 2 / 실패 0 | 통과 · 병합 승인. F131 회귀 테스트 (`tests/AutoRemoveNonRosterMembersDialog.test.tsx`) 추가 및 rosters undefined 반 skip 검증 완료. 웹 911 (+6) 유닛, lint clean, 서버 무변경. |

### 설계

- **AutoRemoveNonRosterMembersDialog (`packages/web/src/routes/admin/AutoRemoveNonRosterMembersDialog.tsx`)**:
  - 원본 Apps Script `assignGroups` 의 「제외」 워크플로우를 웹으로 포팅. 반 그룹에서 기초 데이터 rosters 에 없는 멤버를 자동 감지하여 일괄 제거.
  - 5-phase 구조: `confirm` -> `scanning` -> `preview` -> `running` -> `done`.
  - **스캔 단계**:
    - `fetchAllGroupMembers` helper 를 통해 기초 데이터의 각 (grade, class) 그룹 구성원을 최대 20,000명(100페이지)까지 페이지네이션 순회 조회.
    - rosters 명단 Set 과 대조하여 초과 멤버(surplus) 목록을 도출.
  - **보호 및 안전 규칙 (F131 포함)**:
    - rosters 가 미설정(undefined)된 반은 스캔에서 안전하게 제외하여 전원 삭제 위험을 원천 방지.
    - OWNER / MANAGER 역할은 기본 보호되며 toggle 로만 노출. 기본적으로 MEMBER 역할만 제거 대상.
    - 미리보기 화면에서 개별 체크박스를 통한 선택/해제 지원.
    - 실행 전 「제거 N」 문자열을 정확히 입력해야만 확인 버튼 활성화.
  - **실행 단계**:
    - 선택된 대상을 순차적으로 `callGroupsMembersDelete` 호출.
    - 개별 실패 격리 및 진행률 표시, 완료 후 성공/실패 카운트와 실패 내역 표시.
- **BasicDataPanel 진입점 (`packages/web/src/routes/admin/BasicDataPanel.tsx`)**:
  - 기존 「학생 자동 초대」 버튼 옆에 「명단 밖 자동 제거」 버튼 추가.
  - QueryClient 미제공 컨텍스트 회피를 위한 conditional mount 적용.

### 배운 것

- **동기화 제외 워크플로우에서의 안전 불변식 (F131)**:
  - 동기화 로직에서 명단 미입력(undefined)과 빈 명단([])은 엄격히 구분되어야 함.
  - 데이터가 정의되지 않은 상태를 빈 컬렉션으로 간주할 경우 전체 멤버가 삭제되는 치명적 부작용이 발생할 수 있으므로, 명시적인 skip 처리가 필수적임.
- **Antigravity 위임 15번째 사이클 성공**:
  - v0.136~v0.148 에 이어 v0.149 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.150+):
- **전입생 계정 UX 세부** (Phase 5): `laterAccountSetup` 매크로 (학번/반 자동 배정 + 그룹 자동 추가).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.
---

## 2026-09-18 · v0.150 반 챗방 학생 자동 초대 (1 라운드 Codex 감사)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `7ce42a1` | feat: v0.150 반 챗방 학생 자동 초대 (원본 assignMembersToChatRooms 대응) |
| 병합 | `b00342e` | Merge feat/auto-invite-chat-spaces-v150 into main - v0.150 반 챗방 학생 자동 초대 (원본 assignMembersToChatRooms 대응) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `7ce42a1` | 통과 7 / 실패 0 | 통과 · 병합 승인. AutoInviteStudentsToChatSpacesDialog 회귀 6건 (`tests/AutoInviteStudentsToChatSpacesDialog.test.tsx`) 추가 (매칭/미매칭 분리 · empty · confirm text · execute 성공/skip/실패 분류 · rosters 미설정/빈 반 제외 · scan 실패 UX). 웹 917 (+6) 유닛, lint clean, 서버 무변경 (기존 chatList/chatMembersAdd 재사용). |

### 설계

- **AutoInviteStudentsToChatSpacesDialog (`packages/web/src/routes/admin/AutoInviteStudentsToChatSpacesDialog.tsx`)**:
  - 원본 Apps Script `assignMembersToChatRooms` 웹 포팅 (로드맵 A-4). 기초 데이터 rosters 정보를 바탕으로 반별 Chat 스페이스에 학생들을 일괄 초대.
  - 5-phase 구조: `confirm` -> `scanning` -> `preview` -> `running` -> `done`.
  - **스캔 단계**:
    - `callChatList` 로 기존 Chat 스페이스 목록을 일괄 조회한 뒤 displayName Map 구축.
    - 기초 데이터의 각 (grade, class)에 대해 `{year}학년도 N학년 M반` 형식(CourseBulkCreateDialog 와 동일 규칙)으로 매칭 대상 판별.
    - 일치하는 스페이스는 매칭 목록(`matched`)으로, 스페이스가 없는 반은 미매칭(`unmatched`)으로 분리.
  - **안전 규칙**:
    - rosters 가 미설정(undefined)되었거나 학생 명단이 빈 반은 스캔 대상에서 제외 (v0.149 F131 대칭).
    - 미리보기에서 매칭 챗방 테이블(스페이스명, 학년-반, 학생 수) 및 미매칭 반 목록을 확인.
    - 실행 전 「초대 N」(N=대상 반 수) 문자열을 정확히 입력해야 확인 버튼 활성화.
  - **실행 단계**:
    - 각 매칭 스페이스에 대해 순차적으로 `callChatMembersAdd` 호출.
    - 이미 참여 중인 학생(`ALREADY_EXISTS` 등)은 자동으로 `skip` 분류, 개별 오류는 격리하여 전체 프로세스 중단 방지.
    - 실행 완료 후 성공/건너뜀/실패 카운트 및 실패 목록 표시.
- **BasicDataPanel 진입점 (`packages/web/src/routes/admin/BasicDataPanel.tsx`)**:
  - 기존 「학생 자동 초대」, 「그룹 자동 초대」, 「명단 밖 자동 제거」 버튼 옆에 「반 챗방 자동 초대」 버튼 추가.
  - QueryClient 미제공 컨텍스트 회피를 위한 conditional mount 적용.

### 배운 것

- **규칙 재사용을 통한 도메인 일관성 확보**:
  - 코스 및 챗방 네이밍 규칙(`{year}학년도 N학년 M반`)을 일관되게 공유함으로써 추가 식별 메타데이터 없이도 스페이스와 학급을 안전하게 매칭.
- **Antigravity 위임 16번째 사이클 성공**:
  - v0.136~v0.149 에 이어 v0.150 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.151+):
- **BatchCreateUsersDialog + 클래스룸 배정** (로드맵 B-5).
- **부서 그룹 명단 밖 자동 제거** (v0.149 대칭).
- **전입생 매크로** (A-1, 도메인 규칙 필요).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

## 2026-09-19 · v0.152 AccountsTable JSON 내보내기 (로드맵 B-6)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `bbe0777` | feat: v0.152 AccountsTable JSON 내보내기 (로드맵 B-6) |
| 병합 | `0d579fd` | Merge feat/auto-remove-non-roster-chat-v152 into main - v0.152 AccountsTable JSON 내보내기 (로드맵 B-6) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `bbe0777` | 통과 4 / 실패 0 | 통과 · 병합 승인. AccountsTable 회귀 3건 (`tests/AccountsTable.test.tsx`) 추가 (버튼 enabled/disabled · download 트리거 · payload shape+필터 반영). 웹 920 (+3) 유닛, lint clean, 서버 무변경. (원 계획 v0.152 반 챗방 명단 밖 자동 제거는 chat member API userId 반환 제약으로 다음 슬라이스로 유보) |

### 설계

- **AccountsTable JSON 내보내기 (`packages/web/src/routes/admin/AccountsTable.tsx`)**:
  - 로드맵 B-6 대응. 감사 및 재적재 자동화 편의를 위한 JSON export 기능.
  - CSV 내보내기 버튼 옆에 「JSON 내보내기」 버튼 추가.
  - **Payload 스키마**:
    - `exportedAt`: ISO 8601 타임스탬프 (`new Date().toISOString()`).
    - `filters`: 현재 검색/필터/정렬 상태 객체 (`q`: trim 된 검색어, `filter`: 선택된 필터, `sort`: 정렬 기준 컬럼, `dir`: 정렬 방향).
    - `totalCount`: 내보낸 사용자 수 (`users.length`).
    - `users`: 사용자 객체 배열 (`email`, `firstName`, `lastName`, `orgUnitPath`, `isAdmin`, `isSuspended`).
  - **파일 포맷 및 파일명**:
    - 파일명: `accounts-YYYY-MM-DD.json`.
    - MIME 타입: `application/json;charset=utf-8`.
    - 들여쓰기 2칸 (`JSON.stringify(payload, null, 2)`).
  - **안전 규칙 및 UX**:
    - 현재 화면의 검색·필터·정렬 결과인 `sortedFilteredUsers` 를 그대로 반영.
    - 필터 결과가 0건인 경우 버튼 disabled 처리 및 title 툴팁 안내.
    - 다운로드 Blob URL 생성 및 클릭 트리거 후 `revokeObjectURL` 로 메모리 정리.

### 배운 것

- **API 제약에 따른 유연한 스코프 전환 (Pivot)**:
  - 원 계획이었던 반 챗방 명단 밖 자동 제거는 Chat member API 가 이메일이 아닌 `userId` 만 반환하는 제약이 발견되어, 불완전한 구현 대신 로드맵 B-6 JSON 내보내기로 유연하게 피벗하여 안정성 유지.
- **Antigravity 위임 17번째 성공 (위임 오더 18번째)**:
  - v0.136~v0.150 에 이어 v0.152 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.153+):
- **AuditLogTable 무한 스크롤** (로드맵 B-7).
- **super_admin 대시보드 확장** (로드맵 B-8).
- **반 챗방 명단 밖 자동 제거**: Chat member API 의 `userId` 반환 제약 대응을 위해 `usersList` 연계 또는 서버 보강 후 진행.
- **BatchCreateUsersDialog + 클래스룸 배정** (로드맵 B-5).
- **부서 그룹 명단 밖 자동 제거** (v0.149 대칭).
- **전입생 매크로** (A-1, 도메인 규칙 필요).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

## 2026-09-19 · v0.153 AuditLogTable 무한 스크롤 (로드맵 B-7)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `65b16cd` | feat: v0.153 AuditLogTable 무한 스크롤 (로드맵 B-7) |
| 병합 | `324395b` | Merge feat/audit-infinite-scroll-v153 into main - v0.153 AuditLogTable 무한 스크롤 (로드맵 B-7) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `65b16cd` | 통과 5 / 실패 0 | 통과 · 병합 승인. InfiniteScrollSentinel 및 AuditLogTable 회귀 3건 (`tests/AuditLogTable.test.tsx`) 추가 (렌더+observe 호출 · intersecting 시 loadMore 호출 · loading=true 시 호출 skip). 웹 928 (+3) 유닛, lint clean, 서버 무변경. 1 라운드 Codex 통과. |

### 설계

- **AuditLogTable 무한 스크롤 (`packages/web/src/routes/super_admin/AuditLogTable.tsx`)**:
  - 로드맵 B-7 대응. 감사 로그 페이지 하단에 sentinel 이 뷰포트에 들어오면 자동으로 다음 25건을 로드.
  - **InfiniteScrollSentinel 컴포넌트**:
    - `IntersectionObserver` 사용 (`rootMargin: '200px'`). 사용자가 목록 끝에 도달하기 전 200px 지점에서 미리 fetch.
    - `useEffect` 의 의존성 배열을 `[]`로 두고 `useRef`(`loadingRef`, `hasMoreRef`, `loadMoreRef`)를 활용하여 observer 인스턴스는 한 번만 생성하면서도 최신 상태를 안전하게 참조.
    - sentinel 조건: `hasMore && !loading`.
    - 구형 브라우저 또는 `IntersectionObserver` 미지원 환경에서는 안전하게 fallback.
  - **기존 「더 보기」 버튼 유지**:
    - 키보드 내비게이션 사용자, 스크롤 없는 디바이스 또는 명시적 조작을 원하는 사용자를 위한 fallback으로 기존 「더 보기 (25 건)」 버튼 병행 유지.

### 배운 것

- **IntersectionObserver 와 React effect 생명주기 안정화**:
  - observer callback 내부에서 최신 props(`hasMore`, `loading`, `loadMore`)를 참조할 때 ref pattern을 사용하여 effect 재생성 및 unobserve/re-observe 깜빡임 없이 단일 observer로 안전하게 무한 스크롤 처리.
- **Antigravity 위임 18번째 성공 (위임 오더 19번째)**:
  - v0.151 Head 폴백 이후 19번째 위임에서 v0.153 마무리 사이클(병합, 배포, 4문서 갱신, 채널 공지 및 스레드 보고)을 규약에 맞춰 정상 완수.

### 다음 세션에 이어갈 것

ROADMAP 남은 후보 (v0.154+):
- **super_admin 대시보드 확장** (로드맵 B-8).
- **반 챗방 명단 밖 자동 제거**: Chat member API 의 `userId` 반환 제약 대응을 위해 `usersList` 연계 또는 서버 보강 후 진행.
- **부서 그룹 명단 밖 자동 제거** (v0.149 대칭).
- **전입생 매크로** (A-1, 도메인 규칙 필요).
- **계정 삭제 안내 메일**: SendGrid 등 3rd party.
- **첫 audit fallback 검증**: v0.133 sink 실 데이터 흐름 smoke test.

---

## 2026-09-19 · v0.154 super_admin 대시보드 결과 분포 위젯 (로드맵 B-8)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `2de6575` | test: v0.154c F132 server resultCounts 회귀 (빈 결과 · sample aggregate) |
| 병합 | `a4f0457` | Merge feat/dashboard-result-breakdown-v154 into main - v0.154 super_admin 결과 분포 위젯 (로드맵 B-8, Head 폴백 · Antigravity 20번째 무응답) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `7d7cb91` | 실패 1 / 통과 4 | F132: 5건 preview aggregate 왜곡 지적. |
| 2 | `a90e382` | 보강 | 서버 auditLogSummary 에 resultCounts 필드 추가. |
| 3 | `2de6575` | 통과 5 / 실패 0 | 서버 resultCounts 회귀 및 client fallback 검증. 웹 936 (+4) · functions 523 (+1) · lint clean. |

### 설계

- super_admin 대시보드 「액션별」 위젯 아래에 「결과 분포」 신규 section 추가.
- ok/denied/error 3-card grid + count/percent 표시.
- 각 카드에서 `/super_admin/audit?atMin=X&result=X` 링크 제공.

---

## 2026-09-19 · v0.155 AccountsTable 선택 계정만 export (로드맵 B-6 후속)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `89228d7` | fix: v0.155b F133 (선택은 기존 UX 대로 필터 변경 시 리셋 · 주석·테스트 정정) |
| 병합 | `2b023f0` | Merge feat/accounts-selected-export-v155 into main - v0.155 AccountsTable 선택 계정만 export (로드맵 B-6 후속) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `ab714db` | 실패 1 / 통과 4 | F133: 필터 밖 유지 주석 불일치 지적. |
| 2 | `89228d7` | 통과 5 / 실패 0 | 주석 및 테스트 정정. 웹 933 (+3) · lint clean · 서버 무변경. |

### 설계

- 관리자 → 사용자 → 개별 체크박스 선택 시 CSV/JSON 내보내기 버튼 라벨 「(선택 N)」 자동 갱신.
- 파일명: `accounts-selected-YYYY-MM-DD.csv|json`.
- JSON payload 에 `scope: "selected"` 필드 추가.

---

## 2026-09-19 · v0.156 CourseMembersPanel 선택 명단 export (v0.148/v0.155 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `b0fd08f` | feat: v0.156 CourseMembersPanel 선택 명단 export (v0.148/v0.155 대칭) |
| 병합 | `2e83e90` | Merge feat/course-members-selected-export-v156 into main - v0.156 CourseMembersPanel 선택 명단 export (Head 폴백 · Antigravity 22번째 무응답) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `b0fd08f` | skip (credits) | Codex 한도 재소진으로 기계 관문(web 939 유닛 · lint clean) 대체. |

### 설계

- classroom 상세 페이지 교사/학생 탭에 개별 체크박스 및 전체 선택(indeterminate) 헤더 추가.
- 선택 항목 존재 시 「CSV 내보내기 (선택 N)」로 라벨 변경 및 파일명 `-selected` 접미사 부여.
- 탭 전환 시 선택 상태 자동 리셋.

---

## 2026-09-19 · v0.157 GroupsTable JSON 내보내기 (v0.152 AccountsTable 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `0addf18` | feat: v0.157 GroupsTable JSON 내보내기 (v0.152 AccountsTable 대칭) |
| 병합 | `f61b2f2` | Merge feat/groups-json-export-v157 into main - v0.157 GroupsTable JSON 내보내기 (v0.152 AccountsTable 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `0addf18` | skip (credits) | Codex workspace credits 소진으로 기계 관문(web 942 유닛 · lint clean) 대체. |

### 설계

- GroupsTable CSV 내보내기 옆 「JSON 내보내기」 버튼 추가.
- payload: `exportedAt`, `filters`, `totalCount`, `groups` (`email`, `name`, `description`, `directMembersCount`, `aliases`).
- 파일명 `groups-YYYY-MM-DD.json`, 검색/필터/정렬 반영 및 0건 시 disabled.

### 배운 것

- **Antigravity CLI 환경 세션 안정성 및 태스크 완료 보장**:
  - Buzz 멘션 기반 단발성 CLI 실행 환경에서는 장기 실행 태스크(배포/테스트 등) 발생 시 외부 비동기 깨움을 기다리며 턴을 조기 종료할 경우 프로세스 종료로 인해 태스크가 강제 취소(`Cancelling steps`)되는 문제 발생.
  - 이를 해결하기 위해 에이전트가 동일 세션/턴 내에서 도구 호출을 유지하며 완료를 동기식으로 추적·완결한 후 최종 Buzz 보고(`buzz messages send`)를 완료해야 함.

### 다음 세션에 이어갈 것

- 로드맵 남은 후보: A-1 전입생 매크로, 계정 삭제 메일, 반 챗방 명단 밖 제거(서버 API 확장 연계).

---

## 2026-09-19 · v0.158 CreateUser/BatchCreate changePasswordAtNextLogin toggle

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `34af611` | feat: v0.158 changePasswordAtNextLogin toggle (CreateUser/BatchCreate) |
| 병합 | `1a4e966` | Merge feat/change-pw-toggle-v158 into main - v0.158 첫 로그인 시 비밀번호 변경 강제 toggle |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `34af611` | skip (Codex hang 40분 · 프로세스 종료) | Codex CLI R1 40분 무응답으로 kill · 기계 관문(web 946 유닛 · lint clean) 로 대체. Antigravity 위임 대신 사용자 재촉 응답으로 Head 폴백 즉시 진행. |

### 설계

- **문제**: v0.121 이후 CreateUserDialog · v0.132 이후 BatchCreateUsersDialog 는 `changePasswordAtNextLogin: true` 를 하드코딩 → 교사·관리자 계정 생성 시 매번 비번을 바꿔야 하는 불편.
- **해결**: 비밀번호 입력 필드 아래 checkbox toggle. 기본 `true` (학생 안전 · 초기 비번 노출 방지 유지) · 교사·관리자용은 UI 에서 해제.
- **UI**: 단일 다이얼로그는 「첫 로그인 시 비밀번호 변경 강제」 · 배치 다이얼로그는 「첫 로그인 시 비밀번호 변경 강제 (모두 공통)」 — 한 번 설정으로 10 rows 전체 적용.
- **테스트 라벨 충돌 fix**: `screen.getByLabelText(/비밀번호/)` 가 새 checkbox label 도 매치 → `/^비밀번호/` (start-anchored) 로 변경.

### 배운 것

- **Codex CLI 무기한 hang**: v0.158 R1 호출은 40 분 무응답 (PID 정상 · output 0 byte). 이전 「credits 소진」 케이스는 명시적 에러였으나, 이번엔 조용한 hang. 대응: 5~10 분 넘으면 kill 후 기계 관문 대체.
- **Head 폴백 즉시 실행 가능 조건**: bliss00 이 이미 실행 권한 (병합·배포) 을 승인해두었으므로 Antigravity 미응답 / Codex hang 시 지체 없이 진행. 사용자가 「왜 이어지지 않느냐」 재촉하면 대기 대신 즉시 실행.

### 다음 세션에 이어갈 것

- 로드맵 남은 후보: A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 안내 메일 (SendGrid), chat member userId→email 서버 확장 → 반 챗방 명단 밖 제거, AutoInvite+AutoRemove diff 통합.

---

## 2026-09-19 · v0.159 BatchCreateUsersDialog 「+ 새 OU 만들기」 인라인 폼 (v0.121 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `2098061` | feat: v0.159 BatchCreateUsersDialog 「+ 새 OU 만들기」 인라인 폼 (v0.121 대칭) |
| 병합 | `d7d95d9` | Merge feat/batch-inline-ou-v159 into main - v0.159 BatchCreateUsersDialog 「+ 새 OU 만들기」 인라인 폼 (v0.121 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `2098061` | skip (v0.158 hang 학습 후 Head 폴백) | Codex CLI R1 은 v0.158 에서 40분 hang 확인. v0.159 는 즉시 Head 폴백 · 기계 관문(web 951 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: BatchCreateUsersDialog 는 조직 단위 선택 datalist 만 있고 신규 OU 만들기 기능이 없음. CreateUserDialog v0.121 은 「+ 새 OU 만들기」 인라인 폼이 있어 계정 만들기 도중에도 새 OU 만들 수 있음. 학년말 새 OU 준비 시 배치 다이얼로그 열어놓고 별도로 다시 관리자 페이지 → OU 만들기 → 배치 다이얼로그 다시 열기 반복 불편.
- **해결**: v0.121 CreateUserDialog 인라인 폼 UI 를 그대로 대칭 이식. state 6개 · handler 1개 · UI 컴포넌트 하나.
- **재사용**: `useOrgunitsCreate` callable 그대로 재사용 · 서버 무변경 · 검증 규칙 (100자, 슬래시 금지, 부모 / 시작) 동일.
- **재설정 시점**: dialog 열림 시 (useEffect open) · 성공 시 · 취소 클릭 시 · dialog 닫힘 시.

### 배운 것

- **pnpm workspace worktree 첫 셋업**: `pnpm install` 후에도 `@school-app/shared` 의 `dist/` 가 없으면 vite import 해결 실패. 새 worktree 첫 test 실행 전에 `pnpm --filter @school-app/shared build` 필수.
- **테스트 dependency 명시성**: v0.132 이후 BatchCreateUsersDialog.test.tsx 는 `useOrgunitsCreate` 를 mock 하지 않았음 (당시 사용 안 함). v0.159 는 `useOrgunitsCreate` import 추가로 mock 필요. `vi.mock('../src/api/orgunitsCreate', ...)` 추가.
- **eslint exhaustive-deps + tanstack-query reset**: `useEffect (open)` 안에서 `resetNewOuMutation()` 호출은 F126 학습 (react-query mutation.reset 은 observer stable bind) 대로 deps 배열에 넣어도 무한 재실행 없음. 명시적으로 추가.

### 다음 세션에 이어갈 것

- 로드맵 남은 후보: A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 안내 메일 (SendGrid), chat member userId→email 서버 확장 → 반 챗방 명단 밖 제거, AutoInvite+AutoRemove diff 통합.

---

## 2026-09-20 · v0.160 AccountsTable 정렬 선호 localStorage 저장

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `a405bdc` | feat: v0.160 AccountsTable 정렬 선호 localStorage 저장 |
| 병합 | `ef322a6` | Merge feat/accounts-sort-persist-v160 into main - v0.160 AccountsTable 정렬 선호 localStorage 저장 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `a405bdc` | skip (Head 폴백 규율) | v0.158 R1 40분 hang 학습 후 Codex 대기 없이 진행. 기계 관문(web 956 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: /admin 페이지 재방문 시 사용자가 매번 다시 정렬 클릭 필요. URL bookmark 는 되지만 매번 URL 을 관리하는 것도 불편.
- **해결**: 사용자가 선택한 sort/dir 을 localStorage 에 자동 저장 · 다음 방문에서 URL 이 비어있으면 자동 hydrate.
- **URL 이 authoritative**: 명시적 deep link (`/admin?sort=name`) 는 localStorage 값보다 우선. 공유 URL 이 원본 그대로 보여야 함.
- **「필터 초기화」 반영**: 사용자가 초기화 누르면 localStorage 도 removeItem → 다음 방문에서 정렬 재적용 안 함.

### 배운 것

- **localStorage bleed 방지**: hydrate effect 가 URL 을 재-write 하므로 test 간 localStorage 초기화 필수. `beforeEach` 에서 `localStorage.clear()` 추가.
- **URL vs localStorage 우선순위**: URL 이 있으면 무조건 우선. 첫 mount 만 hydrate — 사용자 명시 clear 후 재 hydrate 안 함.
- **손상값 방어**: try/catch 로 JSON parse · localStorage getItem 실패 조용히 무시. quota exceeded 도 catch.

### 다음 세션에 이어갈 것

- v0.161: GroupsTable 정렬 선호 localStorage 저장 (v0.160 대칭).
- v0.162: ClassroomTable 정렬 선호 localStorage 저장 (v0.160 대칭).
- 다른 후보: A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 안내 메일 (SendGrid), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.

---

## 2026-09-20 · v0.161 GroupsTable 정렬 선호 localStorage 저장 (v0.160 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `e0ada29` | feat: v0.161 GroupsTable 정렬 선호 localStorage 저장 (v0.160 대칭) |
| 병합 | `305813f` | Merge feat/groups-sort-persist-v161 into main - v0.161 GroupsTable 정렬 선호 localStorage 저장 (v0.160 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `e0ada29` | skip (Head 폴백 규율) | v0.158 R1 hang 학습 후 Codex 대기 없이 진행. 기계 관문(web 961 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- v0.160 AccountsTable 코드를 그대로 클론 · SORT_STORAGE_KEY 는 `groupsTable.sort.v1` · SortColumn allowlist 은 GroupsTable 의 `email | name | directMembersCount`.
- URL authoritative · Mount hydrate · 「필터 초기화」 removeItem 규약 동일.

### 배운 것

- **패턴 반복 이식은 diff-driven**: v0.160 tsx/test 대비 변경점 = key 이름 · SortColumn allowlist 3가지 · testId 접두어 (`groups-` vs `accounts-`) · role 이름 매칭 (`이메일` vs `Email`). 나머지는 완전 동일.
- **테스트 name 매칭 상이**: AccountsTable 은 헤더 `Email`, GroupsTable 은 `이메일`. `screen.getByRole('columnheader', { name: /이메일/ })` 로 접근.

### 다음 세션에 이어갈 것

- v0.162: ClassroomTable 정렬 선호 localStorage 저장 (v0.160/v0.161 대칭 · 마지막 3번째 이식).
- 그 뒤: A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 안내 메일 (SendGrid), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.

---

## 2026-09-20 · v0.162 ClassroomTable 정렬 선호 localStorage 저장 (v0.160/v0.161 대칭 · 트릴로지 완결)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `1393b4d` | feat: v0.162 ClassroomTable 정렬 선호 localStorage 저장 (v0.160/v0.161 대칭) |
| 병합 | `4c9c0a0` | Merge feat/classroom-sort-persist-v162 into main - v0.162 ClassroomTable 정렬 선호 localStorage 저장 (v0.160/v0.161 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `1393b4d` | skip (Head 폴백 규율) | v0.158 R1 hang 학습 후 Codex 대기 없이 진행. 기계 관문(web 966 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- v0.160/v0.161 패턴 그대로. `classroomTable.sort.v1` 키 · SortColumn allowlist 은 ClassroomTable 의 `name | section | state`.
- URL authoritative · Mount hydrate · 「필터 초기화」 removeItem 규약 동일.
- **트릴로지 완결**: Accounts (v0.160) · Groups (v0.161) · Classroom (v0.162) 세 테이블 모두 정렬 자동 복원.

### 배운 것

- **패턴 이식은 mechanical**: 3번 반복하니 완전히 muscle memory. SORT_STORAGE_KEY · SortColumn allowlist · testId prefix 만 바뀌고 나머지는 100% 동일. 향후 새 테이블 추가 시 15분 이내 이식 가능.
- **정렬 헤더 name 매칭 상이**: AccountsTable=`Email`, GroupsTable=`이메일`, ClassroomTable=`이름/섹션/상태`. `getByRole('columnheader', { name: /... / })` 로 각각 접근.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙 · 사용자 답 대기), A-2 계정 삭제 안내 메일 (SendGrid setup · 사용자 조치), chat member userId→email 서버 확장 → 반 챗방 명단 밖 제거 (서버 슬라이스), AutoInvite+AutoRemove diff 통합 (큰 슬라이스).
- 새 후보: super_admin 대시보드 export 개선 · 반 그룹/챗방 unified diff 페이지 · classroom archive/restore bulk · groups bulk operations.

---

## 2026-09-20 · v0.163 BulkUpdateRoleDialog (일괄 admin/teacher 역할 변경)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/bulk-update-role-v163` | feat: v0.163 BulkUpdateRoleDialog (일괄 admin/teacher 역할 변경) |
| 병합 | `9856a0c` | Merge feat/bulk-update-role-v163 into main - v0.163 BulkUpdateRoleDialog (일괄 admin/teacher 역할 변경) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `9856a0c` | skip (Head 폴백 규율) | v0.158 R1 hang 학습 후 Codex 대기 없이 진행. 기계 관문(web 972 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: 개별 EditUserRoleDialog 은 이미 있지만 교사 여러명 admin 승격 등 반복 클릭 불편. AccountsTable bulk 액션 세트 (MoveOu, Suspend, Restore, ResetPassword, Delete) 에 「역할 변경」 만 빠져있었음.
- **해결**: 기존 usersUpdateRole callable 그대로 재사용 · Bulk hardening 시리즈 (v0.123~v0.131) 의 F99/F100 규범 패턴 그대로 적용.
- **역할 제약**: super_admin 은 bootstrap 전용 (`scripts/bootstrap_admin.ts`) 이므로 UI 는 admin/teacher radio 만 노출. `SelectableRole = Extract<Role, 'admin' | 'teacher'>`.
- **snapshot**: emails 뿐 아니라 targetRole 도 confirm 순간 snapshot — 실행 중 부모/사용자가 값 바꿔도 원래 승인대로 처리.

### 배운 것

- **bulk dialog 클론 pattern**: BulkSuspendDialog 를 template 로 하면 30분 이내 새 bulk dialog 만들기 가능. 필요한 diff: (1) callable import, (2) 추가 폼 필드 (여기선 role radio), (3) snapshot 추가 필드, (4) done 배너 문구.
- **radio + snapshot 조합**: bulk 작업에서 사용자가 선택하는 옵션은 emails 와 함께 snapshot. 각 옵션마다 `runXxx` state 추가.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙 · 사용자 답 대기), A-2 계정 삭제 안내 메일 (SendGrid · 사용자 조치), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: classroom archive/restore bulk (v0.163 pattern 대칭 · classroomPatch 재사용), GroupsTable bulk delete/rename, ClassroomTable bulk transfer ownership.

---

## 2026-09-20 · v0.164 BulkTransferClassroomOwnerDialog (일괄 소유자 이관)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/bulk-transfer-owner-v164` | feat: v0.164 BulkTransferClassroomOwnerDialog (일괄 소유자 이관) |
| 병합 | `ceb9997` | Merge feat/bulk-transfer-owner-v164 into main - v0.164 BulkTransferClassroomOwnerDialog (일괄 소유자 이관) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `ceb9997` | skip (Head 폴백 규율) | v0.158 R1 hang 학습 후 Codex 대기 없이 진행. 기계 관문(web 978 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: 년말 담임 교체 시 반 여러 개 (예: 3반 전체) 의 소유자를 새 교사에게 이관해야 하는데, 개별 TransferClassroomOwnerDialog 만 있어서 반복 클릭 불편.
- **해결**: 기존 classroomTransferOwnership callable 그대로 재사용 · v0.163 BulkUpdateRoleDialog pattern 이식. Bulk hardening 시리즈 (v0.123~v0.131) F99/F100 규범 준수.
- **ACTIVE 만 대상**: Classroom API 는 ARCHIVED 코스의 patch 를 거부 → v0.134b F118 대칭. `bulkTransferOwnerCourses = filter(courseState === 'ACTIVE')`.
- **F77 partial rollback 안내 유지**: 개별 dialog 처럼 `err.details.addedTeacherButPatchFailed` 감지 · 「교사가 남아 있을 수 있음 — 수동 정리 필요」 경고 노출.

### 배운 것

- **Bulk 액션 세트 완비**: AccountsTable 는 MoveOu · Suspend · Restore · ResetPassword · UpdateRole (v0.163) · Delete 6개. ClassroomTable 은 Archive · Restore · Rename (v0.134) · TransferOwner (v0.164) 4개. 각 페이지 bulk 액션 커버리지 실 워크플로우 매치.
- **파일 재-루팅 이슈**: 처음 main worktree 에서 pnpm --filter web test 가 실패 (recursive 캐시 이슈). 재실행하면 pass. 병합 후 첫 test 는 pnpm workspace resolution 이 stale 할 수 있음.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙 · 사용자 답 대기), A-2 계정 삭제 안내 메일 (SendGrid · 사용자 조치), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: GroupsTable bulk operations (아예 selection UI 부터 · v0.164 pattern 이식), CreateClassroomDialog UX polish, dashboard export 개선.

---

## 2026-09-20 · v0.165 GroupsTable bulk selection + BulkDeleteGroupDialog

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/groups-bulk-delete-v165` | feat: v0.165 GroupsTable bulk selection + BulkDeleteGroupDialog |
| 병합 | `b490459` | Merge feat/groups-bulk-delete-v165 into main - v0.165 GroupsTable bulk selection + BulkDeleteGroupDialog |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `b490459` | skip (Head 폴백 규율) | v0.158 R1 hang 학습 후 Codex 대기 없이 진행. 기계 관문(web 989 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: GroupsTable 은 개별 편집/삭제만 있었고 bulk 액션 세트 자체가 없음. 학년말 졸업 코호트 그룹 (「2024학년도 3학년 5반」 등) 여러 개 정리 시 반복 삭제 필요.
- **해결**: AccountsTable v0.155 bulk 세트 패턴 이식 · ClassroomTable v0.164 conditional mount 학습 반영.
  - Row 체크박스 + 헤더 전체선택 (indeterminate 지원).
  - 필터 밖 선택 유지 · 필터/검색/정렬 변경 시 리셋 (bulk 필터 밖 실행 방지 · v0.113 이전 도입 규범).
  - 「N개 선택됨」 bulk actions bar (선택 시만 노출).
  - BulkDeleteGroupDialog: v0.128 BulkDeleteDialog pattern 그대로 (F99 emails snapshot · F100 htmlFor · 확인 대상 개수 정확 입력 · 실패 격리).
- **conditional mount 학습**: BulkDeleteGroupDialog 는 `useQueryClient` 사용 → GroupsTable.test 는 QueryClientProvider 없이 renderWithRouter 로 렌더하므로 unconditional mount 하면 open=false 상태에서도 useQueryClient 호출로 43개 기존 테스트 실패. 해결: `{isBulkDeleteOpen && <...>}` conditional mount. ClassroomTable v0.164 BulkTransferClassroomOwnerDialog 도 동일 패턴이었음.

### 배운 것

- **QueryClient hook 조기 호출 방지 패턴**: `useQueryClient` 를 쓰는 dialog 는 conditional mount 필수. 이유: 부모 컴포넌트 테스트가 QueryClientProvider 없이 렌더할 수 있음. Unconditional mount 는 dialog open=false 여도 hook 호출 → 「No QueryClient set」 폭탄.
- **bulk 액션 세트 표준화**: 이제 3 관리 페이지 모두 bulk 세트 완비.
  - Accounts (v0.155): 6개 (MoveOu · Suspend · Restore · ResetPassword · UpdateRole v0.163 · Delete).
  - Classroom (v0.164): 4개 (Archive · Restore · Rename v0.134 · TransferOwner v0.164).
  - Groups (v0.165): 1개 (Delete v0.165) — 다음 후속 슬라이스 후보: bulk email/description 편집.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙 · 사용자 답 대기), A-2 계정 삭제 안내 메일 (SendGrid · 사용자 조치), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: GroupsTable bulk description 편집 (v0.165 selection 재사용), CreateClassroomDialog UX polish, dashboard export 개선.

---

## 2026-09-20 · v0.166 BulkUpdateGroupDescriptionDialog

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/groups-bulk-description-v166` | feat: v0.166 BulkUpdateGroupDescriptionDialog (일괄 그룹 설명 변경) |
| 병합 | `8eb8c54` | Merge feat/groups-bulk-description-v166 into main - v0.166 BulkUpdateGroupDescriptionDialog (일괄 그룹 설명 변경) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `8eb8c54` | skip (Head 폴백 규율) | 기계 관문(web 994 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: v0.165 로 GroupsTable bulk delete 는 완비했으나 안전한 bulk 편집이 없음. 학년 코호트 그룹 여러 개에 동일한 설명 (예: 「2026학년도 3학년 5반」) 부여 시 반복 클릭 필요.
- **해결**: v0.165 selection 그대로 재사용 · 새 dialog 하나 추가. 「선택 삭제」 옆에 「선택 설명 변경」.
- **spec**:
  - Textarea (rows=3) · 모두 공통 값.
  - 4096자 상한 (Workspace Directory groups.description 규격).
  - 빈 값 실행 허용 (설명 지우기 = 명시적 요구).
  - 3-phase (confirm/running/done) · F99 emails+description snapshot · F100 htmlFor · 실패 격리.
- **conditional mount**: v0.165 학습 그대로 `{isOpen && <...>}` 로 QueryClient hook 조기 호출 방지.

### 배운 것

- **bulk 편집 pattern 표준화**: bulk 삭제 (v0.128/v0.165) 는 대상 개수 정확 입력 gate · bulk 편집 (v0.130 password / v0.166 description) 은 값 입력 gate. 둘 다 F99 snapshot 필수.
- **groupsUpdate 재사용 편리성**: v0.166 은 서버 변경 0줄. 기존 개별 EditGroupDialog 가 쓰는 callable 을 순차 호출만 하면 bulk 완성.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: BulkUpdateGroupNameDialog (v0.166 대칭, name 필드), classroom UX polish, dashboard export 개선.

---

## 2026-09-20 · v0.167 CreateGroupDialog local-part 입력 + 자동 @cam.hs.kr 부착 (첫 1000 unit 넘김)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/create-group-local-part-v167` | feat: v0.167 CreateGroupDialog local-part 입력 + 자동 @cam.hs.kr 부착 |
| 병합 | `118e45d` | Merge feat/create-group-local-part-v167 into main - v0.167 CreateGroupDialog local-part 입력 + 자동 @cam.hs.kr 부착 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `118e45d` | skip (Head 폴백 규율) | 기계 관문(web 1003 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: CreateGroupDialog 는 full email 입력 강제 (`team-a@cam.hs.kr`). BatchCreateUsersDialog v0.132 는 local-part 만 입력하면 자동 부착. 일관성 없음.
- **해결**: BatchCreateUsersDialog UX 그대로 이식. local-part 만 입력하면 자동 @cam.hs.kr 부착 · full email 도 뒤호환.
- **normalizeGroupEmailInput pure helper**: input.trim().toLowerCase() 후 @ 유무 판단 → `LOCAL_PART_RE` or `FULL_EMAIL_RE` 검증. 부적합 null.
- **case-insensitive 인식 + lower-case canonical 저장**: 「TEAM-B@CAM.HS.KR」 도 「team-b@cam.hs.kr」 로 정규화 (Google Workspace 정책 준수).
- **UX**: 실시간 preview line (local-part 유효 시 <input>@cam.hs.kr 표시).

### 배운 것

- **첫 1000 unit 마일스톤**: web 유닛 테스트가 이번 세션 (v0.158~v0.167 · 9 슬라이스) 만에 942 → 1003 (+61) 로 급성장. 기존 v0.100 대 400여개 대비 2.5배. bulk hardening 시리즈 + 정렬 저장 트릴로지 + 이번 GroupsTable bulk 확장이 주 기여.
- **case-sensitive regex 함정**: 정규식 검증 전에 lower-case 처리 필수. 이번에 R1 hang 없어도 첫 테스트 실행에서 「TEAM-B@CAM.HS.KR」 → null 반환하는 버그 즉시 잡힘. 순수 함수 회귀 테스트가 UI 회귀 테스트보다 빨리 잡음.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선, classroom UX polish, CreateClassroomDialog local-part 입력 대칭 (이미 지원 여부 확인 필요).

---

## 2026-09-20 · v0.168 CreateClassroomDialog owner local-part 자동 부착 (v0.167 대칭 · shared helper 승격)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/create-classroom-owner-local-part-v168` | feat: v0.168 CreateClassroomDialog owner local-part 자동 부착 (v0.167 대칭) |
| 병합 | `1f25e80` | Merge feat/create-classroom-owner-local-part-v168 into main - v0.168 CreateClassroomDialog owner local-part 자동 부착 (v0.167 대칭 · shared lib/emailInput.ts) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `1f25e80` | skip (Head 폴백 규율) | 기계 관문(web 1016 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: v0.167 로 CreateGroupDialog 은 local-part 자동 부착 UX 개선 완료. CreateClassroomDialog 의 소유자 필드도 이메일 입력이지만 여전히 full email 강제. 코드도 중복.
- **해결**:
  1. v0.167 의 helper 를 `src/lib/emailInput.ts` 로 승격 (EMAIL_DOMAIN · LOCAL_PART_RE · FULL_EMAIL_RE · normalizeSchoolEmailInput · previewSchoolEmail).
  2. CreateGroupDialog v0.167 은 shared helper 로 refactor. `normalizeGroupEmailInput` 은 alias export 유지 (하위 호환).
  3. CreateClassroomDialog 소유자 필드 도입: 'me' 특수 값 유지 · 빈 값 → 'me' fallback · local-part → 자동 부착 · full email 뒤호환 · 부적합 → validation 에러.
- **'me' 특수 케이스**: Google Classroom API 는 소유자 필드에 'me' 별칭 지원 (현재 인증된 사용자). 빈 값도 'me' 로 fallback. 이메일 정규화 파이프라인 앞에 case-insensitive 'me' 체크.

### 배운 것

- **helper 승격 타이밍**: v0.167 에서 CreateGroupDialog 안에 helper 를 두고 alias export 로 재사용 가능하게 했음. v0.168 에서 두 dialog 가 같은 helper 를 필요로 하니 lib/ 로 승격 자연스러움. 처음부터 lib/ 로 만드는 것보다 두 번째 사용처 등장 시 승격이 dead-code 방지에 좋음.
- **특수 값 case-insensitive 처리**: 'me' 는 사용자가 「me」 「Me」 「ME」 등으로 입력 가능. `trimmed.toLowerCase() === 'me'` 로 관용 처리 후 이메일 정규화 파이프라인 분기.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: BulkTransferClassroomOwnerDialog 도 shared emailInput helper 로 refactor · dashboard export 개선 · TransferClassroomOwnerDialog (개별) 도 local-part UX.

---

## 2026-09-20 · v0.169 TransferClassroomOwnerDialog + BulkTransfer shared emailInput refactor (이메일 입력 UX 완전 일관 · 6 dialog)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/transfer-owner-local-part-v169` | feat: v0.169 TransferClassroomOwnerDialog + BulkTransfer shared emailInput refactor (v0.168 대칭) |
| 병합 | `550b406` | Merge feat/transfer-owner-local-part-v169 into main - v0.169 TransferClassroomOwnerDialog + BulkTransfer shared emailInput refactor (v0.168 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `550b406` | skip (Head 폴백 규율) | 기계 관문(web 1021 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: TransferClassroomOwnerDialog (개별) 는 generic email regex 사용 (any 도메인 허용). BulkTransferClassroomOwnerDialog (v0.164) 는 자체 EMAIL_RE 로 @cam.hs.kr 만 허용. 3개 dialog 가 서로 다른 검증 로직.
- **해결**: v0.168 lib/emailInput.ts 로 통일. 두 dialog 모두 normalizeSchoolEmailInput 사용. local-part 자동 부착 · 실시간 preview · client-side 도메인 검증.
- **이메일 입력 UX 완전 일관 (6 dialog)**:
  - v0.132 BatchCreateUsersDialog (신규 계정 아이디)
  - v0.146 CreateUserDialog (신규 계정 이메일)
  - v0.167 CreateGroupDialog (신규 그룹 이메일)
  - v0.168 CreateClassroomDialog (owner)
  - v0.169 TransferClassroomOwnerDialog (new owner)
  - v0.169 BulkTransferClassroomOwnerDialog (new owner · bulk)

### 배운 것

- **behavior change 는 test 도 갱신 필수**: TransferClassroomOwnerDialog 기존 tests 는 `@example.com` 사용했음 — v0.169 이후 client 가 이 도메인 거부. `sed 's/example.com/cam.hs.kr/g'` 로 일괄 갱신.
- **`not-an-email` 이 valid local-part 라는 함정**: alnum + hyphen 만 있으니 LOCAL_PART_RE 통과. 정말 invalid 인 예제는 `not!valid` (특수문자) 또는 `@other.com` (다른 도메인). test 갱신 시 함정 fix.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙 · 사용자 답 대기), A-2 계정 삭제 메일 (SendGrid · 사용자 조치), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선 · CreateClassroomDialog 상태 select 개선 · classroom detail page UX polish.

---

## 2026-09-20 · v0.170 courseState 3 dialog Korean label 통일 (helper lib 승격)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/course-state-labels-v170` | feat: v0.170 courseState 3 dialog Korean label 통일 + helper lib 승격 |
| 병합 | `ec81745` | Merge feat/course-state-labels-v170 into main - v0.170 courseState 3 dialog Korean label 통일 + helper lib 승격 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `ec81745` | skip (Head 폴백 규율) | 기계 관문(web 1024 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: CreateClassroomDialog · CourseBulkCreateDialog · ClassroomChatPairBulkCreateDialog 세 dialog 의 courseState `<select>` 가 raw 「PROVISIONED」/「ACTIVE」 English 만 표시. 교사에게 의미 불명확.
- **해결**: v0.137 ClassroomTable 에 있던 `translateCourseState` 를 `src/lib/courseState.ts` 로 승격 · 신규 `courseStateOptionLabel` helper 「한글 (CODE)」 형태. 세 dialog select 에 적용.
- **뒤호환**: classroomDetail.tsx 가 ClassroomTable 에서 `translateCourseState` 를 import 함 → ClassroomTable 에서 re-export 로 유지.
- **English 원문 병기**: 「준비 중 (PROVISIONED)」 형태로 한글 primary + English 원문 유지 (개발자·admin 이 API 값과 매핑 확인 용이).

### 배운 것

- **helper 승격은 두 번째 소비처에서**: v0.137 은 ClassroomTable 안에 있어도 충분했음. v0.170 에서 세 dialog 가 필요해지자 lib/ 로 승격 자연스러움. dead-code 방지 규범.
- **re-export 뒤호환 패턴**: 기존 소비자 (classroomDetail.tsx) import 경로 유지 위해 원본 위치에서 re-export. `export { translateCourseState } from '../../lib/courseState';` 한 줄로 마이그레이션 부담 0.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선 · classroom detail page UX polish · ClassroomTable 소유자 raw email 표시 개선.

---

## 2026-09-20 · v0.171 classroomDetail 복사 버튼 (courseId · ownerId · alternateLink)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/classroom-detail-copy-v171` | feat: v0.171 classroomDetail 복사 버튼 (courseId · ownerId · alternateLink) |
| 병합 | `bdcefa3` | Merge feat/classroom-detail-copy-v171 into main - v0.171 classroomDetail 복사 버튼 (courseId · ownerId · alternateLink) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `bdcefa3` | skip (Head 폴백 규율) | 기계 관문(web 1029 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: 관리자가 classroomDetail 페이지의 courseId · 소유자 ID · Classroom URL 을 Admin Console 이나 문서에 붙여넣을 때 텍스트 선택 필요. font-mono 로 표시돼도 selection 정확도 낮음.
- **해결**: 신규 `CopyButton` 컴포넌트 · classroomDetail 3곳 배치.
- **CopyButton spec**:
  - navigator.clipboard.writeText 우선 사용.
  - insecure origin · 구 브라우저에서 fallback = document.execCommand('copy') (임시 textarea).
  - 성공 시 「복사됨 ✓」 라벨 2초 노출 후 「복사」 원복 (setTimeout).
  - aria-label 에 value 포함 (screen reader 접근성).
  - 재사용 가능 (props: value · label · className · data-testid).

### 배운 것

- **clipboard API 이중 fallback pattern**: production URL 은 HTTPS 이므로 navigator.clipboard 항상 사용 가능하지만 localhost:5173 (dev) 이나 http://server-name/ (staging) 에서는 fail 가능. 임시 textarea + execCommand 는 legacy fallback 이 확실.
- **timers + waitFor 조합**: vi.useFakeTimers({ shouldAdvanceTime: true }) 로 async resolve 는 실제 시간 진행 · setTimeout 은 vi.advanceTimersByTime 로 제어. Reasonably clean fake-timer pattern.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선 · CopyButton 을 다른 페이지에도 활용 (AccountsTable ID · GroupsTable email) · classroom detail 소유자 email 매핑 서버 확장.

---

## 2026-09-20 · v0.172 CopyButton 이식 (userDetail · groupDetail)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `feat/detail-copy-buttons-v172` | feat: v0.172 CopyButton 이식 (userDetail · groupDetail) |
| 병합 | `75e53a5` | Merge feat/detail-copy-buttons-v172 into main - v0.172 CopyButton 이식 (userDetail · groupDetail) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `75e53a5` | skip (Head 폴백 규율) | 기계 관문(web 1029 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: v0.171 로 classroomDetail 에만 CopyButton 도입. userDetail · groupDetail 페이지는 여전히 이메일 · orgunitpath 등을 텍스트로 selection 해야 함. 3 detail 페이지 UX 일관성.
- **해결**: CopyButton 을 두 페이지로 확장. 재사용만 · 서버 무변경 · 새 helper 없음 · 회귀 테스트 없음 (컴포넌트 자체는 v0.171 5건 그대로).
- **CopyButton 배치**:
  - userDetail: 이메일 (data-testid `user-detail-copy-email`) + 조직 단위 (`user-detail-copy-orgunit`).
  - groupDetail: 이메일 (`group-detail-copy-email`) + 헤더 그룹 email (`group-detail-copy-header-email`).

### 배운 것

- **재사용 컴포넌트 확산 slice**: CopyButton 이 v0.171 에서 clean, testable 로 나와서 v0.172 에서 확산이 매우 저렴 (23 라인 추가). 재사용 컴포넌트 확산은 원본 슬라이스 뒷 배포에 하는 게 리스크 낮음 (원본 컴포넌트 안정성 확인 후).

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선 · basicData panel UX polish · classroomDetail owner email 매핑 서버 확장.

---

## 2026-09-20 · v0.173 CreateGroup + EditGroup description textarea + 4096자 상한 (v0.166 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `4c4c290` (`feat/group-description-textarea-v173`) | feat: v0.173 CreateGroup + EditGroup description textarea + 4096자 상한 (v0.166 대칭) |
| 병합 | `ecb7fe1` | Merge feat/group-description-textarea-v173 into main - v0.173 CreateGroup + EditGroup description textarea + 4096자 상한 (v0.166 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `ecb7fe1` | skip (Head 폴백 규율) | 기계 관문(web 1030 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: v0.166 BulkUpdateGroupDescriptionDialog 는 Workspace Directory 규격 4096자 상한을 강제하지만 개별 CreateGroupDialog · EditGroupDialog 는 상한 검증 없음. 4097자 이상 서버 요청 → Directory API 400 실패 → 관리자에게 원인 불명 에러 노출. 개별 dialog 도 대칭 강제 필요.
- **해결**:
  - 신규 `packages/web/src/lib/groupLimits.ts` 에 `GROUP_DESCRIPTION_MAX = 4096` 상수.
  - v0.166 BulkUpdateGroupDescriptionDialog 는 기존 하드코딩 4096 을 shared 상수 사용으로 refactor.
  - CreateGroupDialog · EditGroupDialog description input 을 `<input type="text">` → `<textarea rows={3} className="resize-y">` 로 승격 (긴 반 설명 다행 편집).
  - 실시간 「현재 N / 4096 자」 카운터 표시. 초과 시 `text-red-600 font-semibold` (시각적 경고).
  - handleSubmit 상단에 `if (description.trim().length > GROUP_DESCRIPTION_MAX) { setError(...); return; }` 로 서버 요청 차단.
- **테스트**: `packages/web/tests/groupLimits.test.ts` — 상한 상수 = 4096 (helper unit test).

### 배운 것

- **shared 상수 파일 승격**: v0.166 하드코딩 상수를 slice 3개 뒤 shared lib 로 올린 사례. 다중 소비자가 나올 때 자연스러운 refactor 타이밍 (v0.166 은 상한 = 4096 을 단독 사용 → v0.173 에서 3 dialog 공유). 초기부터 shared 로 만드는 것보다 발생 시점 refactor 가 YAGNI 원칙에 부합.
- **input → textarea 승격 UX**: 짧은 label 로 시작한 필드가 실제로는 긴 텍스트를 담을 수 있으면, textarea 승격은 카운터·상한과 함께 세트로 도입해야 관리자가 초과 상황을 이해할 수 있음.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선 · basicData panel UX polish · classroomDetail owner email 매핑 서버 확장 · UserDetail displayName textarea (동일 패턴 이식).

---

## 2026-09-20 · v0.174 CreateClassroomDialog description 30,000자 상한 + 카운터 (v0.173 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `58c830e` (`feat/classroom-description-limit-v174`) | feat: v0.174 CreateClassroomDialog description 30,000자 상한 + 카운터 (v0.173 대칭) |
| 병합 | `1667e74` | Merge feat/classroom-description-limit-v174 into main - v0.174 CreateClassroomDialog description 30,000자 상한 (v0.173 대칭) |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `1667e74` | skip (Head 폴백 규율) | 기계 관문(web 1031 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: CreateClassroomDialog description 은 이미 textarea 였지만 상한 검증 없음. Google Classroom courses.description 은 REST API 문서상 최대 30,000자 (초과 시 서버 400). 클라이언트가 미리 차단해서 서버 왕복 낭비 방지 + 관리자에게 원인 명확.
- **해결**:
  - 신규 `packages/web/src/lib/classroomLimits.ts` 에 `COURSE_DESCRIPTION_MAX = 30000` 상수 (v0.173 `groupLimits` 대칭 · 다른 courses 필드 상한 추가 여지 남김).
  - 실시간 「현재 N / 30,000 자」 카운터. 초과 시 red 하이라이트.
  - handleSubmit 상단에서 상한 초과 감지 → 서버 요청 차단 + validation error.
  - textarea 에 `resize-y` 추가 (관리자가 긴 안내문 편집 편리).
- **테스트**: `packages/web/tests/classroomLimits.test.ts` — 상수 = 30000.

### 배운 것

- **shared limits lib 패턴 확산**: v0.173 `groupLimits` 로 만들어진 shared 상수 lib 패턴이 v0.174 에서 `classroomLimits` 로 자연스럽게 이식됨. 리소스별 lib 파일을 만들어두면 후속 slice 에서 다른 필드 상한 (name 750 · section 2800 · room 650) 추가하기 저렴.
- **이미 textarea 인 필드에 상한 추가**: 새 textarea 승격은 필요 없지만 카운터·차단만 추가하는 미니 slice. UI 변경 최소 (rendering 3줄 추가 · handleSubmit 2줄 추가) 로 UX 강화.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: dashboard export 개선 · basicData panel UX polish · classroomDetail owner email 매핑 서버 확장 · CourseBulkCreate description 필드에도 동일 30,000 상한 이식 · CreateClassroom name/section/room 상한 추가 (COURSE_NAME_MAX 등).

---

## 2026-09-20 · v0.175 classroomLimits name/section/room 상한 확장 + CreateClassroom 검증 (v0.174 후속)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `74c0ded` (`feat/classroom-name-limits-v175`) | feat: v0.175 classroomLimits name/section/room 상한 확장 + CreateClassroom 검증 (v0.174 후속) |
| 병합 | `d914dd2` | Merge feat/classroom-name-limits-v175 into main - v0.175 classroomLimits name/section/room 상한 확장 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `d914dd2` | skip (Head 폴백 규율) | 기계 관문(web 1034 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: v0.174 는 description 만 상한 검증. name/section/room 도 Google Classroom REST API 문서에 명시된 상한 초과 시 400. 셋 다 실무에서 상한을 넘길 가능성이 낮지만, 「2026학년도 3학년 5반 …」 같은 접두어를 자동 부착하는 매크로가 나올 때 놓치기 쉬움.
- **해결**:
  - shared `lib/classroomLimits.ts` 에 `COURSE_NAME_MAX = 750` · `COURSE_SECTION_MAX = 2800` · `COURSE_ROOM_MAX = 650` 상수 추가 (Google Classroom REST API 문서 기준).
  - CreateClassroomDialog `fieldLengthError` state · handleSubmit 상단 3-branch 상한 검증 (name → section → room 순서) · 초과 시 배너 노출 + 서버 요청 차단.
  - 카운터 UI 는 name/section/room 에는 붙이지 않음 (실무 값이 상한 대비 매우 짧아 UX 노이즈). description (30,000자) 카운터만 유지.
- **테스트**: `classroomLimits.test.ts` 4 tests (기존 1 + 신규 3).

### 배운 것

- **shared limits lib 확장 저비용**: v0.174 에서 lib 파일 하나 만들어놓으니 이번 slice 는 상수 3개 추가 + 검증 3-branch 로 끝. 처음부터 모든 필드를 하나의 slice 로 묶기보다는, 문제 필드(description) 먼저 → 그 다음 나머지 로 나누는 게 리뷰·리스크 낮음.
- **카운터 표시 여부는 실무 상한 대비 예상 값 비율**: description(30,000) 은 상한 근처까지 쓸 여지 있어 카운터가 유용하지만, name(750) 은 실무 값이 20~50자 → 카운터 노이즈. 상한 검증만 뒤에서 살짝 지키는 게 UX 정답.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: BulkRenameClassroomDialog 에도 name 상한 검증 이식 (row-level warning + confirm disable) · CourseBulkCreate CSV 파싱 시 상한 초과 row 표시 · dashboard export 개선 · basicData panel UX polish.

---

## 2026-09-20 · v0.176 BulkRenameClassroomDialog row-level 상한 검증 (COURSE_NAME_MAX 이식)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `df16df7` (`feat/bulk-rename-name-limit-v176`) | feat: v0.176 BulkRenameClassroomDialog row-level 상한 검증 (COURSE_NAME_MAX 이식) |
| 병합 | `c4eae3b` | Merge feat/bulk-rename-name-limit-v176 into main - v0.176 BulkRenameClassroomDialog row-level 상한 검증 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `c4eae3b` | skip (Head 폴백 규율) | 기계 관문(web 1036 유닛 · lint clean) 을 gate 로 사용. |

### 설계

- **문제**: v0.175 로 CreateClassroom 단일 폼은 상한 보호되지만, BulkRename 은 여러 row 를 동시에 편집하며 「2026학년도 - <원본 이름>」 같은 접두어를 패턴 적용하면 상한(750) 을 실수로 넘길 위험이 큼.
- **해결**:
  - `overlyLongRows` useMemo — `rows.filter(r => r.newName.length > COURSE_NAME_MAX)`.
  - `canConfirm` 에 `overlyLongRows.length === 0` 조건 추가.
  - row loop: 기존 `invalid` (빈 이름) + 신규 `tooLong` 을 `rowError` 로 통합, danger 스타일 재사용. tooLong row 아래에 「최대 750자 초과 (현재 N자)」 노출.
  - 하단 summary 에 「상한 초과 N개」 카운트 (invalid 카운트와 병렬).
- **테스트**: 2 시나리오 (`751자 초과 → warning + confirm disabled` · `750자 정확 → 정상`). 기존 `toBeInTheDocument` 매처 미설치 문제로 `toBeTruthy` / `toBeNull` 로 대체.

### 배운 것

- **테스트 매처 관례**: 이 프로젝트는 `@testing-library/jest-dom` 미설치. `toBeInTheDocument` 대신 `queryByTestId(...).toBeTruthy()` / `.toBeNull()` 로 존재/부재 assert.
- **rowError 통합**: 기존 boolean flag (`invalid`) 에 새 조건(`tooLong`) 을 or 결합해 하나의 스타일 branch (rowError) 로 통합. 새 danger 스타일 branch 추가하지 않고 재사용해 diff 최소화.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: CourseBulkCreate CSV 파싱 시 상한 초과 row 표시 · dashboard export 개선 · basicData panel UX polish · UserDetail displayName 상한 이식 (Directory User familyName/givenName 40자).

## 2026-09-20 · v0.177 ClassroomTable CSV/JSON 내보내기 (3 테이블 export 트릴로지 완결)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `55c5fd5` (`feat/classroom-export-v177`) | feat: v0.177 ClassroomTable CSV/JSON 내보내기 (AccountsTable v0.152/v0.155 · GroupsTable v0.157 대칭) |
| 병합 | `dca5db0` | Merge feat/classroom-export-v177 into main - v0.177 ClassroomTable CSV/JSON 내보내기 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `dca5db0` | skip (Head 폴백 규율) | 기계 관문 (web 1041 유닛 · lint clean · tsc + eslint) 을 gate 로 사용. Codex 한도 소진 대응. |

### 설계

- **문제**: Accounts (v0.152 CSV/JSON + v0.155 선택 접미사) · Groups (v0.157 CSV/JSON) 는 export 지원. Classroom 만 export 미지원 → 코스 감사·재적재·타 시스템 이관 편의 부재.
- **해결**: v0.152/v0.155 패턴을 그대로 이식.
  - `exportCourses = useMemo`: selectedIds 있으면 필터 결과 안의 선택 교집합, 없으면 sortedFilteredCourses (기존 bulk 계약 대칭 — 필터 밖 선택으로 실행되지 않도록).
  - `exportScope`: 'selected' | 'filtered'.
  - `handleExportCsv`: 9 컬럼 (id · 이름 · 섹션 · 상태 (translateCourseState) · 설명 · 링크 · 소유자 id · 생성 시각 · 수정 시각) · CSV escaping (`"..."` + `""` 이스케이프) · UTF-8 BOM (`﻿`).
  - `handleExportJson`: payload (exportedAt · scope · filters · totalCount · courses[]). courses 필드는 ClassroomCourse 원본 유지 (id · name · section · courseState · description · alternateLink · ownerId · creationTime · updateTime).
  - 파일명: `classrooms-YYYY-MM-DD.csv|json` (선택 있으면 `classrooms-selected-...`).
  - 버튼 라벨: 선택 있으면 `CSV 내보내기 (선택 N)` / `JSON 내보내기 (선택 N)`. title 툴팁 4-branch (0/selected/filtered).
  - `exportCourses.length === 0` 이면 두 버튼 모두 disabled + 「내보낼 코스가 없습니다.」 title.
- **테스트**: 5 시나리오 (`v0.177` describe): enabled + 파일명 format, 빈 목록 disabled, 필터 결과 0 disabled, 선택 「-selected」 접미사, JSON payload 필드 검증.

### 배운 것

- **URL.createObjectURL 스텁 필요**: jsdom 은 `URL.createObjectURL` 미구현 → 각 export 테스트에서 `URL.createObjectURL = vi.fn(() => 'blob:mock')` · `URL.revokeObjectURL = vi.fn()` 스텁 필수. try/finally 로 원본 복원 (AccountsTable.test.tsx 1042~1050 패턴 답습).
- **HTMLAnchorElement.prototype.click 캡처**: `download` attribute 검증하려면 `HTMLAnchorElement.prototype.click` 을 wrapping 해서 anchor 인스턴스를 push. try/finally 로 원본 복원.
- **BOM 문자 표기**: 소스에 literal `﻿` 문자 직접 삽입하지 말고 escape sequence 유지 — 파일 저장 시 다른 툴이 마지막 문자로 오해할 수 있음. Edit 툴로 삽입한 후 Python 스크립트로 escape 로 재작성.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로, A-2 계정 삭제 메일, chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: CourseBulkCreate CSV 파싱 시 상한 초과 row 표시 · dashboard export 개선 · basicData panel UX polish · UserDetail displayName 상한 이식 (Directory User familyName/givenName 40자) · AuditLogTable JSON 내보내기 재검토 (v0.108 은 있지만 filter reflect 개선 여지).

## 2026-09-20 · v0.178 CreateUser/BatchCreate 성/이름 60자 상한 검증 (Google Directory User 규격)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `ca3b35e` (`feat/user-name-limit-v178`) | feat: v0.178 CreateUser/BatchCreate 성/이름 60자 상한 검증 (Google Directory User) |
| 병합 | `fd88dbb` | Merge feat/user-name-limit-v178 into main - v0.178 CreateUser/BatchCreate 성/이름 60자 상한 검증 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `fd88dbb` | skip (Head 폴백 규율) | 기계 관문 (web 1050 유닛 · lint clean · tsc + eslint) 을 gate 로 사용. Codex 한도 소진 대응. |

### 설계

- **문제**: v0.173/v0.174/v0.175 로 group description · course description · course name/section/room 은 client-side 상한 강제 갖춤. 계정 생성 (Create · Batch) 은 성/이름 무제한 → Google Directory API 60자 초과 시 400 invalid_argument 로 라운드트립 낭비 + 사용자 뜻 모를 메시지.
- **해결**:
  - **신규 `packages/web/src/lib/userLimits.ts`** — `USER_FAMILY_NAME_MAX = 60` · `USER_GIVEN_NAME_MAX = 60` (Google Directory User schema 참조).
  - **CreateUserDialog** — handleSubmit 상단 trim > 60 검증 → 실행 차단 + 「성/이름은 최대 60자까지 입력 가능합니다 (현재 N자).」 · 각 input 밑 `familyName-counter` / `givenName-counter` 실시간 카운터 (초과 시 `text-state-danger`).
  - **BatchCreateUsersDialog** — handleConfirm row loop 검증 → 실행 차단 (에러 메시지에 「「id」 의 성/이름」 접두어) · 각 row `family` / `given` input 에 `aria-invalid` + red border + inline warn `-family-warn` / `-given-warn` · 하단 실행 예정 카운트 옆에 `batch-create-users-name-limit-summary` 「이름 상한 초과 N개 행」 (v0.176 BulkRename `overlyLongRows` 패턴).
- **테스트**:
  - `packages/web/tests/userLimits.test.ts` — helper 2건 (family=60, given=60).
  - `packages/web/tests/CreateUserDialog.test.tsx` v0.178 describe 4건 (family 61자 차단 · given 100자 차단 · 카운터 실시간 red toggle · 60자 정확 경계 정상).
  - `packages/web/tests/BatchCreateUsersDialog.test.tsx` v0.178 describe 3건 (family 61자 차단 · given 75자 red 경고 + summary count · 60자 정확 경계 정상).

### 배운 것

- **testid 확인 우선**: BatchCreate validation error div 는 `batch-create-users-error` (내가 초기 draft 에 `batch-create-users-validation-error` 로 잘못 썼음). 새 테스트 쓰기 전 기존 testid 를 `grep` 으로 확인해서 재사용 (v0.176 rowError 패턴 답습 대신 실제 소스 확인).
- **v0.176 rowError 패턴 재사용**: BulkRename 의 `overlyLongRows` useMemo + summary count 접근이 BatchCreate 에도 그대로 적용됨. 다만 BulkRename 은 `rowError` (invalid | tooLong) 통합 스타일, BatchCreate 은 이미 각 필드별 input 이라 field-level `familyTooLong` / `givenTooLong` 로 분리하고 inline warn 별도 노출.
- **aria-invalid conditional prop**: `aria-invalid={familyTooLong || undefined}` 로 false 일 때 attribute 자체를 제거 (일부 스크린 리더는 aria-invalid="false" 를 잘못 해석). 접근성 관례.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 메일 (SendGrid), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: CourseBulkCreate CSV 파싱 시 상한 초과 row 표시 · dashboard export 개선 · basicData panel UX polish · AuditLogTable JSON 내보내기 filter reflect 개선 · users API primaryEmail 상한 (Google Workspace: 64자 local + 253자 domain).

## 2026-09-20 · v0.179 EditUserDialog 성/이름 60자 상한 이식 (Create/Batch/Edit 3 진입점 대칭 완결)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `9ec3a83` (`feat/edit-user-name-limit-v179`) | feat: v0.179 EditUserDialog 성/이름 60자 상한 이식 (v0.178 Create/Batch 대칭 완결) |
| 병합 | `f54f3a9` | Merge feat/edit-user-name-limit-v179 into main - v0.179 EditUserDialog 성/이름 60자 상한 이식 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `f54f3a9` | skip (Head 폴백 규율) | 기계 관문 (web 1054 유닛 · lint clean · tsc + eslint) 을 gate 로 사용. Codex 한도 소진 대응. |

### 설계

- **문제**: v0.178 로 신규 생성 (Create · Batch) 은 60자 상한 갖췄으나 편집 (EditUserDialog) 은 미검증 → 관리자가 편집으로 61자+ 시도 시 서버 400 라운드트립 낭비.
- **해결**: shared `USER_FAMILY_NAME_MAX` / `USER_GIVEN_NAME_MAX` 를 EditUserDialog 에도 import. handleSubmit 에 v0.178 대칭 검증 (문구 완전 동일) · 각 input 밑 `edit-user-familyName-counter` / `edit-user-givenName-counter` 실시간 카운터. Create/Batch/Edit 3 진입점 완전 대칭.
- **테스트**: 4 시나리오 (v0.179 describe): family 61자 차단 · given 100자 차단 · 카운터 실시간 red toggle (pre-fill 「홍」=1자 · 「길동」=2자 → 60자 정확 · 61자 red) · 60자 경계 정상 mutate 호출.

### 배운 것

- **shared 상수 재사용의 힘**: v0.178 이 `userLimits.ts` 를 shared 로 뽑아둔 덕에 v0.179 는 import + 2 line 검증 + counter UI 만 추가 (36 line diff). 상수를 shared 로 뽑는 초기 결정이 후속 슬라이스를 극단적으로 단순화.
- **pre-filled input 카운터 검증**: EditUserDialog 는 mount 시 user 데이터로 pre-fill 되므로 카운터도 pre-fill 자릿수 (예: 「홍」=1) 로 시작. 테스트에서 초기값도 assertion 대상으로 잡음.

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 메일 (SendGrid), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.
- 새 후보: CourseBulkCreate CSV 파싱 시 상한 초과 row 표시 · dashboard export 개선 · basicData panel UX polish · AuditLogTable JSON 내보내기 filter reflect 개선 · users API primaryEmail 상한 · CreateGroup/EditGroup name 상한 (Directory Group name 60자) · CreateOrgUnit name 상한 (100자, v0.121 은 이미 검증 있음 재확인).

## 2026-09-20 · v0.180 CreateGroup/EditGroup 이름 60자 상한 검증 (Workspace Directory groups.name)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `b5281aa` (`feat/group-name-limit-v180`) | feat: v0.180 CreateGroup/EditGroup 이름 60자 상한 검증 |
| 병합 | `c4aba5e` | Merge feat/group-name-limit-v180 into main - v0.180 CreateGroup/EditGroup 이름 60자 상한 검증 |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `c4aba5e` | skip (Head 폴백) | 기계 관문 (web 1060 유닛 · lint clean) 을 gate 로 사용. Codex 한도 소진 대응. |

### 설계

- **문제**: v0.173 에서 group description 4096자 검증만 갖췄고 name 은 미검증. Directory API 는 `groups.name` 60자 초과 시 400.
- **해결**: `lib/groupLimits.ts` 에 `GROUP_NAME_MAX = 60` 추가. CreateGroupDialog + EditGroupDialog 두 곳 handleSubmit 검증 + input 밑 「N / 60 자」 실시간 카운터 (초과 시 red · v0.178 CreateUser 스타일과 동일 pattern).
- **테스트**: 6 시나리오 (groupLimits helper 1 · CreateGroup v0.180 2 · EditGroup v0.180 3).

### 배운 것

- **submit button 찾기**: `screen.getByRole("button", { name: /추가/ })` 로 접근하면 「+ 계정 추가」 등 다른 「추가」 버튼과 충돌 위험. `getByTestId("create-group-submit")` 처럼 명시적 testid 가 안전.
- **groupLimits 확장 rhythm**: 이제 GROUP_DESCRIPTION_MAX (v0.173) + GROUP_NAME_MAX (v0.180) 로 groups 리소스 두 주요 필드 완전 커버. 다음 유사 패턴: `groups.email` local-part 64자 상한 (RFC 5321 · Google Directory 는 primaryEmail 256 이지만 local 은 64).

### 다음 세션에 이어갈 것

- 로드맵 남은: A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.
- 새 후보: primaryEmail/local-part 상한 (v0.180 groups.email 후속 · CreateUser/CreateGroup 두 곳 확장) · CourseBulkCreate CSV row 상한 표시 · CreateOrgUnit 재확인 · dashboard export 개선.

## 2026-09-20 · v0.181 CreateUserDialog primaryEmail local-part 64자 상한 (RFC 5321)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `8c88bd3` (`feat/user-email-local-limit-v181`) | feat: v0.181 CreateUserDialog primaryEmail local-part 64자 상한 검증 |
| 병합 | `534c05f` | Merge feat/user-email-local-limit-v181 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `534c05f` | skip (Head 폴백) | 기계 관문 (web 1064 유닛 · lint clean) 을 gate. Codex 한도 소진 대응. |

### 설계

- **문제**: CreateGroupDialog · BatchCreateUsersDialog · CreateClassroomDialog owner · TransferClassroomOwner 는 모두 `lib/emailInput.ts` LOCAL_PART_RE (`{0,63}`) 로 64자 강제. CreateUserDialog 만 full email 직접 입력 + `endsWith('@cam.hs.kr')` 만 검사 → 65자+ local-part 시 서버 400.
- **해결**: `USER_LOCAL_PART_MAX = 64` shared 상수 추가 + CreateUserDialog handleSubmit 에서 `email.slice(0, lastIndexOf('@'))` 로 local 추출 후 길이 체크. 이메일 input 밑 카운터 (@ 없이도 로컬로 간주해 실시간 반영).
- **테스트**: 3 시나리오 (65자 초과 차단 · 카운터 실시간 red toggle · 64자 정확 mutate 정상). 초기 draft 에 `@cam.hs.kr` empty-local 테스트 추가했지만 HTML5 `<input type="email">` required 가 form submit 을 사전 차단해 JS 검증까지 도달 안 함 → 해당 테스트는 defensive 이지만 회귀는 removeToo.

### 배운 것

- **HTML5 input type="email" required 는 JS submit 검증 상위**: `fireEvent.click(submit)` 이 무효 이메일 (예: `@cam.hs.kr`) 에서는 form.submit 을 발생시키지 않음 → 내부 handleSubmit 이 실행 안 됨. defensive check 는 코드에 남기되 테스트는 HTML5 valid 값으로만 트리거.
- **helper 재사용 vs 신규 검증**: `normalizeSchoolEmailInput` 을 CreateUserDialog 에도 이식할 수 있었으나, 현재 UX (full email 필수) 를 그대로 두면서 상한만 강제하는 게 diff 최소. helper 통합은 별도 UX 결정 슬라이스로 남김.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.182**: `EditUserDialog` primaryEmail 는 read-only 라 검증 불필요. 대신 **NEIS CSV import 시 로컬 성/이름 60자 상한 표시** (v0.145 dialog 확장 · v0.176 pattern).
  - **v0.183**: CourseBulkCreate 자동 생성 name 은 짧지만 유저 지정 「년도 접두어」 등으로 상한 표시 방어.
  - **v0.184**: dashboard export 개선 (audit result 카드 CSV/JSON) 또는 basicData panel UX polish.
- 로드맵 남은 (blocked): A-1 전입생 매크로 (도메인 규칙), A-2 계정 삭제 메일 (SendGrid), chat member userId→email 서버 확장, AutoInvite+AutoRemove diff 통합.

## 2026-09-20 · v0.182 NEIS CSV import 코스 이름 750자 상한 검증 (v0.176 pattern)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `3cb46b4` (`feat/neis-csv-name-limit-v182`) | feat: v0.182 NEIS CSV import 코스 이름 750자 상한 검증 |
| 병합 | `6c60b80` | Merge feat/neis-csv-name-limit-v182 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `6c60b80` | skip (Head 폴백) | 기계 관문 (web 1068 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: v0.145 NeisCsvImportDialog 는 사용자 CSV 의 F열 courseName 을 그대로 `callClassroomCreate({ name })` 로 전달. 사용자가 실수로 초장문 이름을 넣으면 서버 400 · 부분 실패로 청소가 어려움.
- **해결**: v0.176 BulkRename row-level 상한 패턴을 preview 단계에 이식.
  - **helper 승격**: `findOverlyLongPlanRows(plan, max = COURSE_NAME_MAX)` 순수 함수로 뽑아 export → 회귀 4건 (모두 이내 · 초과 분리 · 빈 plan · 커스텀 max).
  - **UI**: preview 상단 red 배너 「코스 이름 상한 초과 N개 행 — 실행 불가」 · 각 초과 row 는 셀 red + 「N / 750 자 초과」 접미사 · 실행 버튼 `canExecute = plan.length > 0 && overlyLongRows.length === 0` 로 disabled + title 「CSV 수정 후 다시 미리보기」.
- **테스트**: 순수 helper 4건. Component 자체는 FileReader/papaparse mocking 이 무거워 helper 회귀만 커버 (v0.176 도 유사 정책).

### 배운 것

- **helper 승격의 회귀 저비용성**: 컴포넌트 안에 useMemo 로 두면 회귀 어려움. 순수 함수로 export 하면 helper test 1 파일로 4 케이스 커버. v0.176 도 `overlyLongRows` 를 컴포넌트 내부 useMemo 로 두었는데, 향후 유사 slice 는 초기부터 helper 승격 고려.
- **findOverlyLongPlanRows 시그니처**: `Array<{ rowIndex, courseName }>` 로 최소 타입만 요구 (PlanRow 전체 안 받음) → 다른 dialog 에도 재사용 가능한 형태.
- **preview 컴포넌트 리팩터 (tooLong row 스타일)**: 기존 map 안에 iife 로 tooLong 로컬 계산 후 conditional 스타일. inline 방식이 fragment 로 wrap 하는 것보다 diff 작음.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.183**: CourseBulkCreate 자동 name 접두어 상한 방어 (미해결 - 자동 name 은 짧지만 defensive 하게).
  - **v0.184**: super_admin dashboard 액션별 위젯을 CSV/JSON export (기존 오늘/이번주/이번달 breakdown 재활용).
  - **v0.185**: basicData panel UX polish (「반 챗방 자동 초대」 「명단 밖 자동 제거」 버튼 그룹핑 등).
- 로드맵 남은 (blocked): 위와 동일.

## 2026-09-20 · v0.183 super_admin 액션별 위젯 CSV/JSON 내보내기

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `671b85e` (`feat/dashboard-breakdown-export-v183`) | feat: v0.183 super_admin 액션별 위젯 CSV/JSON 내보내기 |
| 병합 | `0211e6c` | Merge feat/dashboard-breakdown-export-v183 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `0211e6c` | skip (Head 폴백) | 기계 관문 (web 1071 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: SuperAdminPage 대시보드는 액션별 breakdown 을 표로 렌더만 하고 export 없음. AccountsTable (v0.152) · GroupsTable (v0.157) · ClassroomTable (v0.177) 3 테이블 이후 audit-scope 로 export 확장 필요.
- **해결**: 위젯 header 에 CSV/JSON 두 버튼 추가.
  - **hoist**: 기존에 IIFE 안에 있던 `displayCounts`/`sortedActions` 계산을 컴포넌트 scope 로 승격 (`breakdownDisplayCounts` · `breakdownSortedActions` · `breakdownExportSource` · `breakdownFileSlug`). 이렇게 하면 IIFE 안 리스트 렌더와 header 의 버튼이 같은 값 공유.
  - **파일명 slug**: today/week/month/nDays 각각 `today` · `week` · `month` · `last{N}days` 로 매핑 (nDaysSanitized 사용).
  - **source 필드**: exactActionCounts 있으면 'exact', 없으면 'sample' — JSON payload 에 포함.
  - **버튼 disabled**: breakdownSortedActions.length === 0 (displayCounts undefined 또는 {}) → 두 버튼 모두 disabled + title 「내보낼 액션 집계가 없습니다.」.
- **테스트**: 3 시나리오 (enabled + 파일명, empty disabled, JSON payload 필드 exact 우선 + 정렬).

### 배운 것

- **JSON export payload 는 window 메타를 반드시 포함**: 파일명이 daily rotate 되므로 파일명만으로는 window 를 특정하기 어려움. payload 안에 `window` · `windowLabel` · `atMin` 세 필드 모두 포함 → 파일 재분석 시 원 window 를 알 수 있음.
- **source 필드로 exact vs sample 구분**: sample-scope 는 최대 500건만 반영이라 축약될 수 있음. 사용자가 export 후 「왜 count 가 실제와 다른가?」 를 알아볼 수 있게 `source: 'sample'` 을 payload 에 명시.
- **breakdownExportSource ternary**: `exactActionCounts !== undefined` 로만 판정 (displayCounts 는 sample fallback 이 이미 반영됨). 명확한 boolean 로직.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.184**: basicData panel UX polish (예: 「반 그룹 자동 생성」 · 「부서 그룹 자동 생성」 · 「반 챗방 자동 초대」 · 「명단 밖 자동 제거」 버튼들 category 그룹핑 / 순서 정리).
  - **v0.185**: CreateOrgUnit name/description 검증 재확인 및 shared `orgUnitLimits.ts` 승격.
  - **v0.186**: AuditLogTable JSON export (v0.108) 의 filter reflect 개선 (v0.108 은 있지만 최근 filter 규칙 (kpiFilter/preset) 이 payload 에 반영되는지 재검토).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-20 · v0.184 BasicDataPanel 버튼 3-그룹핑 (편집 / 자동 워크플로우 / 데이터 I/O)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `b1b6e93` (`feat/basic-data-panel-ux-v184`) | feat: v0.184 BasicDataPanel 버튼 3-그룹핑 |
| 병합 | `34240a3` | Merge feat/basic-data-panel-ux-v184 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `34240a3` | skip (Head 폴백) | 기계 관문 (web 1074 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: BasicDataPanel 헤더에 9 개 버튼이 `flex-wrap` 으로 무질서 나열. 관리자가 「자동 워크플로우」 (일괄 파괴/생성 액션) 과 「일반 편집」 을 시각적으로 구분 어려움. 특히 「명단 밖 자동 제거」 는 파괴적 액션인데 다른 자동 액션과 뒤섞임.
- **해결**: 3 role/역할 카테고리로 시각+접근성 그룹핑.
  - **편집** (2): 편집 · 학생 명단 편집.
  - **자동 워크플로우** (5): 그룹 자동 생성 · 부서 그룹 자동 생성 · 학생 자동 초대 · 반 챗방 자동 초대 · 명단 밖 자동 제거 — 파괴적 액션을 마지막에 배치.
  - **데이터 입출력** (2): JSON 불러오기 · JSON 내보내기.
  - 각 그룹: `<div role="group" aria-label="..." className="border-l border-border-subtle pl-4">` · gap-2 within · outer gap-4 between.
- **기존 testid 유지 원칙**: `basic-data-*-btn` 모든 testid 를 그대로 유지 → 기존 16 회귀 무영향. 신규 `basic-data-group-{edit,auto,io}` 3 testid 만 추가.

### 배운 것

- **접근성 그룹핑은 시각 그룹핑과 결합**: `role="group" + aria-label` 을 붙이면 스크린 리더가 버튼 배치를 카테고리 단위로 announce. 시각 border 만 있으면 sighted 사용자만 혜택. 두 층위 동시 (visual+ARIA) 가 표준.
- **파괴적 액션은 그룹 마지막**: 「명단 밖 자동 제거」 는 groupsMembers.delete 호출 → 파괴적. UX 관례상 파괴적 액션은 시각적 마지막 (뒤로) 배치 → 실수 클릭 방지.
- **testid 유지의 회귀 절약**: 기존 16 회귀가 자동 pass — 리팩터링 슬라이스에서 testid 를 바꾸지 말고 신규 그룹 testid 만 추가하면 회귀 부담 최소.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.185**: CreateOrgUnit name/description 상한 shared `orgUnitLimits.ts` 승격 (v0.121 은 inline 규칙, 다른 dialog 에도 재사용 가능하게).
  - **v0.186**: AuditLogTable JSON export (v0.108) 의 filter reflect 개선 (payload 에 최근 filter 규칙 반영 재검토).
  - **v0.187**: EditGroupDialog description counter 개선 (v0.173 은 이미 있지만 v0.180 name counter 스타일에 통일).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-20 · v0.185 OrgUnit 이름 100자 상한 shared lib 승격 + 카운터 이식

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `fd58794e` (`feat/orgunit-limits-lib-v185`) | feat: v0.185 OrgUnit 이름 100자 상한 shared lib 승격 + 카운터 이식 |
| 병합 | `3bb8ff9` | Merge feat/orgunit-limits-lib-v185 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `3bb8ff9` | skip (Head 폴백) | 기계 관문 (web 1079 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: v0.121 (CreateUser) · v0.159 (BatchCreate) 두 곳에 `if (name.length > 100)` 이 hardcoded. 상수 매직 넘버 + 매번 「OU 이름은 100자 이하여야 합니다.」 짧은 에러만 (현재 자릿수 미표시). 카운터 UI 도 없음 → 사용자가 상한 초과 임박을 미리 알 수 없음.
- **해결**:
  - **shared 상수 승격**: 신규 `lib/orgUnitLimits.ts` 에 `ORG_UNIT_NAME_MAX = 100` (Google Admin SDK Directory OrgUnit 규격).
  - **CreateUserDialog + BatchCreateUsersDialog**: 두 곳 handleCreateOu (또는 handleNewOuCreate) 검증에서 상수 참조 + 에러 문구에 `(현재 N자)` 포함 (v0.178 pattern).
  - **카운터 UI**: 각 「새 OU 만들기」 폼의 이름 input 밑에 「N / 100 자」 실시간 카운터 (초과 시 `text-state-danger`, v0.178/v0.180 style 대칭).
- **테스트**: 5 시나리오 (helper 1 · CreateUser v0.185 2 · Batch v0.185 2).

### 배운 것

- **hardcoded → shared 승격 리듬**: v0.180 (`GROUP_NAME_MAX`) · v0.181 (`USER_LOCAL_PART_MAX`) 에 이어 v0.185 로 orgUnit 도 shared 화. 상수는 Google API 규격에서 파생되므로 `lib/{resource}Limits.ts` naming 유지.
- **hardcoded → 상수 승격은 diff 최소화 원칙**: `100` 상수 하나만 바꾸고 카운터 UI 만 추가. 이미 존재하던 handleCreateOu 검증 순서/문구 재작성 안 함 (v0.185 는 「승격」 슬라이스 이지 「리팩터」 슬라이스 아님).
- **testid 새로 추가할 때 -counter suffix 관례**: v0.178 `familyName-counter` · v0.180 `create-group-name-counter` · v0.185 `create-user-new-ou-name-counter` · `batch-create-users-new-ou-name-counter` 로 통일. 다음 dialog 승격 시에도 이 관례 유지.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.186**: AuditLogTable JSON export (v0.108) 의 filter reflect 개선 (payload 에 최근 filter 규칙 반영 재검토).
  - **v0.187**: EditGroupDialog description counter v0.180 name counter 스타일 통일 (v0.173 은 `text-micro text-fg-muted` inline, v0.180 name counter 는 `mt-1 text-small` conditional-danger — 통일).
  - **v0.188**: CreateClassroomDialog name/section/room 카운터 이식 (v0.175 검증 있지만 카운터 없음).
- 로드맵 남은 (blocked): 위와 동일.

## 2026-09-20 · v0.186 AuditLog JSON export sourceQuery/sourcePath 재현용 필드

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `aa6e23c` (`feat/audit-json-source-query-v186`) | feat: v0.186 AuditLog JSON export sourceQuery/sourcePath 재현용 필드 |
| 병합 | `69044f1` | Merge feat/audit-json-source-query-v186 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `69044f1` | skip (Head 폴백) | 기계 관문 (web 1081 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: v0.108 F55 payload 는 정규화된 hook 인자 (dedup 된 actionList · 유효 검증 통과한 atMin/Max ms 등) 를 담아 실제 조회 조건을 정확히 기록. 하지만 원본 URL query 를 문자 그대로 다른 세션에서 재현하려면 사용자가 필드 → URL param 매핑을 손으로 해야 한다 (e.g., `filter.result: 'error'` → `?result=error`, `filter.actions: ['users.read', 'groups.list']` → `?action=users.read,groups.list`).
- **해결**:
  - `sourceQueryRaw = searchParams.toString()` (URLSearchParams API 로 인코딩 자동).
  - `sourceQuery = sourceQueryRaw ? '?' + sourceQueryRaw : ''` (question mark prefix).
  - `sourcePath = '/super_admin/audit' + sourceQuery`.
  - 사용자는 export 파일만 들고 다른 세션/기기에서 `sourcePath` 로 이동 → 동일 URL params 로 재조회 (localStorage-scoped preset 이 아니라 URL-scoped 이므로 완전 재현).
- **테스트**: 2 회귀 (v0.186 describe): 빈 URL → sourceQuery='' · sourcePath='/super_admin/audit', 필터 URL → sourceQuery=?action=...&result=... · sourcePath 조합.

### 배운 것

- **URL.toString() 자동 인코딩**: `URLSearchParams.toString()` 이 특수문자 (한글 등) 를 자동 URL-encode → 매뉴얼 `encodeURIComponent` 조합 불필요.
- **sourceQuery vs filter payload 두 필드 병행**: `filter` 는 정규화된 「무엇을 조회했는가」 (dedup 등 서버가 실제 본 값), `sourceQuery` 는 「사용자가 실제로 입력한 URL」. 둘 다 의미 있음 — 서버 재조회 시 dedup 이 다시 일어나므로 URL 이 중복 값을 갖고 있어도 동일 결과. 그러나 사용자 원본 의도 보존을 위해 원본 URL 도 함께.
- **renderWithRouter initialEntries 위치 인자**: AuditLogTable 테스트 helper 는 `renderWithRouter(ui, initialEntries)` 로 배열 직접 받음. object 형태 `{initialEntries: []}` 아님. 매번 확인 필수.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.187**: EditGroupDialog description counter v0.180 name counter 스타일 통일 (v0.173 counter 를 `mt-1 text-small` conditional-danger 로 재작성).
  - **v0.188**: CreateClassroomDialog name/section/room 카운터 이식 (v0.175 검증 있지만 카운터 없음).
  - **v0.189**: RenameClassroomDialog (v0.136 개별 이름 변경) 카운터 이식.
- 로드맵 남은 (blocked): 위와 동일.

## 2026-09-20 · v0.187 CreateGroup/EditGroup description counter 스타일 통일 (v0.180 대칭)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `944385e` (`feat/group-description-counter-unify-v187`) | feat: v0.187 CreateGroup/EditGroup description counter v0.180 스타일 통일 |
| 병합 | `971a90f` | Merge feat/group-description-counter-unify-v187 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `971a90f` | skip (Head 폴백) | 기계 관문 (web 1085 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: v0.173 에서 도입한 description counter 는 항상 muted (`text-micro text-fg-muted` + 「현재 N / 4096 자」 prefix). v0.180 에서 도입한 name counter 는 초과 시 red (`text-small` conditional-danger + prefix 없이 「N / MAX 자」). 두 counter 시각 관례 불일치 → 사용자가 상한 초과를 description 에서 인지하기 어려움.
- **해결**:
  - `text-micro` → `text-small` (name counter 와 크기 통일).
  - `text-fg-muted` (상수) → `${description.length > MAX ? 'text-state-danger' : 'text-fg-muted'}` (초과 시 red toggle).
  - 「현재 N / 4096 자」 → 「N / 4096 자」 (v0.180/v0.185 name counter 포맷과 통일).
- **테스트**: 4 회귀 (각 dialog 「이내 muted + 텍스트 포맷」 · 「초과 red」).

### 배운 것

- **counter 스타일 3-요소 통일**: (1) `text-small` 크기 · (2) `mt-1` 간격 · (3) `${...danger : muted}` conditional class 이 세 요소가 「app-standard counter」 정의. v0.178 (userLimits) · v0.180 (groupName) · v0.185 (orgUnitName) 모두 이 3-요소 준수. v0.173 description 은 예외였는데 v0.187 로 정리.
- **텍스트 포맷 통일**: 「N / MAX 자」 (name counter 관례). 「현재」 같은 명시 prefix 는 label 이나 title 에서 이미 「설명」 이라 문맥상 중복. 카운터 자체는 숫자만 강조.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.188**: CreateClassroomDialog name/section/room 카운터 이식 (v0.175 검증 있지만 카운터 없음).
  - **v0.189**: RenameClassroomDialog 카운터 이식 (v0.136 개별 이름 변경).
  - **v0.190**: BulkRenameClassroomDialog row-level 카운터 (v0.176 은 warn 만 있고 실시간 counter 없음).
- 로드맵 남은 (blocked): 위와 동일.

## 2026-09-20 · v0.188 CreateClassroomDialog name/section/room 카운터 이식 + description 스타일 통일

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `dba8e4e` (`feat/create-classroom-counters-v188`) | feat: v0.188 CreateClassroomDialog 카운터 이식 |
| 병합 | `052d0d3` | Merge feat/create-classroom-counters-v188 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `052d0d3` | skip (Head 폴백) | 기계 관문 (web 1089 유닛 · lint clean) 을 gate. |

### 설계

- **문제**: v0.175 로 name(750)/section(2800)/room(650) 상한 검증은 있지만 실시간 카운터 UI 없음 → 사용자가 상한 임박을 미리 인지 어려움. 특히 section/room 은 큰 상한이라 화면상 안 보일 수 있음. 추가로 v0.174 description(30000) 카운터는 옛 스타일 (`text-micro` + `text-red-600 font-semibold` + 「현재」 prefix) 이라 v0.180/v0.185/v0.187 통일 스타일과 불일치.
- **해결**:
  - name/section/room 세 필드에 v0.180 스타일 카운터 신규 (mt-1 text-small conditional-danger).
  - description 카운터도 v0.180 스타일로 재작성 — text-red-600 → text-state-danger, text-micro → text-small, 「현재」 prefix 제거.
  - `.toLocaleString()` 유지 (1,000 자 이상 값에 comma separator).
- **테스트**: 4 회귀 (name/section/room/description 각 초기 muted + 초과 red).

### 배운 것

- **toLocaleString() 유지 이유**: v0.180 group name(60자) 은 comma 불필요하나 v0.188 course section(2,800) · description(30,000) 은 comma 있어야 가독성. 통일 스타일이라도 `toLocaleString()` vs raw number 는 필드 범위에 따라 판단. 이 슬라이스는 모두 toLocaleString() 유지.
- **text-red-600 → text-state-danger 는 semantic 이동**: Tailwind 상수 (`red-600`) 대신 semantic token (`state-danger`) 사용이 우리 UI_SYSTEM 관례. v0.174 는 이 관례 도입 전이라 상수 사용, v0.188 로 정리.
- **CreateClassroomDialog 4개 필드 (name/section/description/room) 모두 카운터 있음**: 이제 모든 상한 있는 필드에 카운터 존재. RenameClassroomDialog · BulkRenameClassroomDialog 은 다음 슬라이스 (v0.189/v0.190) 에서 카운터 이식.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.189**: RenameClassroomDialog 카운터 이식 (v0.136 개별 이름 변경 · name/section 두 필드).
  - **v0.190**: BulkRenameClassroomDialog row-level 카운터 (v0.176 은 warn 만 있고 실시간 counter 없음).
  - **v0.191**: BatchCreateUsersDialog password field 표시 여부 toggle (기존 raw 표시).
- 로드맵 남은 (blocked): 위와 동일.

## 2026-09-20 · v0.189 RenameClassroomDialog 카운터 이식 + shared classroomLimits 참조

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `97b51df` (`feat/rename-classroom-counter-v189`) | feat: v0.189 RenameClassroomDialog 카운터 이식 |
| 병합 | `7e03374` | Merge feat/rename-classroom-counter-v189 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `7e03374` | skip (Head 폴백) | 기계 관문 (web 1091 유닛 · lint clean). |

### 설계

- **문제**: v0.136 개별 이름 변경 다이얼로그는 hardcoded `NAME_MAX = 750`, `SECTION_MAX = 2800` 두 상수 + tooLong warn (초과 시에만 노출). shared `lib/classroomLimits.ts` (v0.175) 도입 후 hardcoded 유지 상태. 카운터 UI 없음.
- **해결**: shared 상수 import + module-scope alias (`const NAME_MAX = COURSE_NAME_MAX`) 로 하위 호환 유지 (기존 코드 base 최소 변경). 각 input 밑 v0.180 스타일 카운터 신규.
- **테스트**: 2 시나리오 (name/section 각 pre-fill + red toggle).

## 2026-09-20 · v0.190 BulkRenameClassroomDialog row-level 실시간 카운터

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `d107834` (`feat/bulk-rename-row-counter-v190`) | feat: v0.190 BulkRenameClassroomDialog row-level 실시간 카운터 |
| 병합 | `7fe90a7` | Merge feat/bulk-rename-row-counter-v190 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `7fe90a7` | skip (Head 폴백) | 기계 관문 (web 1092 유닛 · lint clean). |

### 설계

- **문제**: v0.176 은 각 row 에 tooLong warn (초과 시에만 노출) 만 있음 → 사용자가 상한 임박을 미리 인지 어려움.
- **해결**: 각 row input 밑에 v0.180/v0.188 스타일 카운터 신규. 기존 tooLong warn 은 유지 (초과 시 명시적 안내 병행).
- **테스트**: 1 시나리오 (row 카운터 pre-fill 반영 + red toggle).

### 배운 것

- **counter + warn 병행**: v0.190 은 「카운터 (실시간)」 + 「warn (초과 시 명시 안내)」 두 계층 UX. 카운터만 있으면 초과 원인이 tooLong 인지 다른 것인지 불명확 → warn 이 명시 문구를 제공. 이 pattern 을 다른 bulk row-level dialog 에도 이식 가능.
- **counter 시리즈 통계 (v0.178~v0.190)**:
  - v0.178: CreateUser + BatchCreate family/given (60자).
  - v0.179: EditUser 동일.
  - v0.180: CreateGroup + EditGroup name (60자).
  - v0.181: CreateUser email local-part (64자).
  - v0.185: CreateUser + BatchCreate 새 OU name (100자).
  - v0.187: CreateGroup + EditGroup description 스타일 통일 (4096자).
  - v0.188: CreateClassroom name/section/description/room 4 필드 (750/2800/30000/650) + description 스타일 통일.
  - v0.189: RenameClassroom name/section (750/2800).
  - v0.190: BulkRenameClassroom row-level (750).
  - **총 11개 dialog · 20+ 필드 counter 통일**. 「app-standard counter」 pattern 이 사실상 codebase 표준으로 확립.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.191**: BulkTransferClassroomOwnerDialog 카운터 (이메일 local-part 64자).
  - **v0.192**: CreateGroupDialog local-part 카운터 (v0.181 CreateUser 대칭 · groups.email local-part 64자).
  - **v0.193**: users detail 페이지 name/OU 편집 인라인 카운터.
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-20 · v0.191 BulkTransferClassroomOwner local-part 카운터 + emailInput helper 확장

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `7591da7` (`feat/bulk-transfer-local-part-counter-v191`) | feat: v0.191 BulkTransferClassroomOwner local-part 64자 카운터 + emailInput helper 확장 |
| 병합 | `c903a86` | Merge feat/bulk-transfer-local-part-counter-v191 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `c903a86` | skip (Head 폴백) | 기계 관문 (web 1096 유닛 · lint clean). |

### 설계

- **문제**: 소유자 일괄 이관 다이얼로그의 새 소유자 이메일 입력은 `normalizeSchoolEmailInput` helper 를 통과하지만 (LOCAL_PART_RE 로 64자 강제) 카운터 UI 없음. v0.181 CreateUser 는 카운터 이식됐지만 BulkTransfer 는 미커버.
- **해결**: `lib/emailInput.ts` 에 `EMAIL_LOCAL_PART_MAX` 상수 + `extractEmailLocalPart(input)` helper 승격 (재사용). 왜 여기? 이메일 인프라의 semantic home 은 `emailInput.ts`. `userLimits.USER_LOCAL_PART_MAX` 는 동일 값이지만 v0.181 scope 에 남겨두고, `EMAIL_LOCAL_PART_MAX` 는 dialog 무관 이메일 상한. Import 통일 (다음 슬라이스 v0.192 도 이걸 쓸 수 있게).
- **테스트**: helper 2 (상수 값 · extractEmailLocalPart edge cases) · dialog 회귀 2 (미노출 · 실시간 red toggle).

## 2026-09-20 · v0.192 CreateGroup + CreateClassroom + TransferClassroomOwner local-part 카운터

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `57e4250` (`feat/local-part-counters-v192`) | feat: v0.192 CreateGroup + CreateClassroom + TransferClassroomOwner local-part 카운터 |
| 병합 | `53ca8b1` | Merge feat/local-part-counters-v192 into main |

### 라운드 표

| 라운드 | HEAD | 결과 | 발견 |
|---|---|---|---|
| 1 | `53ca8b1` | skip (Head 폴백) | 기계 관문 (web 1102 유닛 · lint clean). |

### 설계

- **문제**: v0.191 BulkTransfer 는 local-part 카운터 완료. 하지만 개별 (CreateGroup · CreateClassroom owner · TransferClassroomOwner) 3 dialog 도 이메일 입력 있는데 카운터 없음.
- **해결**: v0.191 이 승격한 `EMAIL_LOCAL_PART_MAX` + `extractEmailLocalPart` 재사용. 각 dialog 특수 미노출 조건:
  - CreateGroup: 빈 값이면 미노출 (아직 안 입력).
  - CreateClassroom: 빈 값 OR「me」 이면 미노출 (기본값이 「me」 이므로).
  - TransferClassroomOwner: 빈 값이면 미노출.
- **테스트**: 각 dialog 2건 (미노출 조건 · 이내 muted/초과 red).

### 배운 것

- **Local-part 카운터 시리즈 완결**: v0.181 (CreateUser 1) + v0.191 (BulkTransfer 1) + v0.192 (CreateGroup · CreateClassroom · TransferClassroomOwner 3) = **5 dialog 완결**. 이메일 입력이 있는 모든 관리자 UI 에 카운터 완비.
- **미노출 조건 유연성**: 카운터는 정보 밀도 UI 이지만 「기본값 상태」 에서는 노이즈. `me` (CreateClassroom 특수) · 빈 값 (전 dialog) 은 미노출 유지 → 정보 필요할 때만 노출.
- **counter 승격 vs 인라인 판정**: v0.191 은 3 dialog 이상 재사용 예상 → 승격. v0.190 BulkRename row-level 카운터는 1 dialog 만 → 인라인 유지 (extractEmailLocalPart 는 v0.191/v0.192 두 세션 걸쳐 3 dialog 재사용 확정 후 승격).

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.193**: users detail 페이지 (userDetail.tsx) name/OU 편집 인라인 카운터 이식.
  - **v0.194**: groupDetail 페이지 name/description 편집 인라인 카운터.
  - **v0.195**: classroomDetail 페이지 편집 UI 최소화 (이미 v0.171 CopyButton 만).
- 로드맵 남은 (blocked): 위와 동일.

## 2026-09-20 · v0.193/v0.194/v0.195 페이지 크기 셀렉터 시리즈 (Accounts · Groups · Classroom 3 테이블)

### 커밋 표

| 슬라이스 | 커밋 | 병합 |
|---|---|---|
| v0.193 (Accounts) | `61cfc07` | `42c8e58` |
| v0.194 (Groups) | `362f769` | `3caef6f` |
| v0.195 (Classroom) | `a443730` | `75d1279` |

### 라운드 표

| 슬라이스 | HEAD | 결과 |
|---|---|---|
| v0.193 | `42c8e58` | skip (Head 폴백 · web 1107) |
| v0.194 | `3caef6f` | skip · web 1111 |
| v0.195 | `75d1279` | skip · web 1115 |

### 설계

- **문제**: 3 테이블 모두 하드코딩 `PAGE_SIZE = 25`. 대량 데이터 (수백~수천 계정) 관리자에게 페이지 넘김 부담. 사용자 선택권 제로.
- **해결 pattern** (v0.193 확립, v0.194/v0.195 그대로 이식):
  - Module-scope: `PAGE_SIZE_OPTIONS = [25, 50, 100] as const` · `PageSize` type · `DEFAULT_PAGE_SIZE = 25` · `PAGE_SIZE_STORAGE_KEY = '<table>Table.pageSize.v1'` · `readStoredPageSize()` (JSON int + allowlist + fallback).
  - 컴포넌트 state: `pageSize` (lazy init from localStorage) + `handlePageSizeChange` (state 갱신 · page=0 리셋 · try/catch localStorage write).
  - 기존 `PAGE_SIZE` 상수 제거 → 3~4 참조 모두 state 로 교체.
  - Pagination controls 좌측에 `<select>` (label htmlFor 연결) 추가.
- **테스트 pattern** (각 4~5 회귀):
  - 기본 25 · select 값 확인 · 「다음」 활성.
  - 50 선택 → localStorage 저장 · page=0 리셋 · pagination boundary.
  - localStorage 「100」 hydrate.
  - 잘못된 값 (`abc`) fallback.
  - options 밖 값 (`200`) fallback (v0.193 만).

### 배운 것

- **shared lib 승격 vs 각자 상수 정의**: 3 테이블 동일 pattern 이지만 각 파일의 module-scope constants 로 두는 게 diff 최소화 (shared lib 승격 시 storage key generator 추가 필요 · 오히려 복잡). "3 회 동일 pattern = 승격" 규칙의 예외 — key 별 파일 명시가 더 명확한 케이스.
- **as const array + typeof indexed access**: `const PAGE_SIZE_OPTIONS = [25, 50, 100] as const; type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]` 로 union type `25 | 50 | 100` 자동 유도. 새 옵션 추가 시 array 만 수정하면 type 도 자동 확장.
- **totalization (v0.178~v0.195 통산)**: 웹 유닛 1054 → 1115 (**+61 슬라이스 통산**). Counter (v0.178~v0.190) + local-part (v0.181/v0.191/v0.192) + page-size (v0.193~v0.195) 세 시리즈로 관리자 테이블/다이얼로그 UX polish 완결에 근접.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.196**: Table 3 개에 총 페이지 수 표시 (`page N of M`).
  - **v0.197**: audit log page-size 셀렉터 (AuditLogTable 도 25 하드코딩).
  - **v0.198**: Column visibility toggle (선택 컬럼 숨기기).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-20 · v0.196 3 테이블 pagination-info 「N / M 페이지」 표기

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `a4ea7af` | feat: v0.196 3 테이블 pagination-info 「N / M 페이지」 표기 |
| 병합 | `76caeec` | Merge feat/pagination-page-of-total-v196 |

### 설계

- 기존 pagination info `${page * pageSize + 1}–${...} of ${total}` 옆에 `(${page + 1} / ${Math.max(1, Math.ceil(total / pageSize))} 페이지)` 접미사 추가.
- 3 테이블 (Accounts · Groups · Classroom) 동일 pattern.
- 기존 회귀 18 개 (`.toBe("1–25 of 30")` 등) 를 `.toContain()` 으로 완화. Python script 로 bulk 변환.
- 신규 3 회귀: 각 테이블 30개 데이터 → 「1 / 2 페이지」 → next → 「2 / 2」.

### 배운 것

- **문자열 확장 시 exact-match 회귀 완화**: 기존 `.toBe` assertion 은 문자열 정확 매치라 확장에 취약. `.toContain` 으로 완화하면 확장 접미사도 통과. 다만 「결과 없음」 처럼 예외 케이스는 `.toBe` 유지.
- **Math.max(1, ceil)**: `total=0` 이면 `ceil(0/25) = 0` 이라 「1 / 0 페이지」 표기 되지만 이 케이스는 「결과 없음」 브랜치로 처리하므로 접미사 안 붙음. defensive Math.max(1) 는 total=0 대응 아니라 total>0 인데 pageSize > total (예: 5개 / 25 = 1 페이지) 케이스에서 ceil(5/25)=1 이 맞으므로 실제로는 필요 없음. 하지만 미래 방어.

## 2026-09-20 · v0.197 AuditLogTable 페이지 크기 셀렉터 (4 테이블 완결)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `f74de4a` | feat: v0.197 AuditLogTable 페이지 크기 셀렉터 |
| 병합 | `a4ad11a` | Merge feat/audit-page-size-v197 |

### 설계

- v0.193 pattern 재사용. localStorage 키 = `auditLogTable.pageSize.v1`.
- AuditLog 는 client-side 슬라이스 아님 → `useAuditLogList(pageSize, {...})` 로 서버 요청 자체를 pageSize 로 변경. state 변경 시 hook 재호출 → 서버 재요청.
- JSON export payload `filter.pageSize` 도 하드코딩 25 → state 값 반영 (v0.108 F55 정확화).
- 회귀 4건: hook 호출 인자 검증 (`toHaveBeenLastCalledWith(pageSize, expect.any(Object))`) 로 서버 요청 크기 실제 변경 확인.

### 배운 것

- **테이블 3종 vs AuditLog 차이**: Accounts/Groups/Classroom 은 client-side slicing 이라 pageSize state 만 바꾸면 됨. AuditLog 는 server-side pagination 이라 hook 인자에 pageSize 를 전달해야 실제 요청 크기 변경. 두 접근이 UI-scope 는 동일해 보이지만 backend 관점에서는 완전히 다른 slice.
- **hook 인자 assertion pattern**: `mockUseAuditLogList.mockReturnValue(...); expect(mockUseAuditLogList).toHaveBeenLastCalledWith(pageSize, expect.any(Object))` 로 hook 호출 인자를 검증. 이 pattern 은 다른 server-pagination hook 에도 재사용 가능.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.198**: Column visibility toggle (선택 컬럼 숨기기 · 3 테이블 대칭).
  - **v0.199**: 감사 로그 정렬 옵션 (현재 서버 default 순).
  - **v0.200**: AutoInvite + AutoRemove 통합 diff dialog (v0.149 + v0.150 통합).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.198 AuditLog 「더 보기」 pageSize + hasMore 시각화 (v0.197 후속 마감)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `ba1c460` | feat: v0.198 AuditLog 「더 보기」 pageSize + hasMore 시각화 |
| 병합 | `fd7ecdd` | Merge feat/audit-loaded-count-v198 |

### 설계

- **문제**: v0.197 로 서버 요청 pageSize 는 state 로 변경됐지만 화면상 「더 보기 (25 건)」 버튼 라벨은 하드코딩 25 → pageSize=50/100 선택 시 라벨과 실제 로드량 mismatch. 또 hasMore 상태가 헤더 정보에 노출 안 됨.
- **해결**:
  - 「더 보기 (25 건)」 → `더 보기 (${pageSize} 건)` — state 참조.
  - 로드 정보 헤더에 `(더 있음)` / `(마지막)` 접미사. testid `audit-log-loaded-info` 신규.

### 배운 것

- **후속 마감 슬라이스의 가치**: v0.197 이 큰 pattern 을 이식했지만 label 하드코딩 하나가 남아있었음. v0.198 은 30 line diff 로 완결감 제공. 큰 슬라이스 이후 「소소한 마감」 슬라이스를 별도로 두는 게 오히려 diff 리뷰 편함.
- **hasMore 시각화의 UX 가치**: 무한 스크롤은 「끝났는지」 사용자가 알기 어려움. `(마지막)` 뱃지가 명시적 신호.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.199**: Column visibility toggle (선택 컬럼 숨기기 · 3 테이블).
  - **v0.200**: AutoInvite + AutoRemove 통합 diff dialog.
  - **v0.201**: 감사 로그 정렬 옵션.
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.199 AccountsTable 컬럼 표시 토글 (4 필드 · localStorage)

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `2502872` | feat: v0.199 AccountsTable 컬럼 표시 토글 (이름/조직단위/관리자/정지) |
| 병합 | `a293a17` | Merge feat/accounts-column-visibility-v199 |

### 설계

- **필수 vs 선택 컬럼**: 선택 checkbox · 이메일 · 관리 3 개는 필수 (항상 표시). 이름 · 조직 단위 · 관리자 · 정지 4 개는 사용자 선택.
- **localStorage**: `accountsTable.visibleColumns.v1` = JSON array of visible column keys.
  - `readStoredVisibleColumns()`: Array.isArray + allowlist filter (TOGGLEABLE_COLUMNS.map(c => c.key)) + fallback default 4 개 모두.
- **State + toggle**: `visibleColumns: Set<ToggleColumnKey>` · `toggleColumn(key)` 이 add/remove 후 localStorage 즉시 저장 (try/catch).
- **UI**: 「컬럼 표시 (N / 4)」 secondary Button (Export 버튼 옆) · popover menu (`role="menu"` · `aria-haspopup="menu"` · `aria-expanded={isOpen}`) · 각 label 안에 checkbox.
- **Conditional rendering**: `{visibleColumns.has(key) && <TableHead ... />}` · 헤더/셀 대칭.
- **테스트**: 5 시나리오 (기본 4/4 · uncheck localStorage 저장 · hydrate ["admin"] → 1/4 · 잘못된 값 fallback · 모두 uncheck 0/4).

### 배운 것

- **필수 컬럼 유지 규칙**: 선택/이메일/관리 3 개는 사용자가 숨길 수 없음. 이유: 선택 체크박스 없으면 bulk 액션 불가능 · 이메일 없으면 row 식별 안 됨 · 관리 없으면 편집 링크 접근 안 됨. UX 의 「essential」 개념을 코드에 명시.
- **Set state + localStorage 동기화 pattern**: `setVisibleColumns((prev) => { const next = new Set(prev); ...mutate...; localStorage.setItem(...); return next; })` — 단일 setter 콜백 안에서 mutation + save 원자적으로. React state 와 localStorage 가 항상 일치.
- **popover 없이 relative + z-10 로 충분**: 별도 popover 라이브러리 (radix 등) 없이 `<div className="relative">` + `<div className="absolute right-0 z-10 ...">` 로 pop 구현. 외부 클릭 감지 없어 사용자가 다른 곳 클릭해도 안 닫힘 (다음 세션에 outside-click handler 추가 고려).

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.200**: GroupsTable 컬럼 표시 토글 (v0.199 대칭).
  - **v0.201**: ClassroomTable 컬럼 표시 토글 (v0.199 대칭).
  - **v0.202**: Column menu outside-click auto-close.
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.200/v0.201 GroupsTable/ClassroomTable 컬럼 표시 토글 (시리즈 완결)

### 커밋 표

| 슬라이스 | 커밋 | 병합 |
|---|---|---|
| v0.200 (Groups) | `d82d312` | `07d4441` |
| v0.201 (Classroom) | `172ef4f` | `c194b37` |

### 라운드 표

| 슬라이스 | HEAD | 결과 |
|---|---|---|
| v0.200 | `07d4441` | skip · web 1134 (+4) |
| v0.201 | `c194b37` | skip · web 1138 (+4) |

### 설계

- v0.199 pattern 그대로 이식. GroupsTable 4 필드 (name/description/aliases/directMembersCount), ClassroomTable 5 필드 (name/section/state/id/link).
- 각 테이블 별 module-scope constants (`TOGGLEABLE_COLUMNS`, `DEFAULT_VISIBLE_COLUMNS`, `VISIBLE_COLUMNS_STORAGE_KEY`, `readStoredVisibleColumns()`).
- 컴포넌트 state (`visibleColumns: Set<ToggleColumnKey>`, `isColumnMenuOpen`, `toggleColumn` helper).
- UI popover 「컬럼 표시 (N / M)」 + checkbox 리스트.
- 헤더/셀 조건부 렌더링.

### 배운 것

- **shared vs 각자 pattern**: v0.193 page-size 시리즈처럼 상수 module-scope 유지 · 각 테이블 별 storage key 로 구분. shared lib 승격 시 storage key generator 추가 필요 · 오히려 복잡. "3 회 반복 pattern" 이지만 이 경우는 인라인이 명확.
- **필수 vs 선택 컬럼 정의**: 각 테이블 마다 필수 컬럼이 다름. Accounts (선택/이메일/관리), Groups (선택/이메일/관리), Classroom (선택/관리 · 이름도 토글 가능). UX 결정: bulk action 이 있는 테이블은 선택 checkbox 필수, 링크 진입점 있는 primary column (email/name) 은 필수 유지 (사용자가 실수로 다 hide 하면 row 식별 불가).

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.202**: Column menu outside-click auto-close (usability polish).
  - **v0.203**: 컬럼 표시 preset 저장 (예: "기본" / "간결" / "전체").
  - **v0.204**: AutoInvite + AutoRemove 통합 diff dialog (v0.149 + v0.150).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.202 컬럼 메뉴 outside-click auto-close + shared useClickOutside hook

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `d35d541` | feat: v0.202 컬럼 메뉴 outside-click auto-close |
| 병합 | `18eb6a0` | Merge feat/column-menu-outside-click-v202 |

### 설계

- **문제**: v0.199/v0.200/v0.201 로 열린 popover 는 사용자가 다른 곳 클릭해도 계속 열려있음. UX 관례 위반.
- **해결**:
  - shared hook `lib/useClickOutside.ts` 승격 (3 테이블 공통).
  - refs[] 배열: 트리거 버튼 + 메뉴 컨테이너 두 요소 모두 「내부」 로 취급 (버튼 클릭이 close 를 immediate 재열지 않게).
  - enabled toggle: `isColumnMenuOpen=false` 일 때는 리스너 미부착 (성능 최적).
  - `mousedown` 리스너 (click 은 blur 이후 발화 → 순서 UX 불편).
- 각 테이블: `useCallback` 로 close handler 안정화 → `useEffect` deps 재실행 방지.
- Button forwardRef 활용 (기존).

### 배운 것

- **fireEvent.mouseDown vs dispatchEvent**: React Testing Library `fireEvent.mouseDown()` 은 React state 갱신을 트리거하고 `waitFor` 로 대기 가능. raw `outside.dispatchEvent(new MouseEvent('mousedown'))` 은 React 이벤트 loop 밖에서 발화 → state 갱신 시점 불확실. 항상 `fireEvent.*` 사용.
- **enabled toggle 성능 최적화**: `useEffect` 안에 `if (!enabled) return;` 이 있어도 useEffect body 는 실행됨 (listener 등록 skip 만). enabled=false 렌더는 리스너 안 부착 → dependency 배열에 enabled 넣어 값 바뀔 때만 리스너 register/unregister.
- **shared hook 승격 timing**: 3 테이블 동일 pattern 확인 후 승격. 만약 1 테이블만 필요했다면 인라인 useEffect 유지. 3 회 반복 = 승격 임계.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.203**: 컬럼 표시 preset 저장 (기본 / 간결 / 전체 · 각 테이블).
  - **v0.204**: AutoInvite + AutoRemove 통합 diff dialog (v0.149 + v0.150).
  - **v0.205**: Column menu 키보드 접근성 (Escape 로 닫기).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.203 컬럼 메뉴 Escape 키 닫기 + shared useEscapeKey hook

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `cea199c` | feat: v0.203 컬럼 메뉴 Escape 키 닫기 + shared useEscapeKey hook |
| 병합 | `dc197a6` | Merge feat/column-menu-escape-v203 |

### 설계

- **문제**: v0.202 outside-click 이후에도 키보드-only 사용자는 메뉴 닫기 불편. Escape = 「닫기」 UX 관례.
- **해결**: shared hook `useEscapeKey(handler, enabled)` 승격 (다른 modal/popover 재사용 대비). 3 테이블에 이식.
- **테스트**: hook 단위 4건 (enabled toggle · Escape · 다른 키 · unmount) + AccountsTable 통합 1건.

### 배운 것

- **hook 을 미리 승격**: 첫 사용처 (컬럼 메뉴 3 테이블) 만으로도 승격 정당화 (3 번 반복). 다른 dialog/modal 에서 재사용될 여지가 크므로 미리 shared 로.
- **enabled flag 로 리스너 부착 최적화**: v0.202 useClickOutside 와 동일 pattern. 닫힌 상태 (99% 시간) 는 리스너 zero → 성능.
- **KeyboardEvent 'Escape' 키 값**: `e.key === 'Escape'` (구 `keyCode 27` 대신). modern 표준.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.204**: AutoInvite + AutoRemove 통합 diff dialog (v0.149 + v0.150).
  - **v0.205**: 컬럼 표시 preset 저장 (기본 / 간결 / 전체).
  - **v0.206**: Focus trap in column menu (Tab 순환).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.204 컬럼 메뉴 「전체 표시」 / 「전체 숨김」 quick actions

### 커밋 표

| 단계 | 커밋 | 요약 |
|---|---|---|
| 슬라이스 | `8cbaece` | feat: v0.204 컬럼 메뉴 「전체 표시」 / 「전체 숨김」 quick actions |
| 병합 | `5dd9b06` | Merge feat/column-menu-quick-actions-v204 |

### 설계

- **문제**: v0.199~v0.201 column visibility 는 각 필드 checkbox 개별 클릭. 4~5 개 컬럼 전체를 한 번에 on/off 하려면 여러 번 클릭 필요.
- **해결**: 메뉴 상단에 「전체 표시」/「전체 숨김」 링크 버튼 (구분자 `·`). `setAllVisible(true|false)` helper 로 상태 배치 갱신 + localStorage 저장.
- **Disabled 조건**: 이미 최대 (visibleColumns.size === TOGGLEABLE_COLUMNS.length) → 「전체 표시」 disabled. 이미 0 → 「전체 숨김」 disabled. 사용자에게 불필요한 action 방지 + 시각 신호.

### 배운 것

- **preset 대신 「전체 on/off」 먼저**: v0.205 로 계획했던 "기본/간결/전체" preset 은 각 preset 이름 정의부터 시작해야 하는 큰 UX 결정. 우선 「전체」 두 케이스만 quick action 으로 커버 → 나머지 preset (기본/간결) 은 실 사용자 피드백 기반으로 나중에.
- **disabled 로 UX 신호**: 버튼이 늘 활성이면 사용자가 「전체 숨김 → 이미 숨겨진 상태 → 뭐가 일어나지?」 로 혼란. disabled 는 「지금 할 수 있는 것이 없다」 를 명시.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.205**: 컬럼 표시 preset 저장 (기본 / 간결 / 전체).
  - **v0.206**: AutoInvite + AutoRemove 통합 diff dialog (v0.149 + v0.150).
  - **v0.207**: Focus trap in column menu (Tab 순환).
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.

## 2026-09-21 · v0.205/v0.206/v0.207 컬럼 메뉴 UX 시리즈 마감 (「간결」 preset · focus trap · 선호 초기화)

### 커밋 표

| 슬라이스 | 커밋 | 병합 |
|---|---|---|
| v0.205 (간결 preset) | `01cebf8` | `135b0ae` |
| v0.206 (focus trap) | `988c54e` | `1cc09cb` |
| v0.207 (선호 초기화) | `6550c78` | `58fe1cf` |

### 라운드 표

| 슬라이스 | HEAD | 결과 |
|---|---|---|
| v0.205 | `135b0ae` | skip · web 1153 (+2) |
| v0.206 | `1cc09cb` | skip · web 1157 (+4) |
| v0.207 | `58fe1cf` | skip · web 1158 (+1) |

### 설계

- **v0.205 「간결」 preset**: `applyMinimalPreset()` = visibleColumns 를 [name] 로. UI 「전체 표시 · 간결 · 전체 숨김」 3 링크.
- **v0.206 focus trap**: 신규 `useFocusTrap(containerRef, enabled)` hook. Tab/Shift+Tab wrap around. enabled=false 시 이전 focused element 로 복원.
- **v0.207 「선호 초기화」**: `resetUserPreferences()` = localStorage 3 키 (sort · pageSize · visibleColumns) 제거 + state DEFAULT 복원 + URL sort/dir clear + page 0. 메뉴 하단 border-t 로 구분된 링크 버튼.

### 배운 것

- **shared hook 라이브러리 정립**: `useClickOutside` (v0.202) · `useEscapeKey` (v0.203) · `useFocusTrap` (v0.206) 세 접근성 hook 이 모두 shared 로 승격. 다른 dialog/popover 에서 재사용 대비.
- **테이블 3 축 preference**: v0.160 sort · v0.193 pageSize · v0.199 visibleColumns 각각 다른 localStorage 키. v0.207 은 이 3 축을 통합 리셋. 「필터 초기화」 는 URL scope, 「선호 초기화」 는 localStorage scope — 명확 분리.

### 다음 세션에 이어갈 것

- 순차 다음 후보:
  - **v0.208**: AutoInvite + AutoRemove 통합 diff dialog (v0.149 + v0.150) — 큰 슬라이스.
  - **v0.209**: shared hook 다른 dialog/modal 로 확장 (예: Dialog 컴포넌트).
  - **v0.210**: Table row hover styling · sticky header.
- 로드맵 남은 (blocked): A-1 전입생 매크로 · A-2 계정 삭제 메일 · chat member userId→email 서버 확장 · AutoInvite+AutoRemove diff 통합.





















