# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **지금 이 파일에 열린 오더 없음.** v0.97 (chat bulk create) 병합 완료 (`f0cf35b`).
> 다음 v0.98 오더 (Classroom×Chat pair) 준비 중 — Head 가 확정 후 이 파일 갱신.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `f0cf35b` v0.97 — chat bulk create (ChatBulkCreateDialog + F12 128자 검증).
- `e3dd87d` v0.96 — classroom bulk create hotfix (F4~F11, 4 라운드 감사).
- `5a0f4df` v0.94 — classroom authz hotfix (F1~F3).
- `31ea9f7` v0.93 — chat bulk invite.

## 다음 후보 (Head 검토 중)

**v0.98**: Classroom×Chat 학급 단위 통합 pair 다이얼로그.
- 선택 (grade, class) → course 생성 (v0.96 aliasFor) + chat space 생성 (v0.97 displayName 검증).
- 사전 조회: `callClassroomList` + `callChatList` 각각 → 두 legacy 확인.
- 결과: per-pair 상태 (course_ok+chat_ok, course_skip+chat_ok, course_fail (chat 미시도), course_ok+chat_fail, ...).
- 재사용: `CourseBulkCreateDialog` / `ChatBulkCreateDialog` 유틸.

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
