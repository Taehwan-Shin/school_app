# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 인증 모델 ⓑ 로그인 사용자 OAuth | — | 확정 (사용자가 §2 값 회신으로 실질 확정) | `AGENTS.md` §1, `firebase_layout.md` §4 |
| Cloud 프로젝트·OAuth 클라이언트 ID·도메인 | 사용자 | 회신 완료 (`firebase_layout.md` §2 반영) | `firebase_layout.md` §2 값 3개 확정 |
| 역할·권한 매트릭스 v0.3 | 헤드 | 커밋됨 | `docs/design/roles.md` v0.3 |
| Firebase 프로젝트 구조 v0.12 | 헤드 | 커밋됨 · **Codex 12차 감사 전 항목 통과 · (a) 경로 v1.0 승격 승인** | `docs/design/firebase_layout.md` v0.12 · 승인 이벤트 `fb89b6a5b526...` |
| **Gmail API 활성화 확인** (배포 차단 항목) | 사용자 | **회신 완료** — 활성화 됨 | DM 이벤트 `8b887f3db670...` (`sendMailtoUsers` 유지, `gmail.send` 스코프 확정) |
| 사용자 역할 구조 확정 | 사용자 | **회신 완료** — 셋 (`super_admin` · `admin` · `teacher`) + 향후 매트릭스 확장 | DM 이벤트 `8b887f3db670...` — `roles.md` v0.3 「다섯」→「셋 + 확장」 재작성 필요 |
| **audit_log v1.0 위험 수용 결정** | 사용자 | **회신 완료** — (a) 코드 규율 기반 | DM 이벤트 `8b887f3db670...` — Rules · `writeAudit()` 헬퍼 · AST · 에뮬레이터 테스트 |
| `roles.md` v0.3 → v1.0 재작성 (3-역할 + 매트릭스 확장) | 헤드 | 진행 필요 | 세 역할 표 · 「부장」·「담임」 승격은 매트릭스 한 줄 |
| **설계 v1.0 통합 문서** (`DESIGN_v1.md`) | 헤드 (DM 세션) | 초안 나옴 (`OUTBOX/school-webapp-scaffold/docs/DESIGN_v1.md`) · 사용자 3확인 대기 | DM 이벤트 `f229cc64...` — §3 역할 이름 · §9 스택 · §11 완료 지표 |
| 설계 v1.0 확정 (repo 병합) | 헤드 | 대기 (DESIGN_v1 사용자 승인 + roles.md 재작성 후) | v1.0 커밋 · STATUS 에 확정 표기 |
| 첫 화면 (로그인 + 역할별 첫 화면 껍데기) 오더 → Antigravity | 헤드 | 대기 (설계 확정 후) | `docs/handoff/NEXT.md` 갱신, Antigravity 에게 채널 지시 |

## 되돌리지 않은 임시 변경

없음.

## 감시 중인 프로세스

없음.
