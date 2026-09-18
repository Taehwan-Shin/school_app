# NEXT.md - 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.152 병합 완료** (`0d579fd`) - AccountsTable JSON 내보내기 (로드맵 B-6) · 1 라운드 Codex 통과.
> **Antigravity 위임 17번째 시도 성공**: v0.136, v0.137, v0.138, v0.139, v0.140, v0.141, v0.142, v0.143, v0.144, v0.145, v0.146, v0.147, v0.148, v0.149, v0.150 에 이어 v0.152 마무리 사이클 정상 응답 및 성공 완료 (17번째 성공, 위임 오더 18번째).

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `0d579fd` v0.152 - AccountsTable JSON 내보내기 (로드맵 B-6) · CSV 옆 「JSON 내보내기」 버튼 · payload (exportedAt, filters, totalCount, users) · users 필드 (email, firstName, lastName, orgUnitPath, isAdmin, isSuspended) · 파일명 accounts-YYYY-MM-DD.json · sortedFilteredUsers 반영 · 결과 0 이면 disabled · 3 회귀 테스트 (`tests/AccountsTable.test.tsx`) · 웹 920 (+3) · lint clean · 서버 무변경 · 1 라운드 Codex 통과.
- `b00342e` v0.150 - 반 챗방 학생 자동 초대 (원본 assignMembersToChatRooms 대응) · AutoInviteStudentsToChatSpacesDialog (5-phase) · callChatList displayName 매칭 · matched vs unmatched 분리 · rosters 미설정/빈 반 skip · 「초대 N」 정확 입력 · 순차 add · already member skip 분류 · 실패 격리 · BasicDataPanel 「반 챗방 자동 초대」 버튼 · 1 라운드 Codex 통과.
- `f68837f` v0.149 - 반 그룹 명단 밖 자동 제거 (원본 assignGroups 제외 워크플로우) · AutoRemoveNonRosterMembersDialog (5-phase) · fetchAllGroupMembers 페이지 넘김 · rosters diff · MEMBER 기본/OWNER·MANAGER 보호 toggle · 개별 체크박스 · 「제거 N」 정확 입력 · 순차 delete · 실패 격리 · F131 fix (rosters 미설정 반 스캔 skip) · BasicDataPanel 「명단 밖 자동 제거」 버튼 · 2 라운드 Codex 통과.
- `559ac45` v0.148 - classroom 상세 페이지 학생/교사 명단 CSV 내보내기 (원본 명단 확인 대응) · CourseMembersPanel 「CSV 내보내기 (N)」 버튼 · 이름/이메일/userId 컬럼 · UTF-8 BOM · 파일명 <코스이름>-<교사|학생>-<YYYY-MM-DD>.csv · 파일시스템 금지 문자 sanitize · items 0 or anyPending 시 disabled · 1 라운드 Codex 통과.
- `6894567` v0.147 - OU 목록 로드 실패 재발 대응 (bliss00 v0.146 후에도 리포트) · reauthorizeWithGoogle helper (clearSession+signOut+signIn forceConsent) · CreateUserDialog 「Google 재로그인」 버튼 · 3 라운드 Codex 통과.
- `479b075` v0.146 - CreateUserDialog OU 목록 에러 상세 + login scope 누락 fix (bliss00 실 버그 리포트) · login scope 2개 추가 · 에러 상세/재시도 버튼 · bliss00 재동의 필수 · 2 라운드 Codex 통과.
- `2f66aa0` v0.145 - 나이스 CSV 일괄 클래스룸 생성 + 초대 (원본 createAndInviteClassrooms 웹 포팅) · 3 CSV drop/preview/실행 · papaparse · 1 라운드 Codex 통과.
- `e88730b` v0.144 - CreateUserDialog 클래스룸 UX 개선 (bliss00 실 사용 피드백) · 2컬럼 grid · 이름순 정렬 + 검색 · 선택 유지 + 1 라운드 Codex 통과.
- `f370ea2` v0.143 - auditLogList filters hook 재구성 · exhaustive-deps 마지막 4 warning 해소 (13→0 완주) + 2 라운드 Codex 감사 + F127.
- `d4932e9` v0.142 - exhaustive-deps missing dep 3건 실제 fix (7 → 4) + 2 라운드 Codex 감사 + F126.
- `0c8905e` v0.141 - exhaustive-deps logical expression 6건 fix (13 → 7) + 2 라운드 Codex 감사 + F125.
- `52e41bf` v0.140 - web ESLint 관문 (Codex v0.138 소프트 권고 반영) + 2 라운드 Codex 감사 + F124.

