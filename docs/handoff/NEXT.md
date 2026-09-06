# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Chat UI 프론트엔드 v0.77** — 「/admin/chat」 라우트 + ChatSpacesTable + useChatList hook + nav 활성화.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-ui-v77`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `9404ce2` (chat.list callable v0.76)

## 지금 할 것 — Chat 목록 UI

### 왜

v0.76 로 backend chat.list callable 배포 · bliss00 재로그인 완료 (2026-09-06 09:51 KST). 이제 프론트 UI 로 admin 이 chat spaces 볼 수 있어야 함.

**하지 않는 것**: chat.create · chat.delete · chat.assign (별도 slice v0.78~v0.80). classroom UI (v0.81~ 별도).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/api/chatList.ts` — fetch + useQuery hook
- `packages/web/src/routes/admin/chat.tsx` — AdminChatPage (AppShell + ChatSpacesTable)
- `packages/web/src/routes/admin/ChatSpacesTable.tsx` — 표 컴포넌트
- `packages/web/tests/chatList.test.ts` — API 시나리오 2
- `packages/web/tests/ChatSpacesTable.test.tsx` — UI 시나리오 4

**수정 대상**:
- `packages/web/src/App.tsx` — 신규 라우트 (admin + super_admin 각각)
- `packages/web/src/components/shell/nav-items.ts` — 「챗방」 disabled 제거 (admin + super_admin)
- `packages/web/tests/RoleGuard.test.tsx` (있으면) — 새 라우트 회귀

**손대지 마라**:
- 백엔드 (chat.list callable 그대로).
- 다른 도메인 · Firestore.

### 세부 요구

#### 1. `chatList.ts` — API + hook

`groupsList.ts` 패턴 참고:
```ts
import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface ChatSpaceItem {
  name: string;                // "spaces/AAAA"
  displayName?: string;
  spaceType?: string;          // 'SPACE' · 'GROUP_CHAT' · 'DIRECT_MESSAGE'
  spaceHistoryState?: string;
  externalUserAllowed?: boolean;
  createTime?: string;
}

export interface ChatListResponse {
  spaces: ChatSpaceItem[];
}

export async function callChatList(): Promise<ChatListResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/chatList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/chatList`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,
      'X-Google-Scopes': 'https://www.googleapis.com/auth/chat.spaces',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as ChatListResponse;
}

export function useChatList(enabled = true) {
  return useQuery<ChatListResponse, Error>({
    queryKey: ['chat', 'list'],
    queryFn: () => callChatList(),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

#### 2. `ChatSpacesTable.tsx` — 표 컴포넌트

`GroupsTable.tsx` (간단 버전) 참고. 검색·CSV 는 v0.78+ 후보. 이번은 기본 표:

```tsx
import { useChatList } from '../../api/chatList';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

export function ChatSpacesTable() {
  const { data, isLoading, isError, error } = useChatList();

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="chat-spaces-loading">
          챗방 목록을 불러오는 중...
        </div>
      )}
      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="chat-spaces-error">
          챗방 목록을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}
      {!isLoading && !isError && (!data?.spaces || data.spaces.length === 0) && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="chat-spaces-empty">
          속한 챗방이 없습니다.
        </div>
      )}
      {data?.spaces && data.spaces.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>타입</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>생성 시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.spaces.map((s) => (
                <TableRow key={s.name} data-testid={`chat-space-row-${s.name}`}>
                  <TableCell className="text-fg-primary">
                    {s.displayName || <span className="text-fg-muted">(무제)</span>}
                  </TableCell>
                  <TableCell className="text-small text-fg-secondary">{s.spaceType || '-'}</TableCell>
                  <TableCell className="font-mono text-small text-fg-secondary">{s.name}</TableCell>
                  <TableCell className="font-mono text-small text-fg-secondary whitespace-nowrap">
                    {s.createTime ? new Date(s.createTime).toLocaleString('ko-KR') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

**주의**:
- Chat API 응답의 `name` 은 `spaces/AAAA` 형식 (path-like). 그대로 표시.
- `spaceType` 은 SPACE · GROUP_CHAT · DIRECT_MESSAGE — 그대로 표시 (v0.78+ 에서 filter chip 등 추가 가능).
- 「무제」 는 displayName 없는 DIRECT_MESSAGE 등.

#### 3. `chat.tsx` — AdminChatPage

기존 `admin/index.tsx` 패턴:
```tsx
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { ChatSpacesTable } from './ChatSpacesTable';

export function AdminChatPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="챗방">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Chat 스페이스</h2>
            <p className="text-small text-fg-secondary mt-1">
              내가 멤버로 속한 챗방 목록입니다. 생성·삭제·멤버 관리는 다음 슬라이스에서 추가됩니다.
            </p>
          </div>
          <ChatSpacesTable />
        </section>
      </div>
    </AppShell>
  );
}
```

#### 4. `App.tsx` — 라우트 추가

admin + super_admin 각각 (nav-items 에 두 곳 등록되어 있음):
```tsx
<Route path="/admin/chat" element={<AdminChatPage />} />
<Route path="/super_admin/chat" element={<AdminChatPage />} />
```

*(같은 컴포넌트 재사용 · role 은 useAuth 로 자동 감지.)*

**import 추가**: `import { AdminChatPage } from './routes/admin/chat';`

#### 5. `nav-items.ts` — 챗방 disabled 제거

기존 (`packages/web/src/components/shell/nav-items.ts:19`, 27):
```ts
{ label: '챗방', to: '/super_admin/chat', disabled: true },
// ...
{ label: '챗방', to: '/admin/chat', disabled: true },
```

변경:
```ts
{ label: '챗방', to: '/super_admin/chat' },
// ...
{ label: '챗방', to: '/admin/chat' },
```

#### 6. 테스트

**web `chatList.test.ts`** (2 신규):
1. 200 응답 → hook `data.spaces`.
2. 401 → hook throws.

**web `ChatSpacesTable.test.tsx`** (4 신규):
1. 로딩 → `chat-spaces-loading`.
2. 오류 → `chat-spaces-error`.
3. 빈 목록 → `chat-spaces-empty`.
4. spaces 2 개 → 표 렌더 · 각 row testid `chat-space-row-{name}`.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 658 + 신규 6 = 664 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` 접속 → 챗방 목록 (bliss00 님이 속한 것)
   - 나비게이션 「챗방」 링크 활성화
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **spaceType 필터 chip** — v0.78+ 후보.
- **검색·CSV export** — v0.78+ 후보.
- **admin 스코프** (chat.admin.spaces) 승격 — 사용자가 admin 이지만 workspace 전체 chat 보려면 admin scope 필요. 이번은 사용자 스코프 로 자기 space 만.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): chatList API + useChatList hook`
2. `feat(web): ChatSpacesTable 컴포넌트`
3. `feat(web): /admin/chat + /super_admin/chat 라우트 + nav 활성화 + AdminChatPage`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-ui-v77`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
