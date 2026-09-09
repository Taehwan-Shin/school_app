# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.99 (capability matrix) 병합 완료 (`1a5b0e0`).
> 사용자 확정 방향 (b) admin console v2 첫 슬라이스 완결. 다음 방향 사용자 지시 대기.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `1a5b0e0` v0.99 — admin console v2 첫 슬라이스 (CapabilityMatrixPage).
- `142fa23` v0.98 — classroom+chat pair 통합 (F13 128자 pair precheck).
- `f0cf35b` v0.97 — chat bulk create (F12 128자 검증).
- `e3dd87d` v0.96 — classroom bulk create hotfix (F4~F11).
- `5a0f4df` v0.94 — classroom authz hotfix (F1~F3).

## 다음 후보 (Head 검토 중)

STATUS.md 「다음 제품 방향 확정 (v0.100+)」 참고:
- **(b2) admin console v2 다음 단계** — 실제 역할 변경 UI. super_admin 이 사용자의 role 을 웹에서 promote/demote. 서버 변경 필요 (`system.manage_roles` capability 를 실제 callable 에 매핑).
- **(c) 실 Workspace 확인 workflow** — v0.94~v0.98 판정불가 소거.
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
