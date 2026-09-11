# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> **v0.126 병합 대기** — 감사 액션별 위젯 정확 count aggregation (Firestore count() 병렬 per-action) · Codex 감사 요청 예정.

## 최근 병합 (참고, 상세는 `project_notes.md`)

- `6025fe1` v0.125 — AccountsTable 「필터 초기화」 button (v0.112 대칭) + F101/F102.
- `963495c` v0.124 — BulkSuspendDialog F99/F100 대칭 적용 (v0.123b 마무리).
- `75eac51` v0.123 — BulkRestoreDialog (AccountsTable 「선택 복구」, BulkSuspend 대칭) + F99/F100.
- `6f925f8` v0.122 — SuperAdminPage 액션별 위젯 window breakdown (오늘/이번 주/이번 달).
- `5aef31f` v0.121 — orgunits.insert 신규 OU 생성 UI (F98 audit backup + Cloud Logging fallback).

## 다음 후보 (Head 자율 실행 예정)

`docs/handoff/ROADMAP.md` Phase 5/6 남은 항목:
- **전입생 계정 개별 생성 UX 개선** — `laterAccountSetup` 포팅 (Phase 5).
- **클래스룸 소유자 이관 UI** — v0.116 서버는 있으나 UI 미완.
- **audit_log durable sink 인프라** — v0.116 F78 잔재. 사용자 조치 필요.
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
5. 채널 공지: `buzz messages send --channel cfef52ba-5b47-4a4a-a70e-d604f73fe89c` 로 병합/배포/관문/교훈 요약. reply-to 없이 top-level.

**제약**: main 에 직접 커밋 금지 (문서 갱신은 예외). Codex 감사 응답은 Head 만
파싱. Antigravity 는 오더 template 밖 판단 금지.
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
