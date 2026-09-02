# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **상세 페이지 인라인 액션 v0.32** — UserDetailPage · GroupDetailPage 정보 카드에 편집·정지·비밀번호·삭제 (사용자) / 편집·삭제 (그룹) 버튼 추가. 새 API 없음.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/detail-actions-v32`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `a7ca8ce` (그룹 멤버 역할 변경 v0.31)

## 지금 할 것 — 상세 페이지 인라인 액션

### 왜

현재 사용자·그룹 상세 페이지 (`/admin/users/:email`, `/admin/groups/:email`) 는 정보만 보여준다. 편집·정지 하려면 뒤로 가서 표에서 다시 찾아야 한다. AccountsTable · GroupsTable 는 이미 각 행에 액션 버튼 4·2 개 있으니 (`packages/web/src/routes/admin/AccountsTable.tsx:252-330`, `packages/web/src/routes/admin/GroupsTable.tsx:225-250`), 동일 패턴을 상세 페이지 정보 카드 헤더에 옮기면 된다. 다이얼로그는 이미 모두 존재 (`EditUserDialog`, `SuspendUserDialog`, `ResetPasswordDialog`, `DeleteUserDialog`, `EditGroupDialog`, `DeleteGroupDialog`) — 재사용만.

**하지 않는 것**: 새 다이얼로그. 새 API. 백엔드 변경. 다른 라우트. UI_SYSTEM 이외 커스텀 색.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/userDetail.tsx` — 정보 카드 헤더 액션 4 버튼 + 4 다이얼로그 통합
- `packages/web/src/routes/admin/groupDetail.tsx` — 정보 카드 헤더 액션 2 버튼 + 2 다이얼로그 통합
- `packages/web/tests/UserDetailPage.test.tsx` — 액션 버튼 렌더/클릭 시나리오 3
- `packages/web/tests/GroupDetailPage.test.tsx` — 액션 버튼 렌더/클릭 시나리오 2

**손대지 마라**:
- 기존 다이얼로그 (`EditUserDialog`, `SuspendUserDialog`, `ResetPasswordDialog`, `DeleteUserDialog`, `EditGroupDialog`, `DeleteGroupDialog`) — 그대로.
- AccountsTable · GroupsTable — 그대로.
- 백엔드 · middleware — 그대로.
- UserAuditTrail · UserGroups · GroupAuditTrail · MembersTable — 그대로.

### 세부 요구

#### 1. `userDetail.tsx` — 인라인 액션 4 버튼

**Imports 추가**:
```ts
import { useState } from 'react';
import { EditUserDialog, type EditUserTarget } from './EditUserDialog';
import { SuspendUserDialog, type SuspendUserTarget } from './SuspendUserDialog';
import { ResetPasswordDialog, type ResetPasswordTarget } from './ResetPasswordDialog';
import { DeleteUserDialog, type DeleteUserTarget } from './DeleteUserDialog';
```

**state**:
```ts
const [editTarget, setEditTarget] = useState<EditUserTarget | null>(null);
const [suspendTarget, setSuspendTarget] = useState<SuspendUserTarget | null>(null);
const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(null);
const [deleteTarget, setDeleteTarget] = useState<DeleteUserTarget | null>(null);
```

**self 판정**:
```ts
const { user: currentAuthUser } = useAuth();
const isSelf =
  Boolean(currentAuthUser?.email) &&
  user?.email.toLowerCase() === currentAuthUser?.email?.toLowerCase();
```
(`useAuth` 이미 import 되어 있음; `role` 만 쓰던 것을 `user, role` 로 확장.)

**정보 카드 헤더** — 기존 `<h2>사용자 정보</h2>` 를 flex 로 감싸고 액션 버튼을 오른쪽에:

```tsx
<div className="flex justify-between items-center">
  <h2 className="text-h2 font-semibold text-fg-primary">사용자 정보</h2>
  {user && (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setEditTarget({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgUnitPath: user.orgUnitPath || '/',
        })}
        data-testid={`user-detail-edit-${user.email}`}
        className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        편집
      </button>
      <span className="text-fg-muted text-small" aria-hidden="true">·</span>
      <button
        type="button"
        disabled={isSelf}
        title={isSelf ? '자기 계정 비밀번호는 여기서 재설정할 수 없습니다' : '비밀번호 재설정'}
        onClick={() => setResetTarget({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })}
        data-testid={`user-detail-reset-${user.email}`}
        className={isSelf ? '...muted-cursor-not-allowed...' : '...primary-link...'}
      >비밀번호</button>
      <span className="text-fg-muted text-small" aria-hidden="true">·</span>
      <button ... 정지 ...>정지</button>
      <span className="text-fg-muted text-small" aria-hidden="true">·</span>
      <button ... 삭제 ...>삭제</button>
    </div>
  )}
