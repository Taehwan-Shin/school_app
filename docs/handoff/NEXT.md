# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.109 병합 완료** (`ef5fef8`) — role_split unknown 자동 재확인 · 4 라운드 Codex 감사.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `ef5fef8` v0.109 — role_split unknown row 자동 재확인 (mount-scoped budget · mutateAsync + allSettled).
- `a70689e` v0.108 — 감사 로그 JSON export + 파일명 필터 요약.
- `f7e5bb4` v0.107 — role_split 자동 복구 + 상태 재확인.
- `5b721c5` v0.104 — audit multi-action filter.
- `9db5dd0` v0.106 — server-side role_split_detected action.

## 다음 후보 (Head 자율 실행 예정)

STATUS.md 참조:
- **감사 로그 배치 export** — 전체 페이지 순회 후 통합 JSON/CSV.
- **감사 로그 필터 preset 저장** — 자주 쓰는 필터 조합.
- **(c) 실 Workspace 확인 workflow** — v0.94~v0.101 판정불가 소거.
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
