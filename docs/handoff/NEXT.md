# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **chat members CRUD v0.92** — chat.members.add · delete callable · Directory API email→userId 리졸버 통합 · AddChatMemberDialog + ChatSpaceMembersDialog 행별 삭제. Chat 도메인 완결.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-members-crud-v92`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4 개.

## 기준 커밋

**Base**: `77c9dc7` (classroom batch create v0.91 merge)

## 지금 할 것 — Chat members.add + delete

### 왜

v0.80 로 chat.members.list 완비. 이제 편집:
- **추가**: Chat API `spaces.members.create` 는 `member.name` 이 `users/{USER_ID}` 형식 요구 (이메일 직접 안됨). Directory API `users.get({userKey: email})` 로 email → userId 리졸브 후 chat 호출.
- **삭제**: `spaces.members.delete({name: 'spaces/AAAA/members/BBBBB'})` — member name 그대로 (조회 시 이미 있음).

Classroom API 는 email 직접 수용 (v0.85 · v0.86) → Directory 리졸버 불필요했음. Chat 은 반드시 리졸버 필요.

Directory client 는 이미 있음 (`packages/functions/src/google/directoryClient.ts:10` `users.get`). Scope `admin.directory.user.readonly` 는 login 에 이미 있음.

**하지 않는 것**:
- Chat bulk 초대 (basic_data 활용) — v0.93+ 별도.
- 자동 배정 (chat.assign · classroom 코스와 동기화) — v0.94+ 별도.
- transfer_owner (Chat 도메인 없음 · classroom v0.94+ 검토).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/chat/membersAdd.ts` — email 입력 → Directory 리졸브 → chat.spaces.members.create
- `packages/functions/src/callable/chat/membersDelete.ts` — member name (spaces/AAA/members/BBB) 그대로 chat.spaces.members.delete
- `packages/functions/tests/chatMembersAdd.test.ts` (시나리오 7~8)
- `packages/functions/tests/chatMembersDelete.test.ts` (시나리오 7)
- `packages/web/src/api/chatMembersAdd.ts` — useMutation
- `packages/web/src/api/chatMembersDelete.ts` — useMutation
- `packages/web/src/routes/admin/AddChatMemberDialog.tsx` — 이메일 입력 · submit → 성공 시 close · error banner
- `packages/web/tests/chatMembersAdd.test.ts` (시나리오 2)
- `packages/web/tests/chatMembersDelete.test.ts` (시나리오 2)
- `packages/web/tests/AddChatMemberDialog.test.tsx` (시나리오 4)

**수정 대상**:
- `packages/functions/src/google/chatClient.ts` — spaces.members.create + delete 인터페이스
- `packages/functions/src/index.ts` — export 2건
- `firebase.json` — rewrites 2건
- `packages/web/src/routes/admin/ChatSpaceMembersDialog.tsx` — 「+ 멤버 추가」 버튼 · 각 행 「삭제」 버튼 · v0.87 패턴 (session reset · 2-step 삭제 · pending lock)

**손대지 마라**:
- chat.list · create · delete · members.list 그대로.
- directoryClient 그대로 (users.get 재사용).
- classroom · basic_data · groups · users · audit 그대로.

### 세부 요구

#### 1. `chatClient.ts` — members.create + delete 인터페이스

```ts
export interface ChatClient {
  spaces: {
    list: ...,
    create: ...,
    delete: ...,
    members: {
      list: ...,
      create: (params: {
        parent: string;                                // 'spaces/AAAA'
        requestBody: {
          member: { name: string; type: 'HUMAN' | 'BOT' };   // name = 'users/USER_ID'
        };
      }) => Promise<{ data: ChatMember }>;
      delete: (params: { name: string }) => Promise<{ data: {} }>;   // name = 'spaces/AAAA/members/BBBBB'
    };
  };
}
```

#### 2. `chat/membersAdd.ts` — Directory 리졸브 + create

Cap `chat.write` · Scopes: `chat.memberships` + `admin.directory.user.readonly`.

```ts
export interface ChatMembersAddRequest {
  spaceName: string;              // 'spaces/AAAA'
  email: string;                  // 사용자 이메일
}

