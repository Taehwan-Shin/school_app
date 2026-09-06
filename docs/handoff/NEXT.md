# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **chat.create v0.78** — 신규 callable + CreateChatSpaceDialog + ChatSpacesTable 「+ 챗방 추가」 버튼.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-create-v78`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `e455f5a` (Chat UI v0.77)

## 지금 할 것 — chat.create + Dialog

### 왜

v0.76·v0.77 로 chat list 완비. 이제 admin 이 새 챗방 (space) 생성할 수 있어야 함.

**하지 않는 것**: chat.delete (v0.79). chat.assign (v0.80). GROUP_CHAT · DIRECT_MESSAGE 생성 (사용자 이니시에이티브, 이번은 SPACE 만). basic_data 자동 생성 (v0.80+).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/chat/create.ts` — 신규 callable
- `packages/functions/tests/chatCreate.test.ts` — 시나리오 5~6
- `packages/web/src/api/chatCreate.ts` — fetch + useMutation
- `packages/web/src/routes/admin/CreateChatSpaceDialog.tsx` — 이름 input Dialog
- `packages/web/tests/chatCreate.test.ts` — 시나리오 2
- `packages/web/tests/CreateChatSpaceDialog.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/functions/src/google/chatClient.ts` — `spaces.create` 인터페이스 추가
- `packages/functions/src/index.ts` — export `chatCreate`
- `firebase.json` — hosting rewrite `/api/chatCreate`
- `packages/web/src/routes/admin/ChatSpacesTable.tsx` — 「+ 챗방 추가」 버튼 + Dialog state

**손대지 마라**:
- 다른 callable · basic_data · classroom.
- chat.list 자체.

### 세부 요구

#### 1. `chatClient.ts` — spaces.create 인터페이스

기존 `ChatClient` interface 확장:
```ts
export interface ChatClient {
  spaces: {
    list: (params?: { pageSize?: number; pageToken?: string; filter?: string }) => Promise<{ data: ChatSpacesListResponse }>;
    create: (params: { requestBody: { displayName: string; spaceType: 'SPACE' } }) => Promise<{ data: ChatSpace }>;
  };
}
```

**주의**: googleapis chat v1 은 `spaces.create` 지원 · 실행 시 사용자의 chat.spaces 스코프 필요.

#### 2. `chat/create.ts` — callable

기존 `chat/list.ts` 참고. 다른 점:
- 입력: `{ displayName: string, spaceType?: 'SPACE' }`
- 응답: `{ space: ChatSpace }`
- Cap: `chat.write`
- Scope: `chat.spaces`

```ts
export interface ChatCreateRequest {
  displayName: string;
  spaceType?: 'SPACE';   // 이번은 SPACE 만 (default)
}

export interface ChatCreateResponse {
  space: ChatSpace;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
] as const;

// 인증 · Cap · Scope (chat/list.ts 패턴 · denied audit)

try {
  const data = request.data as Partial<ChatCreateRequest> | undefined;
  if (!data?.displayName || typeof data.displayName !== 'string' || data.displayName.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'display_name_required');
  }
  const displayName = data.displayName.trim();

  const chat = getChatClient(user.googleAccessToken);
  const res = await chat.spaces.create({
    requestBody: {
      displayName,
      spaceType: 'SPACE',
    },
  });

  await writeAudit({
    actor: user.email, role: user.role,
    action: 'chat.write', target: res.data.name || '*',
    request_id: requestId, result: 'ok',
    message: `created chat space ${res.data.name} (${displayName})`,
  });

  return { space: res.data };
} catch (err) {
  // error audit (target 은 displayName 사용 가능)
  ...
}
```

**주의**:
- displayName trim 후 non-empty 검증.
- audit target 은 실제 생성된 space name (예: `spaces/AAAA`) 사용 · 실패 시 requested displayName 사용.

#### 3. functions/index.ts + firebase.json

```ts
export { chatCreate } from './callable/chat/create.js';
```

`firebase.json` rewrites 배열에 `/api/chatCreate` 추가.

#### 4. 테스트

**functions `chatCreate.test.ts`** (5~6 시나리오):
1. 미인증 → denied audit.
2. 캡 부족 (teacher) → denied audit.
3. 스코프 부족 → denied audit.
4. displayName 없음/빈 문자열 → invalid-argument · error audit.
5. 정상 → mock chat.spaces.create 응답 반환 · ok audit (target=spaces/...).
6. Google API 실패 → error audit.

#### 5. `chatCreate.ts` — fetch + mutation hook

`groupsCreate.ts` 참고:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface ChatCreateRequest {
  displayName: string;
}

export interface ChatCreateResponse {
  space: { name: string; displayName?: string; ... };
}

export async function callChatCreate(data: ChatCreateRequest): Promise<ChatCreateResponse> {
  // fetch to /chatCreate 패턴 (chatList 참고)
}

export function useCreateChatSpace() {
  const queryClient = useQueryClient();
  return useMutation<ChatCreateResponse, Error, ChatCreateRequest>({
    mutationFn: (data) => callChatCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'list'] });
    },
  });
}
```

