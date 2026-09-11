# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.118 병합 완료** (`4a00f85`) — 감사 로그 배치 export · 5 라운드 Codex 감사.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `4a00f85` v0.118 — 감사 로그 배치 export (전체 JSON, compound cursor, AbortSignal).
- `c44f73f` v0.117 — classroom 상세 페이지 (`/admin/classrooms/:id`) + F80/F81.
- `70fac11` v0.116 — 클래스룸 소유자 이관 (transferOwnership callable + Dialog + F72~F79).
- `2da65ca` v0.115 — 클래스룸 archived bulk 관리 (BulkArchiveDialog + F72/F73).
- `30e5c25` v0.114 — audit filter preset 저장 (localStorage).

## 다음 후보 (Head 자율 실행 예정)

`docs/handoff/ROADMAP.md` Phase 5/6 남은 항목:
- **super_admin 대시보드 위젯** — 최근 활동 요약 (Phase 6).
- **전입생 계정 개별 생성 UX 개선** — `laterAccountSetup` 포팅 (Phase 5).
- **audit_log durable sink 인프라** — v0.116 F78 잔재. 사용자 조치 필요.
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
