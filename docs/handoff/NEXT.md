# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.103 (Say Briefly revert + 아이콘 + 가독성) 병합 완료 (`eca8056`).
> UI_SYSTEM v1.1 (masstige.io 모노크롬 + 아이콘) 이 시각 원본. 다음 슬라이스 준비 중.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `eca8056` v0.103 — Say Briefly revert + 아이콘 + 가독성 (masstige.io 복원, lucide-react, AA 대비).
- `2b12361` v0.102 — Say Briefly 실험 (v0.103 에서 revert).
- `bb5a8f5` v0.101 — audit log filterAction.
- `2324255` v0.100 — role management UI.
- `1a5b0e0` v0.99 — capability matrix.

## 다음 후보 (Head 자율 실행 예정)

STATUS.md 참조:
- **(b4) 감사 로그 다중 액션·행위자 필터** — 현 단일 select 를 checkbox 다중 선택으로 확장.
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
