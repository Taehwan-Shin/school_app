# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **chat bulk invite v0.93** — ChatBulkInviteDialog · basic_data grade+class 선택 → 학생 이메일 순차 chatMembersAdd. Classroom bulk invite (v0.88) + v0.89 F2/F3 교훈 패턴 재사용.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-bulk-invite-v93`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `2612324` (chat members CRUD v0.92 merge)

## 지금 할 것 — Chat 학급 일괄 초대

### 왜

v0.92 로 Chat member CRUD 완비. 이제 chat spaces (예: 학급 채팅방) 에 basic_data rosters 로 학생 30~40명 일괄 초대.

Classroom bulk invite (v0.88) 는 courses.students 대상. 이번은 chat.members 대상 — Directory 리졸버 매번 호출 (server-side · v0.92 chatMembersAdd 내부).

**패턴 재사용**:
- v0.88 ClassroomBulkInviteDialog: phase select→preview→running→done
- v0.89 F2 isYearValid + 반 선택 초기화
- v0.89 F3 direct callChatMembersAdd (auto-invalidate 우회 · 종료 시 1회)
- v0.88 isAlreadyMemberError skip 분류

**하지 않는 것**:
- Chat 자동 배정 통합 (classroom + chat pairing) — v0.94+ 별도.
- admin console v2 (역할 관리 UI) — v0.95+ 별도.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/ChatBulkInviteDialog.tsx` — 다이얼로그
- `packages/web/tests/ChatBulkInviteDialog.test.tsx` (시나리오 7~9)

**수정 대상**:
- `packages/web/src/routes/admin/ChatSpaceMembersDialog.tsx` — 「+ 멤버 추가」 옆에 「학급 일괄 초대」 버튼

**손대지 마라**:
- chatMembersAdd callable (재사용 그대로).
- Directory 리졸버 (server-side · 그대로).
- chat.list · create · delete · members.list · basic_data 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `ChatBulkInviteDialog.tsx`

**Props**:
```ts
export interface ChatBulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string;              // 'spaces/AAAA'
  spaceDisplayName?: string;
  onDone?: () => void;
}
```

**Phase state**: `'select' | 'preview' | 'running' | 'done'`

**Hooks**:
- `useBasicDataGet(year, open)` — 학년/반 로드
- `QueryClientContext` — 종료 시 invalidate
- **`useChatMembersAdd` 는 사용 안 함** · `callChatMembersAdd` 직접 import (v0.89 F3 교훈)

**isYearValid + handleYearChange** (v0.88 · v0.89 F2 패턴 그대로 복제):
```ts
function isYearValid(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return false;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200;
}

const handleYearChange = (val: string) => {
  setYearInput(val);
  setSelectedGrade(null);
  setSelectedClass(null);
  if (isYearValid(val)) {
    setSelectedYear(Number.parseInt(val.trim(), 10));
  }
};
```

**isAlreadyMemberError** (v0.88 헬퍼 복제):
```ts
function isAlreadyMemberError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('member exists') ||
    lower.includes('409')
  );
}
```

**Phase: select**
- year input.
- basic_data 로드 후 학년별 반 버튼 렌더 (단일 선택 · v0.88 패턴).
- 선택 시 rosters 학생 이메일 preview.
- 「미리보기」 버튼 (활성: 반 선택 + isYearValid).

**Phase: preview**
- 학생 이메일 리스트 (max-h-48 · overflow-y-auto).
- 학생 수 · 확인 텍스트 input.
- 「초대 실행」 버튼 (활성: 확인 정확).

**Phase: running**
- 순차 `callChatMembersAdd({ spaceName, email })`.
- 각 결과 array push (ok/skipped/failed).
- 409/already member → skip.
- 진행률 bar · close 차단.

**Phase: done**
- ok/skipped/failed 카운트.
- skipped·failed 목록.
- 「확인」 → onOpenChange(false) + queryClient.invalidateQueries(['chat', 'members', spaceName]) + onDone?.().

**testid** (v0.88 패턴 · chat prefix):
- year: `chat-bulk-invite-year-input`
- 반 버튼: `chat-bulk-invite-class-btn-${grade}-${cls}`
- preview 진입: `chat-bulk-invite-preview-btn`
- 미리보기: `chat-bulk-invite-preview`
- 확인 input: `chat-bulk-invite-confirm-input`
- 실행: `chat-bulk-invite-execute-btn`
- running: `chat-bulk-invite-running`
- done: `chat-bulk-invite-done` · skipped: `chat-bulk-invite-skipped` · failed: `chat-bulk-invite-failures`

**Dialog nesting**: ChatSpaceMembersDialog 안에서 열림 · shadcn dialog z-index 자동.

#### 2. `ChatSpaceMembersDialog.tsx` — 「학급 일괄 초대」 버튼 추가

기존 「+ 멤버 추가」 옆에 추가:

```tsx
{spaceName && !isLoading && !isError && (
  <div className="flex justify-end gap-2 mb-3">
    <Button
      variant="secondary"
      onClick={() => setBulkInviteOpen(true)}
      disabled={anyPending}
      data-testid="chat-members-bulk-invite-btn"
    >
      학급 일괄 초대
    </Button>
    <Button
      variant="secondary"
      onClick={() => setAddOpen(true)}
      disabled={anyPending}
      data-testid="chat-members-add-btn"
    >
      + 멤버 추가
    </Button>
  </div>
)}
```

**state 추가**:
```ts
const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
```

**Dialog render**:
```tsx
{spaceName && (
  <ChatBulkInviteDialog
    open={bulkInviteOpen}
    onOpenChange={setBulkInviteOpen}
    spaceName={spaceName}
    spaceDisplayName={displayName}
  />
)}
```

#### 3. 테스트

**`ChatBulkInviteDialog.test.tsx`** (7~9 신규):
1. open=false → 미렌더.
2. year invalid → 반 선택 초기화 · preview 버튼 disabled.
3. 반 선택 → preview 진입 → 학생 리스트 렌더.
4. 확인 텍스트 오류 → 「초대 실행」 disabled.
5. 「초대 실행」 → mock callChatMembersAdd 순차 호출.
6. 이미 멤버 (409) → skipped 분류.
7. failed → failed 리스트 렌더.
8. 종료 시 invalidateQueries 1회 (mock spy).
9. running 중 close 차단.

**`ChatSpaceMembersDialog.test.tsx`** (기존 확장 2 신규):
1. 「학급 일괄 초대」 버튼 렌더.
2. 클릭 시 bulkInviteOpen state 변경.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 947 + 신규 9~11 = 956~958 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` 챗방 「멤버」 → 「학급 일괄 초대」 → 학년/반 선택 → preview → 실행 → 결과.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Chat bulk invite** — 실 계정 · 실 Chat space · rosters 필요.
- **자동 배정** — v0.94+ (classroom+chat pairing).
- **admin console v2** — v0.95+ (역할 관리 UI).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): ChatBulkInviteDialog (basic_data → chat.members 순차 초대)`
2. `feat(web): ChatSpaceMembersDialog 「학급 일괄 초대」 버튼 통합`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-bulk-invite-v93`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
