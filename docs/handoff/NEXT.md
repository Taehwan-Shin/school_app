# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.102 (Say Briefly 디자인 첫 슬라이스) 병합 완료 (`2b12361`).
> UI_SYSTEM v2.0 (Say Briefly) 이 유일한 시각 원본. 다음 UI 슬라이스 준비 대기.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `2b12361` v0.102 — Say Briefly 디자인 첫 슬라이스 (토큰 + Google Fonts + shell).
- `bb5a8f5` v0.101 — audit log filterAction.
- `2324255` v0.100 — role management UI.
- `1a5b0e0` v0.99 — capability matrix.
- `142fa23` v0.98 — classroom+chat pair 통합.

## 다음 후보 (Head 검토 중)

STATUS.md 참조. UI 후속:
- **(e1) radius 전면 적용** — 기존 `rounded-none` → `rounded-buttons` (6px) / `rounded-cards` (12px).
- **(e2) Super Admin dashboard hero** — Bricolage 40px+ headline + highlight-yellow wash + pastel accent 카드.
- **(e3) 사이드바 확장** — 참고 이미지의 아이콘 · 시간 · bottom docs/live chat/sign out.
- **(e4) 개별 컴포넌트 세부** — KPI 카드 · 표 · 다이얼로그 Say Briefly 명세.

제품 후속:
- **(c) 실 Workspace 확인 workflow** — 판정불가 소거.
- **(b4) 감사 로그 다중 필터**.
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

- **디자인 명세**: `docs/design/UI_SYSTEM.md` (v2.0, Say Briefly).
- 팔레트·타이포·스페이싱·컴포넌트 규칙·AA 대비·이관 순서 모두 이 문서 기준.
