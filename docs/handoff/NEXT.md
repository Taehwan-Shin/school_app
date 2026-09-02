# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **삭제 성공 후 목록 이동 v0.33** — DeleteUserDialog · DeleteGroupDialog 에 optional `onSuccess` 추가 + 상세 페이지에서 삭제 성공 시 목록으로 자동 이동. 매우 작은 슬라이스.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/delete-nav-v33`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `3e3cc16` (상세 페이지 인라인 액션 v0.32)

## 지금 할 것 — 삭제 성공 시 목록으로 이동

### 왜

v0.32 로 UserDetailPage · GroupDetailPage 에 삭제 버튼을 인라인 액션으로 노출했다. 삭제 성공 시 캐시가 무효화되고 상세 페이지에서 대상 사용자가 사라져 「사용자를 찾을 수 없습니다」 상태로 폴백 (`packages/web/src/routes/admin/userDetail.tsx:36-40`). 사용자는 스스로 뒤로 가야 함. UX 개선: 삭제 성공 시 자동으로 목록 (`/admin` 또는 `/admin/groups`) 으로 이동.

**하지 않는 것**: 정지·비밀번호·편집 후 nav (해당 케이스는 페이지 유지가 맞다 — 사용자는 이어서 다른 액션 할 수 있음). 다이얼로그 자체 리팩터. 새 API.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/DeleteUserDialog.tsx` — Props 에 `onSuccess?: () => void` 추가 + 삭제 성공 시 호출
- `packages/web/src/routes/admin/DeleteGroupDialog.tsx` — Props 에 `onSuccess?: () => void` 추가 + 삭제 성공 시 호출
- `packages/web/src/routes/admin/userDetail.tsx` — DeleteUserDialog 에 `onSuccess={() => navigate('/admin')}` 전달
- `packages/web/src/routes/admin/groupDetail.tsx` — DeleteGroupDialog 에 `onSuccess={() => navigate('/admin/groups')}` 전달
- `packages/web/tests/DeleteUserDialog.test.tsx` — 시나리오 1 신규 (onSuccess 호출 확인)
- `packages/web/tests/DeleteGroupDialog.test.tsx` — 시나리오 1 신규 (onSuccess 호출 확인)

**손대지 마라**:
- `useDeleteUser` · `useDeleteGroup` hook — 그대로.
- AccountsTable · GroupsTable 에서의 삭제 다이얼로그 사용 — `onSuccess` 는 optional 이라 그대로 안 넘겨도 backward compatible.
- 다른 다이얼로그 (편집·정지·비밀번호) — 그대로.

### 세부 요구

#### 1. `DeleteUserDialog.tsx` — onSuccess prop

**Props 확장**:
```ts
export interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: DeleteUserTarget | null;
  onSuccess?: () => void;
}
```

**로직 수정** — `handleDelete` 안의 `await deleteUser(...)` 다음:
```ts
try {
  await deleteUser({ primaryEmail: user.email.trim() });
  handleClose(false);
  onSuccess?.();   // 성공 시 callback (nav 등)
} catch {
  // 기존 그대로
}
```

주의: `handleClose(false)` 다음에 `onSuccess?.()` 호출 순서 유지 — 다이얼로그가 먼저 닫혀야 nav 후 잔여 상태 없음.

#### 2. `DeleteGroupDialog.tsx` — onSuccess prop

동일 패턴:
```ts
export interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DeleteGroupTarget | null;
  onSuccess?: () => void;
}
```

`handleDelete` 안:
```ts
try {
  await deleteGroup({ email: group.email.trim() });
  handleClose(false);
  onSuccess?.();
} catch { ... }
```

#### 3. `userDetail.tsx` — 삭제 후 nav

`DeleteUserDialog` 렌더링 부분:
```tsx
{deleteTarget && (
  <DeleteUserDialog
    open={!!deleteTarget}
    onOpenChange={(o) => !o && setDeleteTarget(null)}
    user={deleteTarget}
    onSuccess={() => navigate('/admin')}
  />
)}
```

`navigate` 는 이미 import 되어 있음 (`packages/web/src/routes/admin/userDetail.tsx:2`, `useNavigate`).

#### 4. `groupDetail.tsx` — 삭제 후 nav

```tsx
{deleteTarget && (
  <DeleteGroupDialog
    open={!!deleteTarget}
    onOpenChange={(o) => !o && setDeleteTarget(null)}
    group={deleteTarget}
    onSuccess={() => navigate('/admin/groups')}
  />
)}
```

#### 5. 테스트

**web `DeleteUserDialog.test.tsx`** (1 신규 시나리오):
- `onSuccess` 콜백이 mutation 성공 후 호출되는지 확인.
- Mock `useDeleteUser` mutateAsync resolve → `onSuccess` mock 이 호출됨.
- 기존 시나리오 5 는 회귀 유지 (onSuccess 없어도 정상).

**web `DeleteGroupDialog.test.tsx`** (1 신규 시나리오):
- 동일 패턴 (mock 성공 → onSuccess 호출 확인).

기존 UserDetailPage · GroupDetailPage 테스트에는 `onSuccess` mock 시나리오 추가 강제 없음 (다이얼로그 렌더만 확인, 성공 후 nav 는 이 슬라이스 밖 회귀).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 454 + 신규 2 = 456 근처.
5. `pnpm -r test:emu` — 이전 43 유지.
6. dev 서버 확인:
   - `/admin/users/{email}` 삭제 → 성공 시 `/admin` 으로 이동
   - `/admin/groups/{email}` 삭제 → 성공 시 `/admin/groups` 로 이동
   - AccountsTable · GroupsTable 에서 삭제 → 페이지 유지 (백워드 호환 확인)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **삭제 실패 시 처리** — 실패 시 `onSuccess` 미호출 (기존 catch 블록 그대로) — 다이얼로그에서 오류 표시.
- **감사 로그 자동 표시** — 이미 백엔드에서 기록됨.
- **뒤로 가기 히스토리** — `navigate('/admin')` 이 push 함. 사용자가 뒤로 가면 상세 페이지 (없는 사용자) 로 돌아감. `navigate('/admin', { replace: true })` 로 변경할지 판단 여지 — 이 슬라이스에서는 기본 push 유지.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): DeleteUserDialog onSuccess prop + UserDetailPage 삭제 후 목록 이동`
2. `feat(web): DeleteGroupDialog onSuccess prop + GroupDetailPage 삭제 후 목록 이동`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/delete-nav-v33`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
