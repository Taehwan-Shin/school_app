# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **chat.members.list v0.80** — 신규 callable + ChatSpaceMembersDialog + ChatSpacesTable 「멤버」 버튼. 멤버 관리는 v0.81+ (email→userId 해결 필요).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-members-list-v80`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `034af36` (chat.delete v0.79)

## 지금 할 것 — chat.members.list + 멤버 보기 Dialog

### 왜

v0.77·v0.78·v0.79 로 chat list · create · delete 완비. 이제 각 space 안 멤버 확인 필요. Chat API `spaces.members.list` 활용.

**하지 않는 것**: chat.members.add · delete (v0.81+ · Chat API 는 member.name 이 `users/{USER_ID}` 형식 요구 → Directory API 로 email→id 해결 slice 별도 필요). basic_data 자동 배정 (v0.82+).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/chat/membersList.ts` — 신규 callable
- `packages/functions/tests/chatMembersList.test.ts` — 시나리오 5~6
- `packages/web/src/api/chatMembersList.ts` — fetch + useQuery hook
- `packages/web/src/routes/admin/ChatSpaceMembersDialog.tsx` — 멤버 목록 다이얼로그
- `packages/web/tests/chatMembersList.test.ts` — 시나리오 2
- `packages/web/tests/ChatSpaceMembersDialog.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/functions/src/google/chatClient.ts` — `spaces.members.list` 인터페이스 추가
- `packages/functions/src/index.ts` — export `chatMembersList`
- `firebase.json` — hosting rewrite `/api/chatMembersList`
- `packages/web/src/routes/admin/ChatSpacesTable.tsx` — 관리 컬럼 「멤버」 버튼 추가

**손대지 마라**:
- chat.list · create · delete · CreateChatSpaceDialog · DeleteChatSpaceDialog — 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `chatClient.ts` — spaces.members.list 인터페이스

```ts
export interface ChatMember {
  name: string;                // "spaces/AAAA/members/BBBBB"
  member?: {
    name: string;              // "users/USER_ID" · 또는 "groups/GROUP_ID"
    type?: string;             // 'HUMAN' · 'BOT'
    displayName?: string;
  };
  role?: string;               // 'ROLE_MEMBER' · 'ROLE_MANAGER'
  state?: string;              // 'JOINED' · 'INVITED'
  createTime?: string;
}

export interface ChatMembersListResponse {
  memberships?: ChatMember[];
  nextPageToken?: string;
}

// ChatClient 에 추가:
spaces: {
  ...,
  members: {
    list: (params: { parent: string; pageSize?: number; pageToken?: string }) => Promise<{ data: ChatMembersListResponse }>;
  };
};
```

**주의**: googleapis chat v1 은 `spaces.members.list` 지원.

#### 2. `chat/membersList.ts` — callable

```ts
export interface ChatMembersListRequest {
  spaceName: string;           // "spaces/AAAA"
}