</div>
```

- 정지·삭제 도 `disabled={isSelf}` (AccountsTable 패턴 그대로).
- 정지 라벨은 `user.isSuspended ? '복구' : '정지'` 로 분기.
- 스타일은 AccountsTable (`packages/web/src/routes/admin/AccountsTable.tsx:252-330`) 그대로 복붙.

**다이얼로그 렌더** — 컴포넌트 맨 아래 `</AppShell>` 안에 (다른 섹션 뒤에):
```tsx
{editTarget && (
  <EditUserDialog
    open={!!editTarget}
    onOpenChange={(o) => !o && setEditTarget(null)}
    user={editTarget}
  />
)}
{suspendTarget && (
  <SuspendUserDialog
    open={!!suspendTarget}
    onOpenChange={(o) => !o && setSuspendTarget(null)}
    user={suspendTarget}
  />
)}
{resetTarget && (
  <ResetPasswordDialog
    open={!!resetTarget}
    onOpenChange={(o) => !o && setResetTarget(null)}
    user={resetTarget}
  />
)}
{deleteTarget && (
  <DeleteUserDialog
    open={!!deleteTarget}
    onOpenChange={(o) => !o && setDeleteTarget(null)}
    user={deleteTarget}
  />
)}
```

**주의**:
- 다이얼로그 성공 시 `useUsersList` 캐시 무효화는 각 hook 이 이미 처리 — 상세 페이지도 자동 반영.
- 삭제 성공 시 이 페이지는 「사용자를 찾을 수 없습니다」 상태로 자연 폴백 → 별도 라우팅 불필요 (v0.32 밖).

#### 2. `groupDetail.tsx` — 인라인 액션 2 버튼

**Imports 추가**:
```ts
import { useState } from 'react';
import { EditGroupDialog, type EditGroupTarget } from './EditGroupDialog';
import { DeleteGroupDialog, type DeleteGroupTarget } from './DeleteGroupDialog';
```

*(정확한 타입 이름은 `EditGroupDialog.tsx`·`DeleteGroupDialog.tsx` 에서 export 되는 것 그대로 사용.)*

**state**:
```ts
const [editTarget, setEditTarget] = useState<EditGroupTarget | null>(null);
const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);
```

**정보 카드 헤더**:
```tsx
<div className="flex justify-between items-center">
  <h2 className="text-h2 font-semibold text-fg-primary">그룹 정보</h2>
  {group && (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setEditTarget({
          email: group.email,
          name: group.name,
          description: group.description,
        })}
        data-testid={`group-detail-edit-${group.email}`}
        className="text-fg-primary underline ... focus-visible:ring-2 ..."
      >편집</button>
      <span className="text-fg-muted text-small" aria-hidden="true">·</span>
      <button
        type="button"
        onClick={() => setDeleteTarget({
          email: group.email,
          name: group.name,
        })}
        data-testid={`group-detail-delete-${group.email}`}
        className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >삭제</button>
    </div>
  )}
</div>
```

- 그룹은 self-target 개념 없음 — 조건 없음.
- 스타일은 GroupsTable (`packages/web/src/routes/admin/GroupsTable.tsx:225-250`) 그대로.

**다이얼로그 렌더** — `</AppShell>` 안에.

#### 3. 테스트

**web `UserDetailPage.test.tsx`** (3 신규 시나리오):
1. 「편집」 버튼 클릭 → `EditUserDialog` 오픈 (data-testid 로 확인 — 이미 있는 `edit-user-dialog` 등 재사용)
2. 자기 자신 이메일로 접근 → `user-detail-suspend-*`, `user-detail-delete-*`, `user-detail-reset-*` disabled 확인
3. 「삭제」 버튼 클릭 → `DeleteUserDialog` 오픈

**web `GroupDetailPage.test.tsx`** (2 신규 시나리오):
1. 「편집」 버튼 클릭 → `EditGroupDialog` 오픈
2. 「삭제」 버튼 클릭 → `DeleteGroupDialog` 오픈

기존 시나리오 회귀 유지 (정보 카드 · 감사 이력 · 없는 그룹).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 449 + 신규 5 = 454 근처.
5. `pnpm -r test:emu` — 이전 43 유지.
6. dev 서버 확인:
   - `/admin/users/{email}` 헤더 우측에 4 버튼
   - 자기 자신은 정지·비밀번호·삭제 disabled
   - 클릭 → 각 다이얼로그 오픈 → 확인 → 상세 페이지 데이터 새로고침
   - `/admin/groups/{email}` 헤더 우측에 편집·삭제 2 버튼
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **삭제 성공 후 상세 페이지 라우팅** — 자연 폴백 (「사용자를 찾을 수 없습니다」). 별도 nav 는 v0.33 후보.
- **감사 이력 이 「편집·삭제·정지」 조합에서 정확한 액션명으로 렌더** — 이미 백엔드에서 action=`users.write` 등으로 기록됨, 별도 UI 조치 불필요.
- **키보드 단축키 (E, D)** — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): UserDetailPage 인라인 액션 (편집·비밀번호·정지·삭제)`
2. `feat(web): GroupDetailPage 인라인 액션 (편집·삭제)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/detail-actions-v32`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
