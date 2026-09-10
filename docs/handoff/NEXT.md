# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.113 병합 완료** (`5cfca49`) — BulkResetPasswordDialog + ROADMAP.md · 3 라운드 Codex 감사.
> ROADMAP.md 참조: Phase 5 (school workflow 포팅) 진행 중.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `5cfca49` v0.113 — BulkResetPasswordDialog (원본 「비밀번호 일괄 변경」 포팅) + ROADMAP.md.
- `0fd1848` v0.112 — audit 「필터 초기화」 버튼.
- `7ef2057` v0.111 — audit role_split quick filter preset.
- `7b7a9bd` v0.110 — 미해결 role_split KPI.
- `ef5fef8` v0.109 — role_split unknown 자동 재확인.

## 다음 후보 (Head 자율 실행 예정)

`docs/handoff/ROADMAP.md` Phase 5 남은 항목 · Phase 6 통합·자동화:
- **클래스룸 소유자 이관** — `transferClassroomOwnershipAndUpdateSheet` 포팅.
- **클래스룸 archived 관리** — ACTIVE ↔ ARCHIVED bulk 전환.
- **전입생 계정 UX 개선** — laterAccountSetup 흐름 개선.
- **감사 로그 배치 export** — 전체 페이지 순회 후 통합 JSON/CSV.
- **감사 로그 필터 preset 저장** — localStorage 기반.
- **(d)** 사용자 지시 그 외.

## 상설 규약 (변하지 않음)

`AGENTS.md` §3 참조:
- 기존 파일 재작성 금지, 요청받은 부분만.
- 삭제가 추가보다 많으면 멈추고 보고.
- `git add -A` 금지. `main` push 금지.
- 지금 코드와 다르면 다르다고 보고.
- 「판정 불가」 허용.
- 근거는 `파일:줄번호`, 항목당 한 줄.
- 이모지 금지.
- 커밋 전 기계 관문 통과 — TypeScript · ESLint · Vitest.

## UI 슬라이스 원본

- **디자인 명세**: `docs/design/UI_SYSTEM.md` (v1.1, masstige.io 복원 + 아이콘 · AA 상향).