export interface ChatMembersAddResponse {
  member: ChatMember;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
] as const;

const SPACE_NAME_RE = /^spaces\/[A-Za-z0-9_-]+$/;
const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

// 인증 → Cap chat.write → Scopes → spaceName · email 검증 →
//   directory.users.get({ userKey: email }) → userId 획득 →
//   chat.spaces.members.create({ parent: spaceName, requestBody: { member: { name: `users/${userId}`, type: 'HUMAN' } } }) →
//   audit `chat.write` · action 'chat.members.add' · target=`${spaceName}/members/${userId}` · message=`email=${email}`
```

**주의**:
- audit action `chat.members.add` (새 action).
- Directory upstream 404 (email 없음) → `HttpsError not-found` · audit `error` message='directory_user_not_found'.
- Chat upstream 409 (이미 멤버) → 그대로 통과 (mapUpstreamError · unknown or 자체 매핑).
- 두 API 호출 사이 실패 시 partial state: userId 얻었지만 chat 실패 — audit `error` 로 기록.

#### 3. `chat/membersDelete.ts` — 삭제

Cap `chat.write` · Scope `chat.memberships`.

```ts
export interface ChatMembersDeleteRequest {
  memberName: string;             // 'spaces/AAAA/members/BBBBB'
}

export interface ChatMembersDeleteResponse {
  ok: true;
}

const MEMBER_NAME_RE = /^spaces\/[A-Za-z0-9_-]+\/members\/[A-Za-z0-9_-]+$/;

