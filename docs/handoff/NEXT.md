# NEXT.md — 일꾼 오더 파일 (v0.97)

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **ChatBulkCreateDialog v0.97**.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만.
- **삭제가 추가보다 많으면 멈추고 보고.**
- `git add -A` 금지. `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-bulk-create-v97`.
- 지금 코드와 다르면 다르다고 보고.
- 「판정 불가」 허용.
- 근거는 `파일:줄번호`, 항목당 한 줄.
- **이모지 금지.**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest.

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개 (다이얼로그 / 진입점).

## 기준 커밋

**Base**: `ac57877` (main, v0.96 병합 뒤 문서 갱신).

## 지금 할 것 — Chat 스페이스 학급 일괄 생성

### 왜

지금 admin 은 학급 하나씩 `CreateChatSpaceDialog` 로 Chat 스페이스를 만든다. `basicData` 로 학급 구조를 이미 관리하고 있고, v0.91 (`CourseBulkCreateDialog`) 이 같은 패턴을 코스에 적용한 상태. 사용자 확정 방향 (a) 「Classroom 코스와 Chat 스페이스의 학급 단위 자동 통합 생성/배정」 의 첫 절반: Chat 쪽 bulk 를 갖춘다.

**하지 않는 것**:
- Classroom×Chat 통합 pair 다이얼로그 — v0.98+ 별도.
- chatCreate callable 시그니처 변경.
- Chat 스페이스 멤버 자동 초대 — v0.93 (`ChatBulkInviteDialog`) 이 이미 담당. 병용은 사용자가 각각 실행.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/ChatBulkCreateDialog.tsx` — 다이얼로그.
- `packages/web/tests/ChatBulkCreateDialog.test.tsx` — 시나리오 8~11 (아래 참조).

**수정 대상**:
- `packages/web/src/routes/admin/ChatSpacesTable.tsx` — `학급 일괄 생성` 진입 버튼 (기존 `학급 일괄 초대` 버튼 옆). ChatBulkCreateDialog 오픈 상태 관리.

**손대지 마라**:
- `chatCreate` · `chatList` 시그니처.
- v0.96 (`CourseBulkCreateDialog`) 파일 직접 수정 — 필요한 유틸은 export 상태에서 재사용 하되 dialog 자체는 별개.
- Google Chat 도메인 (server-side).
- 다른 UI 라우팅.

### 세부 요구

#### 1. Phase 흐름

`CourseBulkCreateDialog` 와 같은 4 단계: `select → preview → running → done`.

#### 2. 선택 state — v0.96 F5 패턴

`useState<Map<string, { grade: number; cls: string }>>`, key 는 `keyOf(grade, cls)` — 이 helper 는 `CourseBulkCreateDialog` 에서 export 된 것을 재사용한다 (import 로 처리). 문자열 split 금지.

#### 3. displayName 규칙

`courseName(year, grade, cls) = '2026학년도 1학년 1반'` 을 재사용. Chat space displayName 은 이 문자열 그대로. Classroom 과 시각적으로 pair 되도록.

#### 4. 사전 대조 — legacy skip (v0.96 F8 패턴)

- `handleExecute` loop 진입 전 `callChatList()` 한 번 호출.
- `list.spaces` 를 순회해 `displayName` 이 있는 원소만 `Set<string>` 에 add. key: `JSON.stringify([displayName])` (또는 그냥 displayName 문자열 — 단일 필드라 stringify 이득이 크지 않으니 raw 로도 무방하나, `CourseBulkCreateDialog` 와 시각적 일관성을 위해 `JSON.stringify` 권장).
- 각 선택 항목에 대해 매치 시 `kind: skipped`, `message: legacy_duplicate` 로 분류.
- **list 실패는 fail-closed** (v0.96 F10 패턴) — Chat 은 alias idempotency 가 없어서 사전 대조가 유일한 duplicate 방어. list 실패 시 전체 항목을 `kind: failed`, `message: legacy_list_failed: <err.message>` 로 표시하고 `create` 호출 없이 `done` 전환.

#### 5. handleExecute 본체

```typescript
for each selected item:
  displayName = courseName(year, item.grade, item.cls)
  if legacyKeys.has(JSON.stringify([displayName])):
    push skipped/legacy_duplicate
    continue
  try:
    res = await callChatCreate({ displayName, spaceType: 'SPACE' })
    push ok, spaceId: res.space.name
  catch err:
    kind = isAlreadyExistsError(err.message) ? 'skipped' : 'failed'
    push { kind, message: err.message }
```

`isAlreadyExistsError` 는 `CourseBulkCreateDialog` 에서 export 된 것 재사용.

#### 6. 결과 렌더

`CourseBulkCreateDialog` 와 같은 형식: ok/skipped/failed 카운터 + skipped 목록 + failed 목록. `data-testid` 는 `bulk-create-chat-*` prefix (충돌 방지).

#### 7. 진입점

`ChatSpacesTable.tsx` 의 기존 `학급 일괄 초대` 버튼 옆에 `학급 일괄 생성` 버튼 추가. 열기/닫기 상태는 새 `useState<boolean>` 로. `onDone` 콜백은 `useChatList` 무효화.

### 테스트 (Vitest + RTL)

`packages/web/tests/ChatBulkCreateDialog.test.tsx` 신규. 시나리오:

- **시나리오 1**: 선택 → preview 진입 → confirm 매치 → running → done. `callChatCreate` 가 각 항목에 대해 1 회, `displayName` 이 `courseName` 결과와 일치.
- **시나리오 2**: legacy `callChatList` 응답에 이미 있는 displayName → 해당 항목 skipped/legacy_duplicate, create 호출 없음.
- **시나리오 3**: `callChatList` reject → 전체 항목 failed/legacy_list_failed, create 호출 0회. done 페이지에 legacy_list_failed 표시.
- **시나리오 4**: `-` 나 한국어 반 이름 (`1반`, `A-1`) 이 displayName 에 그대로 전달 (F5 회귀 방지 유틸 재사용 확인).

### 관문 · 커밋

1. TypeScript build (shared → functions → web).
2. ESLint (functions — web 은 config 상 lint 스크립트 없어도 됨).
3. Vitest — shared · functions · web.
4. Web production build.

각 관문 통과 확인 뒤:
- 커밋 1: `feat(web): ChatBulkCreateDialog (basic_data → chat.spaces.create 순차 생성)`
- 커밋 2: `feat(web): ChatSpacesTable 「학급 일괄 생성」 버튼 통합`

커밋 메시지는 이유·근거 파일 포함. 이모지 금지. 작업 브랜치는 `feat/chat-bulk-create-v97` — origin push 는 Head 가 지시할 때.

### 완료 보고

Head 스레드에 다음 4줄 형식으로 보고:

```
브랜치: feat/chat-bulk-create-v97
HEAD: <hash>
관문: shared X + functions Y + web Z = N unit · lint · build 통과
판정 불가: <있으면 이유, 없으면 "없음">
```