#### 6. `CreateChatSpaceDialog.tsx` — 이름 input Dialog

`CreateGroupDialog.tsx` 참고. 간단 구조:

```tsx
export interface CreateChatSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChatSpaceDialog({ open, onOpenChange }: CreateChatSpaceDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutateAsync: createChat, isPending, error: mutationError } = useCreateChatSpace();

  useEffect(() => {
    if (open) {
      setDisplayName('');
      setValidationError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setValidationError('챗방 이름이 필요합니다.');
      return;
    }
    try {
      await createChat({ displayName: trimmed });
      onOpenChange(false);
    } catch { /* mutationError 표시 */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>새 챗방 생성</DialogTitle>
            <DialogDescription>Google Chat 스페이스를 새로 만듭니다.</DialogDescription>
          </DialogHeader>
          <div>
            <label>이름</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 2026년 1학년 A반"
              data-testid="create-chat-name-input"
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              required
            />
          </div>
          {validationError && (
            <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="create-chat-validation-error">
              {validationError}
            </div>
          )}
          {mutationError && (
            <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="create-chat-error">
              생성 실패: {mutationError.message}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={isPending} data-testid="create-chat-submit">
              {isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

#### 7. `ChatSpacesTable.tsx` — 「+ 챗방 추가」 버튼

기존 loading/error/empty/table 구조 유지 · 헤더 액션 로우 추가:
```tsx
export function ChatSpacesTable() {
  const { data, isLoading, isError, error } = useChatList();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-small text-fg-secondary">
          {data?.spaces ? `${data.spaces.length}개 챗방` : '챗방 목록'}
        </p>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="chat-create-btn">
          + 챗방 추가
        </Button>
      </div>
      {/* 기존 loading/error/empty/table 그대로 */}
      <CreateChatSpaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
```

#### 8. 테스트

**web `chatCreate.test.ts`** (2 신규):
1. 200 응답 → hook `data.space`.
2. 400 응답 → hook throws.

**web `CreateChatSpaceDialog.test.tsx`** (4 신규):
1. `open=false` → 컨텐츠 렌더 안 됨.
2. `open=true` → input 렌더 · 초기값 빈 문자열.
3. 빈 이름 submit → validation error.
4. 유효 이름 submit → mutation 호출 · 성공 시 `onOpenChange(false)`.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 664 + 신규 11~13 = 675~677 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` 「+ 챗방 추가」 버튼 → 다이얼로그 → 이름 입력 → 생성 → 표 자동 새로고침
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Chat API 응답** (실 chat.space 생성) — 사용자 확인 필요.
- **spaceType SPACE 외** (GROUP_CHAT · DIRECT_MESSAGE) — 사용자 이니시에이티브 · 별도 slice.
- **created space 이름 중복 등 오류** — Google API 응답 그대로 표시.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): chat.create callable + chatClient spaces.create + firebase rewrite`
2. `feat(web): chatCreate API + useCreateChatSpace mutation hook`
3. `feat(web): CreateChatSpaceDialog + ChatSpacesTable 「+ 챗방 추가」 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-create-v78`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
