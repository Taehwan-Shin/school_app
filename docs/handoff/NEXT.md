# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.100 (role management UI) 병합 완료 (`2324255`).
> 사용자 확정 방향 (b) admin console v2 두 슬라이스 완결. 다음 방향 사용자 지시 대기.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `2324255` v0.100 — role management UI (usersUpdateRole + usersGetRole + EditUserRoleDialog).
- `1a5b0e0` v0.99 — capability matrix (CapabilityMatrixPage).
- `142fa23` v0.98 — classroom+chat pair 통합.
- `f0cf35b` v0.97 — chat bulk create.
- `e3dd87d` v0.96 — classroom bulk create hotfix.
- `5a0f4df` v0.94 — classroom authz hotfix.

## 다음 후보 (Head 검토 중)

STATUS.md 「다음 제품 방향 확정 (v0.101+)」 참고:
- **(b3) 감사 로그 검색·필터 개선** — role_split 감사 이벤트 전용 view · action/result 다중 필터.
- **(c) 실 Workspace 확인 workflow** — v0.94~v0.100 판정불가 소거를 위한 실 리소스 검증 스크립트·문서.
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
