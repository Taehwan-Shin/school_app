# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.104 병합 완료** (`5b721c5`) · v0.107 role_split 자동 복구 진행 중 (서버 완료, client UI 개발 중).

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `5b721c5` v0.104 — audit multi-action filter (Firestore `in` 최대 30 · dedup+fail-closed · role=group).
- `9db5dd0` v0.106 — server-side role_split_detected action (client filter 제거 · caveat trigger-scope 단일화 · F38 pagination 가드).
- `ef6fb16` v0.105 — SuperAdminPage role_split 감시 카드.
- `eca8056` v0.103 — Say Briefly revert + 아이콘 + 가독성.
- `bb5a8f5` v0.101 — audit log filterAction.

## 다음 후보 (Head 자율 실행 예정)

STATUS.md 참조:
- **v0.107 완료** — role_split 자동 복구 callable + super_admin 카드 복구 버튼. 서버 (`usersResolveRoleSplit`) 완료. client UI 개발 중.
- **감사 로그 CSV/JSON export** — 감사 페이지에서 현재 필터 기준 export 버튼. ~~CSV export 는 이미 구현됨 (AuditLogTable.tsx handleExportCsv). JSON export 는 검토 대상~~.
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
