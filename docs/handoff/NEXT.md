# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex hotfix v0.81** — spaceName 정규식 강화 + Google upstream 401/403 → HttpsError denied 매핑 + ChatSpaceMembersDialog 스크롤.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/chat-members-codex-v81`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `7b6256a` (chat.members.list v0.80 merge)

## 지금 할 것 — Codex P1 + P2 hotfix

### 왜

v0.80 (chat.members.list) 자동 감사에서 Codex 가 2 건 실패 지적.

**P1** (functions):
- `membersList.ts:73` — `spaceName.startsWith('spaces/')` 만 검사 → `spaces/`, `spaces/AAA/members/BBB` 등 허용됨.
- `membersList.ts:107` — Google upstream 401/403 Gaxios 오류를 `HttpsError` 로 재-throw 하면 `code` 가 `unknown` 이 되어 catch 상단의 `isDenied` 분기가 못 잡음 → audit `result: error` 로 기록. 실제로는 `denied` 여야 함.

**P2** (web):
- `ChatSpaceMembersDialog.tsx:39` — 표에 max-height / overflow-y-auto 없음 → 큰 space 는 viewport 밖 행 · 닫기 버튼 접근 불가.

**하지 않는 것**: Classroom slice (v0.82+). 다른 도메인.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/callable/chat/membersList.ts` — spaceName 정규식 + upstream status 매핑
- `packages/functions/tests/chatMembersList.test.ts` — 시나리오 추가: 잘못된 형식 3~4 종 · Google 401 upstream → denied
- `packages/web/src/routes/admin/ChatSpaceMembersDialog.tsx` — 표 컨테이너 max-h + overflow-y-auto
- `packages/web/tests/ChatSpaceMembersDialog.test.tsx` — 시나리오 추가: 큰 목록 스크롤 컨테이너 존재 확인

**손대지 마라**:
- chatClient.ts 는 그대로 (인터페이스 안정).
- 다른 chat callable 은 그대로 (list · create · delete 는 별도 range 검증 이미 있음 · 하지만 이번 슬라이스는 chat.members 만).
- 다른 도메인.

### 세부 요구

#### 1. `membersList.ts` — spaceName 정규식 + upstream status 매핑

**정규식**:
```ts
const SPACE_NAME_RE = /^spaces\/[A-Za-z0-9_-]+$/;
// ...
if (!data?.spaceName || typeof data.spaceName !== 'string' || !SPACE_NAME_RE.test(data.spaceName.trim())) {
  throw new HttpsError('invalid-argument', 'invalid_space_name');
}
```

허용: `spaces/AAAA` · `spaces/AA_BB-11`.
거절: 빈 문자열 · `spaces/` · `spaces/AAA/members/BBB` · `foo` · trailing slash · 공백 포함.

**upstream status 매핑**:

catch 안에서 err 이 Google Gaxios (has `.response.status`) 인 경우:
- 401 · 403 → `HttpsError('permission-denied', 'google_upstream_denied: ' + message)` → audit `denied`
- 404 → `HttpsError('not-found', 'google_upstream_not_found: ' + message)` → audit `error`
- 429 · 5xx → `HttpsError('unavailable', 'google_upstream_unavailable: ' + message)` → audit `error`
- 그 외 · non-Gaxios → 현재 로직 유지 (`HttpsError('unknown', message)`)

```ts
function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  // gaxios has err.response.status; also err.code sometimes numeric
  const status: number | undefined =
    (err as any)?.response?.status ??
    (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
  const msg = (err as Error).message ?? 'unknown';
  if (status === 401 || status === 403) {
    return new HttpsError('permission-denied', `google_upstream_denied: ${msg}`);
  }
  if (status === 404) {
    return new HttpsError('not-found', `google_upstream_not_found: ${msg}`);
  }
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
  }
  return new HttpsError('unknown', msg);
}
```

catch:
```ts
} catch (err) {
  const mapped = mapUpstreamError(err);
  const isDenied = mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
  await writeAudit({
    actor: user.email, role: user.role,
    action: 'chat.read', target: targetName,
    request_id: requestId,
    result: isDenied ? 'denied' : 'error',
    message: mapped.message,
  });
  throw mapped;
}
```

**주의**: 기존 `invalid-argument` (regex 실패) 는 이미 HttpsError 라 mapUpstreamError 첫 줄에서 그대로 throw · audit `error` 로 기록 (invalid input 이라 denied 아님).

#### 2. `chatMembersList.test.ts` — 시나리오 확장

이미 있는 6개 유지. 추가 3~4개:

7. spaceName 형식 오류 - `spaces/` (뒤에 이름 없음) → invalid-argument.
8. spaceName 형식 오류 - `spaces/AAA/members/BBB` (중첩 경로) → invalid-argument.
9. spaceName 형식 오류 - `spaces/AA BB` (공백 포함) → invalid-argument.
10. Google upstream 401 mock → HttpsError code `permission-denied` · audit `denied`.
11. Google upstream 429 mock → HttpsError code `unavailable` · audit `error`.

**mock 방법**:
```ts
const err: any = new Error('quota');
err.response = { status: 429 };
mockChatMembersList.mockRejectedValueOnce(err);
```

#### 3. `ChatSpaceMembersDialog.tsx` — 스크롤 컨테이너

현재 구조:
```tsx
{!showLoading && !isError && data && (
  <Table>...
  </Table>
)}
```

수정 후:
```tsx
{!showLoading && !isError && data && (
  <div className="max-h-96 overflow-y-auto border border-border-subtle" data-testid="chat-members-scroll-container">
    <Table>
      <TableHeader className="sticky top-0 bg-canvas">
        ...
      </TableHeader>
      <TableBody>...</TableBody>
    </Table>
  </div>
)}
```

**주의**:
- `max-h-96` (24rem · 384px) — 대략 8~10 행. 대화 UI 관례.
- `sticky top-0` header — 스크롤 중에도 컬럼 라벨 유지.
- Dialog 자체는 `max-w-2xl` 유지 (가로 그대로).

#### 4. `ChatSpaceMembersDialog.test.tsx` — 시나리오 추가

이미 있는 4개 유지. 추가 1개:

5. `open=true` + spaceName 있음 + members 50건 mock → `chat-members-scroll-container` testid 존재 확인.

```tsx
it('renders scroll container when members list is populated', async () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    name: `spaces/AAA/members/M${i}`,
    member: { name: `users/${i}`, type: 'HUMAN' },
    role: 'ROLE_MEMBER',
    state: 'JOINED',
  }));
  vi.mocked(callChatMembersList).mockResolvedValueOnce({ members: many });
  render(<ChatSpaceMembersDialog open spaceName="spaces/AAA" onOpenChange={vi.fn()} />, { wrapper });
  const container = await screen.findByTestId('chat-members-scroll-container');
  expect(container.className).toMatch(/overflow-y-auto/);
  expect(container.className).toMatch(/max-h-/);
});
```

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 715 + 신규 5~6 = 720~721 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/chat` → 챗방 「멤버」 → 큰 목록도 dialog 밖으로 넘치지 않음 (스크롤 발생).
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Chat 401 오류** — 실 계정 · 실 API 필요.
- **classroom slice** — v0.82 별도.

### 커밋 규칙

**2 커밋 분리**:
1. `fix(functions): chat.members.list spaceName regex + upstream 401/403 → denied mapping`
2. `fix(web): ChatSpaceMembersDialog scroll container (max-h-96 + sticky header)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/chat-members-codex-v81`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
