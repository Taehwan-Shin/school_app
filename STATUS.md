# STATUS — 지금 열린 항목

> 덮어쓰기 전용. 끝난 항목은 지운다. 이력은 `project_notes.md` 에 있다.
> **모든 행에 「확인 방법」이 있어야 한다.** 없으면 항목이 아니라 소망이다.

## 열린 항목

| 항목 | 담당 | 상태 | 확인 방법 |
|---|---|---|---|
| 인증 모델 ⓑ 로그인 사용자 OAuth | — | 확정 (사용자가 §2 값 회신으로 실질 확정) | `AGENTS.md` §1, `firebase_layout.md` §4 |
| Cloud 프로젝트·OAuth 클라이언트 ID·도메인 | 사용자 | 회신 완료 (`firebase_layout.md` §2 반영) | `firebase_layout.md` §2 값 3개 확정 |
| 역할·권한 매트릭스 v0.3 | 헤드 | 커밋됨 | `docs/design/roles.md` v0.3 |
| Firebase 프로젝트 구조 v0.11 (감사 10차 반영) | 헤드 | 커밋됨 | `docs/design/firebase_layout.md` v0.11 · §7-미결-1 CSRF 정직 재작성 · v1.0 착수 시 `impl_security.md` 신설 지목 |
| Codex 11차 감사 (v0.11 회귀 없음 확인) | 감사 | 대기 | 새 실패 없음이면 (a) 경로 v1.0 승격 준비 완료 |
| **Gmail API 활성화 확인** (배포 차단 항목) | 사용자 | 답 대기 | Google Cloud Console → API 라이브러리 → Gmail API 사용 설정. 필요 없으면 `sendMailtoUsers` 제외 결정 |
| 사용자 역할 구조 확정 (`roles.md` §2 판정불가) | 사용자 | 답 대기 | 다섯/셋/둘, 실무 용어 반영 여부 |
| **audit_log v1.0 위험 수용 결정** (`firebase_layout.md` §5-A) | 사용자 | 답 대기 | (a) 코드 규율 기반 v1.0 · (b) Pub/Sub 표면적 축소 (선택 시 서명 스키마 추가 작업) — 헤드 추천 (a) |
| 설계 v1.0 확정 | 헤드 | 대기 (감사 통과 + 사용자 답 세 건) | v1.0 커밋 · STATUS 에 확정 표기 |
| 첫 화면 (로그인 + 역할별 첫 화면 껍데기) 오더 → Antigravity | 헤드 | 대기 (설계 확정 후) | `docs/handoff/NEXT.md` 갱신, Antigravity 에게 채널 지시 |

## 되돌리지 않은 임시 변경

없음.

## 감시 중인 프로세스

없음.
