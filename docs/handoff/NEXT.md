# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.107 병합 완료** (`f7e5bb4`) — role_split 자동 복구·상태 재확인 · aggregation callable · 7 라운드 Codex 감사.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `f7e5bb4` v0.107 — role_split 자동 복구 + 상태 재확인 (resolveRoleSplit CAS · recheckRoleSplit read-only · unresolvedRoleSplits server aggregation · post-write 3-way 분기).
- `5b721c5` v0.104 — audit multi-action filter.
- `9db5dd0` v0.106 — server-side role_split_detected action.
- `ef6fb16` v0.105 — SuperAdminPage role_split 감시 카드.
- `eca8056` v0.103 — Say Briefly revert + 아이콘 + 가독성.

## 다음 후보 (Head 자율 실행 예정)

STATUS.md 참조:
- **role_split 자동 재확인** — 카드 로드 시 auth=unknown row 자동 recheck 트리거.
- **감사 로그 JSON export** — 현재 CSV 만 지원. JSON export 추가.
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
