# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.106 (server-side role_split_detected action) 병합 완료 (`9db5dd0`).
> v0.104 (audit multi-action filter) 는 별 브랜치 `feat/audit-multi-action-v104 @ 470d854` Codex 감사 응답 6시간+ 지연.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `9db5dd0` v0.106 — server-side role_split_detected action (client filter 제거 · caveat trigger-scope 단일화 · F38 pagination 가드).
- `ef6fb16` v0.105 — SuperAdminPage role_split 감시 카드 (users.read/error sample · client filter · pagination 안내).
- `eca8056` v0.103 — Say Briefly revert + 아이콘 + 가독성 (masstige.io 복원, lucide-react, AA 대비).
- `2b12361` v0.102 — Say Briefly 실험 (v0.103 에서 revert).
- `bb5a8f5` v0.101 — audit log filterAction.

## 다음 후보 (Head 자율 실행 예정)

STATUS.md 참조:
- **v0.104 재요청** — audit 다중 액션 필터 Codex 감사 6시간+ 무응답. 재감사 요청 또는 병합 재검토.
- **role_split 자동 복구 callable** — 감지 후 super_admin 이 클릭으로 Auth ↔ Firestore 동기화 (Auth 원본을 Firestore 로 반영).
- **감사 로그 CSV/JSON export** — 감사 페이지에서 현재 필터 기준 export 버튼.
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