// 형식 검증 후 chat.spaces.members.delete({ name: memberName }) →
//   audit action 'chat.members.delete' · target=memberName
```

**주의**: memberName 은 이미 조회된 전체 경로 · 클라이언트에서 그대로 전달. Directory 리졸버 불필요.

#### 4. functions/index.ts + firebase.json

```ts
export { chatMembersAdd } from './callable/chat/membersAdd.js';
export { chatMembersDelete } from './callable/chat/membersDelete.js';
```

`firebase.json` rewrites 2건.

#### 5. 테스트 (functions)

**`chatMembersAdd.test.ts`** (8 시나리오):
1. 미인증 → denied.
2. 캡 `chat.write` 부족 → denied.
3. 스코프 `chat.memberships` 부족 → denied.
4. 스코프 `admin.directory.user.readonly` 부족 → denied.
5. spaceName 형식 오류 → invalid-argument.
6. email 형식 오류 → invalid-argument.
7. 정상 (mock directory.get → mock chat.members.create) → response.member.name · audit action 'chat.members.add'.
8. directory 404 → HttpsError not-found · audit error.

**`chatMembersDelete.test.ts`** (7 시나리오):
1~5 표준 (auth · cap · scope · format).
6. 정상 → audit action 'chat.members.delete'.
7. upstream 404 → HttpsError not-found.

#### 6. `chatMembersAdd.ts` · `chatMembersDelete.ts` — hooks

useMutation · invalidateQueries `['chat', 'members', spaceName]` (성공 시 자동 새로고침).

#### 7. `AddChatMemberDialog.tsx`

**Props**:
```ts
export interface AddChatMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string;              // 'spaces/AAAA'
  spaceDisplayName?: string;
  onSuccess?: () => void;
}
```

**동작**:
- email input (필수 · email 형식)
- Submit → mutateAsync → 성공 시 close + onSuccess?.().
- Error 배너 (directory 404 등)
- open 되면 form reset.
- pending 중 close 차단.

**data-testid**:
- form: `add-chat-member-form`
- email input: `add-chat-member-email`
- submit: `add-chat-member-submit`
- error: `add-chat-member-error`

#### 8. `ChatSpaceMembersDialog.tsx` — 편집 통합

**추가**:

1. dialog 상단 (테이블 위) 「+ 멤버 추가」 버튼:
```tsx
{spaceName && !isLoading && !isError && (
  <div className="flex justify-end mb-3">
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

2. 각 행에 「삭제」 · v0.87 2-step 확인 패턴 (course-members-delete-btn 참고):
```tsx
<TableCell className="text-right">
  {deleteConfirmName === m.name ? (
    <div className="flex gap-2 justify-end">
      <button
        onClick={() => handleDelete(m.name)}
        disabled={deleteMutation.isPending}
        data-testid={`chat-member-confirm-delete-btn-${m.name}`}
      >
        {deleteMutation.isPending ? '삭제 중...' : '정말 삭제?'}
      </button>
      <button
        onClick={() => setDeleteConfirmName(null)}
        disabled={deleteMutation.isPending}
        data-testid={`chat-member-cancel-delete-btn-${m.name}`}
      >
        취소
      </button>
    </div>
  ) : (
    <button
      onClick={() => setDeleteConfirmName(m.name)}
      disabled={deleteMutation.isPending || anyPending}
      data-testid={`chat-member-delete-btn-${m.name}`}
    >
      삭제
    </button>
  )}
</TableCell>
```

**state 추가**:
```ts
const [addOpen, setAddOpen] = useState(false);
const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
const deleteMutation = useChatMembersDelete();
const anyPending = deleteMutation.isPending;
```

**useEffect** (session reset · v0.87 패턴):
```ts
useEffect(() => {
  if (open && spaceName) {
    setDeleteConfirmName(null);
    deleteMutation.reset?.();
  }
}, [open, spaceName]);
```

**handlers**:
```ts
const handleDelete = async (memberName: string) => {
  try {
    await deleteMutation.mutateAsync({ memberName });
    setDeleteConfirmName(null);
  } catch { /* error banner */ }
};
```

**표 헤더 관리 컬럼 추가** (기존 4 컬럼 → 5):
```tsx
<TableHead className="text-right">관리</TableHead>
```

**AddChatMemberDialog nested**:
```tsx
{spaceName && (
  <AddChatMemberDialog
    open={addOpen}
    onOpenChange={setAddOpen}
    spaceName={spaceName}
    spaceDisplayName={displayName}
  />
)}
```

#### 9. 테스트 (web)

**`chatMembersAdd.test.ts`** (2 신규): 200 · 400.
**`chatMembersDelete.test.ts`** (2 신규): 200 · 404.

**`AddChatMemberDialog.test.tsx`** (4 신규):
1. open=false → 미렌더.
2. email 빈 문자열 → submit disabled.
3. 정상 → callChatMembersAdd 호출.
4. mutation error → error 배너 렌더.

**`ChatSpaceMembersDialog.test.tsx`** (기존 확장 3 신규):
1. 「+ 멤버 추가」 버튼 렌더.
2. 각 행 「삭제」 버튼 렌더 · 클릭 시 2-step 확인 나타남.
3. 「정말 삭제?」 → callChatMembersDelete 호출.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 919 + 신규 28~32 = 947~951 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` 챗방 「멤버」 → 「+ 멤버 추가」 → 이메일 → 성공 → 목록 새로고침
   - 각 멤버 「삭제」 → 「정말 삭제?」 → 실행 → 새로고침
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Chat member add/delete** — 실 계정 · Google Chat 필요.
- **자동 배정 · bulk 초대** — v0.93+ 별도.

### 커밋 규칙

**4 커밋 분리**:
1. `feat(functions): chat.members.add callable (Directory 리졸버) + chatClient.members.create + firebase rewrite`
2. `feat(functions): chat.members.delete callable + chatClient.members.delete + firebase rewrite`
3. `feat(web): chatMembersAdd/Delete API + mutation hooks`
4. `feat(web): AddChatMemberDialog + ChatSpaceMembersDialog 편집 UI (2-step 삭제)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-members-crud-v92`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
