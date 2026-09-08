# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.96 (bulk create hotfix) 병합 완료 (`e3dd87d`).
> 다음 제품 방향은 사용자 확정 대기.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `e3dd87d` v0.96 — classroom bulk create hotfix (F4~F11, 4 라운드 감사).
- `5a0f4df` v0.94 — classroom authz hotfix (F1~F3).
- `31ea9f7` v0.93 — chat bulk invite.

## 오더 확정 대기

STATUS.md 「다음 제품 방향 확정」 항목 참조. 후보:
- (a) Classroom 코스와 Chat 스페이스 학급 통합 생성/배정.
- (b) admin console v2 (역할 관리 UI + capability matrix).
- (c) 그 외 사용자 지시.

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
