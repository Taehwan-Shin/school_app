# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **chat 도메인 첫 슬라이스 v0.76** — 로그인 스코프 4 개 확장 (chat + classroom) + chat.list callable + chatClient helper.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/chat-list-v76`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `32af45d` (Codex 5차 P13+P14 v0.75)

## 지금 할 것 — chat.list callable + login 스코프 확장

### 왜

DESIGN v1 의 chat + classroom 도메인 개시. bliss00 님이 Google Cloud Console 에서 Chat + Classroom API 활성화 완료 (2026-09-06). 이제:
1. 로그인 스코프 에 chat.spaces · chat.memberships · classroom.courses · classroom.rosters **한번에 4 개 모두 추가** (재로그인 한 번만)
2. Backend chat.list callable (첫 chat 도메인 read)
3. chatClient helper (directoryClient 패턴)

**하지 않는 것**: chat.list 프론트 UI (v0.77 별도). 다른 chat/classroom callable (별도 slice). service account · domain-wide delegation (앱 안 씀).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/google/chatClient.ts` — Google Chat API 클라이언트 팩토리 (directoryClient 패턴)
- `packages/functions/src/callable/chat/list.ts` — chat.spaces.list wrapper
- `packages/functions/tests/chatList.test.ts` — 시나리오 5~6

**수정 대상**:
- `packages/web/src/lib/auth.tsx` — GOOGLE_LOGIN_SCOPES 에 4 스코프 추가
- `packages/web/tests/auth.test.ts` — 스코프 개수 assertion (7 → 11)
- `packages/functions/src/index.ts` — export `chatList`
- `firebase.json` — hosting rewrite `/api/chatList`

**손대지 마라**:
- 다른 callable · shared · Firestore.
- directoryClient · groupsList 등.
- classroom 관련 (chat 만).

### 세부 요구

#### 1. 로그인 스코프 확장

기존 (`packages/web/src/lib/auth.tsx:34-42`):
```ts
export const GOOGLE_LOGIN_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member',
  'https://www.googleapis.com/auth/admin.directory.user.security',
] as const;
```

변경 — 4 스코프 추가:
```ts
export const GOOGLE_LOGIN_SCOPES = [
  ...(위 7 그대로),
  'https://www.googleapis.com/auth/chat.spaces',           // chat.list · chat.create · chat.delete
  'https://www.googleapis.com/auth/chat.memberships',      // chat.assign · 멤버 관리
  'https://www.googleapis.com/auth/classroom.courses',     // classroom.list · CRUD · rename · archive
  'https://www.googleapis.com/auth/classroom.rosters',     // roster (학생·교사) 관리
] as const;
```

**주의**:
- 4 스코프 모두 한 번에 추가 → 재로그인 한 번만 필요 (chat + classroom 통합).
- 기존 auth 테스트 (스코프 7개 assertion) 는 11 개로 조정.

#### 2. `chatClient.ts` — Google Chat 클라이언트

`directoryClient.ts` 패턴:
```ts
import { google } from 'googleapis';

export interface ChatSpace {
  name: string;              // "spaces/AAAA"
  displayName?: string;
  spaceType?: string;        // 'SPACE' · 'GROUP_CHAT' · 'DIRECT_MESSAGE'
  spaceHistoryState?: string;
  externalUserAllowed?: boolean;
  createTime?: string;       // ISO
}

export interface ChatSpacesListResponse {
  spaces?: ChatSpace[];
  nextPageToken?: string;
}

export interface ChatClient {
  spaces: {
    list: (params?: { pageSize?: number; pageToken?: string; filter?: string }) => Promise<{ data: ChatSpacesListResponse }>;
    // 향후 create · delete · get 등 추가
  };
}

export function getChatClient(accessToken: string): ChatClient {
  // isEmulatorContext + stub 은 이번 slice 밖 (실 API 로만)
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const chat = google.chat({ version: 'v1', auth });
  return chat as unknown as ChatClient;
}
```

**주의**:
- googleapis package 는 이미 프로젝트에 있음 (directoryClient 가 사용).
- 스코프: `chat.spaces` (readonly 은 별도 스코프 없음, spaces 는 read/write 통합).

#### 3. `chat/list.ts` — callable

기존 `groups/list.ts` 패턴 참고. 다른 점:
- 응답: `{ spaces: ChatSpace[] }`
- 페이지네이션: pageToken 순회
- Cap: `chat.read`
- Scope: `chat.spaces`

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient, type ChatSpace } from '../../google/chatClient.js';

export interface ChatListRequest {}

export interface ChatListResponse {
  spaces: ChatSpace[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
] as const;

// readHeader 헬퍼 등 기존 패턴 그대로

export const chatList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatListResponse> => {
    // 인증 · Cap · Scope (denied audit 패턴 · groups/list.ts 그대로)
    // ...

    try {
      const chat = getChatClient(user.googleAccessToken);
      const results: ChatSpace[] = [];
      let pageToken: string | undefined;
      do {
        const res = await chat.spaces.list({ pageSize: 100, pageToken });
        results.push(...(res.data.spaces ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      await writeAudit({
        actor: user.email, role: user.role,
        action: 'chat.read', target: '*',
        request_id: requestId, result: 'ok',
        message: `listed ${results.length} chat spaces`,
      });

      return { spaces: results };
    } catch (err) {
      // error audit
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
```

**주의**:
- Cap `chat.read` 는 이미 shared/capabilities.ts 에 등록됨.
- 첫 chat callable → firebase deploy 시 신규 Cloud Run + IAM 자동 부여 (org policy override).

#### 4. `functions/index.ts` + `firebase.json`

```ts
export { chatList } from './callable/chat/list.js';
```

`firebase.json` rewrites 배열에 `/api/chatList` 추가.

#### 5. 테스트

**functions `chatList.test.ts`** (5~6 시나리오):
1. 미인증 → denied audit.
2. 캡 부족 (teacher) → denied audit.
3. 스코프 부족 (chat.spaces 없음) → denied audit.
4. 정상 (mock chat.spaces.list 3 spaces 반환) → response.spaces.length === 3.
5. 페이지네이션 (2 페이지) → 모두 반환.
6. 실 API 오류 → error audit.

Mock 은 `chatClient` 를 `vi.mock` 처리 (directoryClient 패턴 참고).

**web `auth.test.ts`** — 스코프 개수 assertion 조정:
```ts
expect(addScopeMock).toHaveBeenCalledTimes(11);   // 기존 7 → 11
```

기존 7 개 각 스코프 순서 assertion + 신규 4 개 assertion 추가.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과 (packages/functions/dist/callable/chat/list.js 생성).
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 650 + 신규 6~8 = 656~658 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 로그인 재시도 시 새 스코프 4 개 프롬프트 (chat.spaces · chat.memberships · classroom.courses · classroom.rosters)
   - chat.list 는 실 API 호출 · 사용자가 재로그인 안 하면 스코프 부족 오류 (정상)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Chat API 응답** — bliss00 님 확인 필요.
- **spaceType 필터링** (SPACE 만? GROUP_CHAT · DIRECT_MESSAGE 포함?) — 이번 slice 는 전체.
- **admin 스코프 (chat.admin.spaces) vs 사용자 스코프 (chat.spaces)** — 이번은 사용자 스코프. admin 이 자기 space 만 보임. 부족 시 admin 스코프 승격은 별도 slice.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): 로그인 스코프 4개 확장 (chat + classroom 통합)`
2. `feat(functions): chatClient helper (Google Chat v1)`
3. `feat(functions): chat.list callable + hosting rewrite`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/chat-list-v76`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