## 다음 후보 (Head 자율 실행 예정)

`docs/handoff/ROADMAP.md` Phase 5/6 남은 항목:
- **AuditLogTable 무한 스크롤** - 로드맵 B-7.
- **super_admin 대시보드 확장** - 로드맵 B-8.
- **반 챗방 명단 밖 자동 제거** - chat member API 가 userId 반환이라 usersList extend 필요 (서버 변경 slice).
- **BatchCreateUsersDialog + 클래스룸 배정** - 로드맵 B-5.
- **부서 그룹 명단 밖 자동 제거** - v0.149 대칭.
- **전입생 매크로** - A-1, 도메인 규칙 필요.
- **전입생 계정 개별 생성 UX 세부 확장** - `laterAccountSetup` 의 「학번/반 자동 배정 + 그룹 자동 추가」 매크로 (v0.119 는 기본 폼만 커버).
- **계정 삭제 안내 메일** - SendGrid 등 3rd party 이메일 서비스 필요.
- **첫 audit fallback 검증** - v0.133 sink 배포 완료 · 실 fallback 발생 후 BigQuery smoke test 필요.
- **(d)** 사용자 지시 그 외.

## 안티그래비티 위임 template (bliss00 승인 2026-09-11)

Head 는 신규 slice + Codex hotfix 담당, 안티그래비티는 매 슬라이스 마무리
사이클을 담당하는 하이브리드 운영. **다음 슬라이스 (v0.120+) 부터 아래 template
로 위임 시도**. 현 v0.119 는 이미 Head 로 마무리.

**오더 예시** — v0.XX 감사 통과 뒤 실행할 마무리 사이클:

```
브랜치: feat/<slug>-vN.NN (HEAD `<sha>`)

1. main 워크트리 (`/Users/bliss00/.buzz/REPOS/school_app`) 에서:
   git fetch origin && git merge --no-ff origin/feat/<slug>-vN.NN -m "<merge msg>"
   git push origin main
2. `firebase deploy --only hosting,functions --project school-app-5a636`
3. 4 문서 갱신 (지정된 diff):
   - STATUS.md: 최근 병합 테이블 상단에 vN.NN row 추가, 열린 항목 vN.NN → vN.NN+1
   - NEXT.md: v병합 완료 표기 + 최근 병합 목록 갱신
   - ROADMAP.md: 필요 시 Phase 항목 재분류
   - project_notes.md: append-only 로 「## YYYY-MM-DD · vN.NN <제목>」 섹션 (커밋 표 · 라운드 표 · 배운 것 · 다음 세션)
4. git commit + push (docs): "docs: vN.NN 병합 반영 + STATUS/project_notes/NEXT/ROADMAP 갱신"
5. 채널 공지: 내용을 Write 로 `/tmp/vN.NN_announce.md` 에 담고 `cat /tmp/vN.NN_announce.md | buzz messages send --channel <위임 스레드가 발생한 채널 UUID> --content -` 로 발행 (stdin 파이프). **주의**: `--content @/tmp/xxx.md` 는 CLI 미지원 — 리터럴 문자열로 발행됨 (2026-09-13 v0.137 학습). reply-to 없이 top-level.
6. **완료 후 delegation reply 스레드에 반드시 [채널 공지 event id] 를 붙여 보고** (2026-09-13 v0.136 학습 — Antigravity 가 announce 를 발행해도 relay 전파 지연으로 Head 에서 즉시 안 보임, event id 를 명시하면 Head 가 중복 발행을 피할 수 있음).

**제약**: main 에 직접 커밋 금지 (문서 갱신은 예외). Codex 감사 응답은 Head 만
파싱. Antigravity 는 오더 template 밖 판단 금지. **채널 UUID 는 위임 오더에서
Head 가 명시** (school_app_02 vs school_app_03 등 여러 채널 존재 가능).
```

Head 는 안티그래비티 결과를 리뷰하고 부족한 부분만 재작성.

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