export interface ChatMembersListResponse {
  members: ChatMember[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.memberships',
] as const;

// 인증 · Cap 'chat.read' · Scope · denied audit

try {
  const data = request.data as Partial<ChatMembersListRequest> | undefined;
  if (!data?.spaceName || typeof data.spaceName !== 'string' || !data.spaceName.startsWith('spaces/')) {
    throw new HttpsError('invalid-argument', 'invalid_space_name');
  }
  const spaceName = data.spaceName.trim();

  const chat = getChatClient(user.googleAccessToken);
  const results: ChatMember[] = [];
  let pageToken: string | undefined;
  do {
    const res = await chat.spaces.members.list({ parent: spaceName, pageSize: 100, pageToken });
    results.push(...(res.data.memberships ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  await writeAudit({
    actor: user.email, role: user.role,
    action: 'chat.read', target: spaceName,
    request_id: requestId, result: 'ok',
    message: `listed ${results.length} members for space ${spaceName}`,
  });

  return { members: results };
} catch (err) {
  // error audit
  ...
}
```

**주의**:
- Cap `chat.read` (list callable 과 동일).
- Scope `chat.memberships` (chat.spaces 아님 · 멤버 전용 스코프).
- pagination 순회.

#### 3. functions/index.ts + firebase.json

```ts
export { chatMembersList } from './callable/chat/membersList.js';
```

`firebase.json` rewrites 배열에 `/api/chatMembersList` 추가.

#### 4. 테스트

**functions `chatMembersList.test.ts`** (5~6 시나리오):
1. 미인증 → denied audit.
2. 캡 부족 → denied audit.
3. 스코프 부족 (chat.memberships) → denied audit.
4. spaceName 형식 오류 → invalid-argument · error audit.
5. 정상 (mock chat.spaces.members.list) → response.members.length 정확.
6. pagination 2 페이지 → 모두 반환.

#### 5. `chatMembersList.ts` — hook

```ts
export interface UseChatMembersListOptions {
  spaceName: string;
}

export function useChatMembersList(spaceName: string | null, enabled = true) {
  return useQuery<ChatMembersListResponse, Error>({
    queryKey: ['chat', 'members', spaceName],
    queryFn: () => callChatMembersList({ spaceName: spaceName! }),
    enabled: enabled && !!spaceName,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

#### 6. `ChatSpaceMembersDialog.tsx` — 멤버 다이얼로그

`Dialog` 사용, 표 형태로 멤버 나열:

**Props**:
```ts
export interface ChatSpaceMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string | null;    // "spaces/AAAA"
  displayName?: string;
}
```

**구조**:
```tsx
const { data, isLoading, isError, error } = useChatMembersList(spaceName, open);

<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>{displayName || spaceName} 멤버</DialogTitle>
      <DialogDescription>
        <span className="font-mono">{spaceName}</span> 에 속한 멤버 목록.
      </DialogDescription>
    </DialogHeader>
    {isLoading && <div data-testid="chat-members-loading">로딩 중...</div>}
    {isError && <div data-testid="chat-members-error">오류: {error?.message}</div>}
    {!isLoading && !isError && data && (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름/식별자</TableHead>
            <TableHead>타입</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.members.map((m) => (
            <TableRow key={m.name} data-testid={`chat-member-row-${m.name}`}>
              <TableCell className="font-mono text-small text-fg-primary">
                {m.member?.displayName || m.member?.name || m.name}
              </TableCell>
              <TableCell className="text-small text-fg-secondary">{m.member?.type || '-'}</TableCell>
              <TableCell className="text-small text-fg-secondary">{m.role || '-'}</TableCell>
              <TableCell className="text-small text-fg-secondary">{m.state || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
    <DialogFooter>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>닫기</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**주의**:
- Chat API 는 사용자 이메일 안 반환 (privacy). `member.name` 은 `users/USER_ID` 형식 · displayName 은 있으면 표시.
- 편집 액션 없음 (v0.81+ 별도).

#### 7. `ChatSpacesTable.tsx` — 관리 컬럼 「멤버」 버튼

기존 5 컬럼 (이름·타입·ID·생성 시각·관리 [삭제]) → 관리 컬럼 에 「멤버」 추가:
```tsx
<TableCell className="text-right">
  <button
    type="button"
    onClick={() => setMembersTarget({ name: s.name, displayName: s.displayName })}
    data-testid={`chat-members-btn-${s.name}`}
    className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong mr-3"
  >
    멤버
  </button>
  <button ... 삭제 ...>삭제</button>
</TableCell>
```

**state 추가**: `const [membersTarget, setMembersTarget] = useState<{name: string; displayName?: string} | null>(null);`

**다이얼로그 렌더**:
```tsx
<ChatSpaceMembersDialog
  open={!!membersTarget}
  onOpenChange={(o) => !o && setMembersTarget(null)}
  spaceName={membersTarget?.name ?? null}
  displayName={membersTarget?.displayName}
/>
```

#### 8. 테스트

**web `chatMembersList.test.ts`** (2 신규):
1. 200 응답 → hook `data.members`.
2. 401 응답 → hook throws.

**web `ChatSpaceMembersDialog.test.tsx`** (4 신규):
1. `open=false` → 미렌더.
2. `open=true` + spaceName null → 로딩 상태.
3. `open=true` + spaceName 있음 → members mock 결과 렌더.
4. 「닫기」 → `onOpenChange(false)`.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 699 + 신규 11~13 = 710~712 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` 각 행 「멤버」 버튼 → 다이얼로그 → 멤버 목록 표시
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **member.name 을 email 로 변환** — Chat API 는 email 안 반환 · Directory API 로 users/{id}→email 조회 필요 · 별도 slice.
- **멤버 add/remove** — v0.81+ (email→userId 해결 slice 필요).
- **자동 배정 (basic_data 활용)** — v0.82+.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): chat.members.list callable + chatClient members.list + firebase rewrite`
2. `feat(web): chatMembersList API + useChatMembersList hook`
3. `feat(web): ChatSpaceMembersDialog + ChatSpacesTable 「멤버」 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-members-list-v80`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
