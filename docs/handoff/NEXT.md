# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **chat.delete v0.79** — 신규 callable + DeleteChatSpaceDialog + ChatSpacesTable 행별 「삭제」 버튼.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-delete-v79`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `ca9570f` (chat.create v0.78)

## 지금 할 것 — chat.delete + Dialog

### 왜

v0.78 로 chat.create 완비. admin 이 실수로 만든 챗방 · 폐기 챗방 정리 필요.

**하지 않는 것**: chat.assign · basic_data 활용 (v0.80). 일괄 삭제 (별도 slice).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/chat/delete.ts` — 신규 callable
- `packages/functions/tests/chatDelete.test.ts` — 시나리오 5~6
- `packages/web/src/api/chatDelete.ts` — fetch + useMutation
- `packages/web/src/routes/admin/DeleteChatSpaceDialog.tsx` — 확인 다이얼로그
- `packages/web/tests/chatDelete.test.ts` — 시나리오 2
- `packages/web/tests/DeleteChatSpaceDialog.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/functions/src/google/chatClient.ts` — `spaces.delete` 인터페이스 추가
- `packages/functions/src/index.ts` — export `chatDelete`
- `firebase.json` — hosting rewrite `/api/chatDelete`
- `packages/web/src/routes/admin/ChatSpacesTable.tsx` — 관리 컬럼 「삭제」 버튼

**손대지 마라**:
- chat.list · chat.create · CreateChatSpaceDialog — 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `chatClient.ts` — spaces.delete 인터페이스

기존 `ChatClient` 에 추가:
```ts
delete: (params: { name: string }) => Promise<{ data: {} }>;
```

**주의**: Chat API `spaces.delete` 는 space name (path) 사용 (예: `spaces/AAAA`).

#### 2. `chat/delete.ts` — callable

기존 `groups/delete.ts` 참고:

```ts
export interface ChatDeleteRequest {
  name: string;   // "spaces/AAAA"
}

export interface ChatDeleteResponse {
  deleted: true;
  name: string;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
] as const;

// 인증 · Cap 'chat.delete' · Scope · denied audit (chat/list.ts 패턴)

try {
  const data = request.data as Partial<ChatDeleteRequest> | undefined;
  if (!data?.name || typeof data.name !== 'string' || !data.name.startsWith('spaces/')) {
    throw new HttpsError('invalid-argument', 'invalid_space_name');
  }
  const name = data.name.trim();

  const chat = getChatClient(user.googleAccessToken);
  await chat.spaces.delete({ name });

  await writeAudit({
    actor: user.email, role: user.role,
    action: 'chat.delete', target: name,
    request_id: requestId, result: 'ok',
    message: `deleted chat space ${name}`,
  });

  return { deleted: true, name };
} catch (err) {
  // error audit
  ...
}
```

**주의**:
- Cap `chat.delete` (chat.write 아님 · 삭제는 별도 cap).
- audit target = space name.
- 잘못된 name 형식 (spaces/ 로 시작 안 함) → invalid-argument.

#### 3. functions/index.ts + firebase.json

```ts
export { chatDelete } from './callable/chat/delete.js';
```

`firebase.json` rewrites 배열에 `/api/chatDelete` 추가.

#### 4. 테스트

**functions `chatDelete.test.ts`** (5~6 시나리오):
1. 미인증 → denied audit.
2. 캡 부족 → denied audit.
3. 스코프 부족 → denied audit.
4. name 없음/형식 오류 → invalid-argument · error audit.
5. 정상 → mock chat.spaces.delete 호출 확인 · ok audit.
6. Google API 실패 (예: not found) → error audit.

#### 5. `chatDelete.ts` — hook

```ts
export interface ChatDeleteRequest { name: string; }
export interface ChatDeleteResponse { deleted: true; name: string; }

export async function callChatDelete(data: ChatDeleteRequest): Promise<ChatDeleteResponse> {
  // fetch to /chatDelete 패턴 (chatCreate 참고)
}

export function useDeleteChatSpace() {
  const queryClient = useQueryClient();
  return useMutation<ChatDeleteResponse, Error, ChatDeleteRequest>({
    mutationFn: (data) => callChatDelete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'list'] });
    },
  });
}
```

#### 6. `DeleteChatSpaceDialog.tsx` — 확인 다이얼로그

`DeleteGroupDialog.tsx` 패턴 참고:

**Props**:
```ts
export interface DeleteChatSpaceTarget {
  name: string;                // "spaces/AAAA"
  displayName?: string;
}
export interface DeleteChatSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: DeleteChatSpaceTarget | null;
}
```

**확인 방식**: 사용자가 displayName (있으면) 또는 name 을 정확히 타이핑해서 confirm.
```ts
const confirmPhrase = space?.displayName || space?.name || '';
const [confirmText, setConfirmText] = useState('');
const isConfirmed = space ? confirmText.trim() === confirmPhrase : false;
```

**submit**:
```ts
await callChatDelete({ name: space.name });
// 성공 시 다이얼로그 닫기
```

**UI** (기존 DeleteGroupDialog 패턴):
- Title: 「챗방 삭제 확인」 (state-danger)
- Description: 「이 작업은 되돌릴 수 없습니다」
- Info: 이름 · space name (font-mono)
- 확인 입력: displayName 정확히 타이핑
- 버튼: 취소 / 삭제 실행 (isConfirmed 시 enabled)

data-testid: `delete-chat-confirm-input`, `delete-chat-submit`, `delete-chat-error`.

#### 7. `ChatSpacesTable.tsx` — 관리 컬럼 「삭제」 버튼

기존 4 컬럼 (이름 · 타입 · ID · 생성 시각) → 5 컬럼 (마지막 「관리」):
```tsx
<TableHead className="text-right">관리</TableHead>
...
<TableCell className="text-right">
  <button
    type="button"
    onClick={() => setDeleteTarget({ name: s.name, displayName: s.displayName })}
    data-testid={`chat-delete-btn-${s.name}`}
    className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
  >
    삭제
  </button>
</TableCell>
```

**state 추가**: `const [deleteTarget, setDeleteTarget] = useState<DeleteChatSpaceTarget | null>(null);`

**다이얼로그 렌더** (컴포넌트 맨 아래):
```tsx
<DeleteChatSpaceDialog
  open={!!deleteTarget}
  onOpenChange={(o) => !o && setDeleteTarget(null)}
  space={deleteTarget}
/>
```

#### 8. 테스트

**web `chatDelete.test.ts`** (2 신규):
1. 200 응답 → hook `data.deleted === true`.
2. 404 응답 → hook throws.

**web `DeleteChatSpaceDialog.test.tsx`** (4 신규):
1. `open=false` → 미렌더.
2. `open=true` space 있음 → 정보 표시 · confirm 버튼 disabled (빈 입력).
3. 정확히 타이핑 → confirm enabled.
4. submit → mutation 호출 · 성공 시 `onOpenChange(false)`.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 681 + 신규 11~13 = 692~694 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` 각 행 「삭제」 버튼 → 다이얼로그 → 이름 확인 타이핑 → 삭제 → 표 자동 새로고침
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 chat.space 삭제 (사용자 확인 필요)** — 프로덕션 검증.
- **되돌리기** — Google Chat 은 삭제된 space 복구 불가 (Workspace admin 콘솔에서도).

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): chat.delete callable + chatClient spaces.delete + firebase rewrite`
2. `feat(web): chatDelete API + useDeleteChatSpace mutation hook`
3. `feat(web): DeleteChatSpaceDialog + ChatSpacesTable 관리 컬럼 「삭제」 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-delete-v79`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
