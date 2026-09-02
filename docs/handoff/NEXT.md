# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **사용자 정지·복구 v0.21** — 기존 `users.update` callable 을 확장 (`suspended` 필드 지원) + AccountsTable 행에 「정지 · 복구」 버튼 + `SuspendUserDialog`. 새 callable 없음, `users.write` cap 재사용.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/users-suspend-v21`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4 개.

## 기준 커밋

**Base**: `579f822` (Groups KPI 필터 v0.20)

## 지금 할 것 — 사용자 정지·복구

### 왜

`AccountsTable` 은 「정지」 컬럼에 상태 (`정지됨` / `정상`) 만 표시하고, 정지·복구 조작 UI 가 없음. `.gs` 원본에는 정지·복구 기능이 있고, 실 운영에서 이직·휴직 시 자주 씀. 이 슬라이스가 그 UX 를 추가.

**하지 않는 것**: 새 callable (`users.update` 확장으로 충분). 새 스코프 (기존 `admin.directory.user` 재사용). `users.reset_password` (별도 slice). 대량 정지 (bulk, 별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/callable/users/update.ts` — 입력 스키마에 `suspended?: boolean` 추가. Directory API patch 요청 바디에 반영. before/after 감사 스냅샷에 포함.
- `packages/functions/tests/usersUpdate.test.ts` — `suspended` 시나리오 3 추가.
- `packages/web/src/api/usersUpdate.ts` — `UsersUpdateRequest` 에 `suspended?: boolean` 추가.
- `packages/web/tests/usersUpdate.test.tsx` — `suspended` 시나리오 1 추가.
- `packages/web/src/routes/admin/AccountsTable.tsx` — 관리 열에 「정지·복구」 버튼 추가 (편집·삭제 옆).
- `packages/web/tests/AccountsTable.test.tsx` — 「정지·복구」 버튼 시나리오 2 추가.

**신규 파일**:
- `packages/web/src/routes/admin/SuspendUserDialog.tsx` — 정지·복구 확인 다이얼로그.
- `packages/web/tests/SuspendUserDialog.test.tsx` — 시나리오 5.

**손대지 마라**:
- middleware · writeAudit · directoryClient — 헬퍼 그대로.
- 다른 callable · 다른 UI · GroupsTable 등.

### 세부 요구

#### 1. `users/update.ts` — `suspended` 지원

**입력 스키마 확장**:
```ts
export interface UsersUpdateRequest {
  primaryEmail: string;
  firstName?: string;
  lastName?: string;
  orgUnitPath?: string;
  suspended?: boolean;   // 신규
}
```

**patch 요청 바디 구성** (기존 로직에 추가):
```ts
if (typeof suspended === 'boolean') {
  requestBody.suspended = suspended;
  updatedFields.push('suspended');
}
```

**주의 (권한 재사용)**:
- `groups.write` cap 재사용 (`users.write` 를 이미 요구)
- 새 scope 없음
- admin 이 workspace admin 을 정지·복구 시도 → 기존 `admin_cannot_edit_admin` 로직으로 차단

**감사 스냅샷 확장**:
```ts
message: `updated fields: ${updatedFields.join(', ')} | before: ${JSON.stringify({
  firstName: before.data?.name?.givenName,
  lastName: before.data?.name?.familyName,
  orgUnitPath: before.data?.orgUnitPath,
  suspended: before.data?.suspended,  // 신규
})} | after: ${JSON.stringify(requestBody)}`
```

#### 2. `usersUpdate.test.ts` 신규 3

기존 12 유지. 다음 3 추가:
1. **admin + suspended=true 만 편집** → ok audit, `updatedFields=['suspended']`
2. **admin + suspended=false 만 편집** (복구) → ok audit
3. **admin + firstName + suspended 함께 편집** → ok audit, `updatedFields=['firstName', 'suspended']`

#### 3. `packages/web/src/api/usersUpdate.ts` — 타입 확장

```ts
export interface UsersUpdateRequest {
  primaryEmail: string;
  firstName?: string;
  lastName?: string;
  orgUnitPath?: string;
  suspended?: boolean;  // 신규
}
```

`callUsersUpdate` 함수는 그대로 (body 에 payload 전체 전달).

#### 4. `packages/web/src/routes/admin/SuspendUserDialog.tsx` (신규)

**Props**:
```ts
export interface SuspendUserTarget {
  email: string;
  firstName: string;
  lastName: string;
  isSuspended: boolean;   // 현재 상태
}
export interface SuspendUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SuspendUserTarget | null;
}
```

**패턴** — `DeleteUserDialog.tsx` 미러:
- 현재 상태에 따라 문구 다름:
  - 정지 상태이면 「복구」 다이얼로그 (초록 톤은 없음, 그냥 secondary 톤)
  - 정상 상태이면 「정지」 다이얼로그 (경고 톤, `text-state-warning`)
- 대상 표시: 이메일 + 이름
- 확인: 이메일 재입력
- 하단 버튼: Secondary 취소 + 「정지」 (또는 「복구」) Primary
- 성공 시 다이얼로그 닫힘 + mutation onSuccess → 표 자동 새로고침

**mutate 호출** — 기존 `useUpdateUser` 재사용:
```ts
await updateUser({
  primaryEmail: user.email,
  suspended: !user.isSuspended,  // 토글
});
```

**오류 매핑**: `admin_cannot_edit_admin` → 「관리자 계정은 정지·복구할 수 없습니다.」

#### 5. `AccountsTable.tsx` — 관리 열 재구성

**현재** 관리 열:
```tsx
<div className="flex justify-end items-center gap-3">
  <button ...>편집</button>
  <span aria-hidden="true">·</span>
  <button ...>삭제</button>
</div>
```

**변경 후**:
```tsx
<div className="flex justify-end items-center gap-3">
  <button ...>편집</button>
  <span aria-hidden="true">·</span>
  <button
    type="button"
    disabled={isSelf}
    title={isSelf ? "자기 계정은 정지·복구할 수 없습니다" : (user.isSuspended ? "계정 복구" : "계정 정지")}
    onClick={() => setSuspendTarget({email: user.email, firstName: user.firstName, lastName: user.lastName, isSuspended: user.isSuspended})}
    data-testid={`suspend-user-${user.email}`}
    className={ /* 정지 상태이면 text-fg-primary underline, 정상이면 text-state-warning underline */ }
  >
    {user.isSuspended ? "복구" : "정지"}
  </button>
  <span aria-hidden="true">·</span>
  <button ...>삭제</button>
</div>
```

**state**:
```ts
const [suspendTarget, setSuspendTarget] = useState<SuspendUserTarget | null>(null);
```

**렌더**:
```tsx
<SuspendUserDialog
  open={Boolean(suspendTarget)}
  onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}
  user={suspendTarget}
/>
```

**자기 계정 disabled** (삭제와 동일).

#### 6. 테스트

**`SuspendUserDialog.test.tsx`** (5 시나리오, `MemoryRouter` 래퍼):
1. `user=null` → 다이얼로그 안 열림.
2. `user.isSuspended=false` → 「정지」 문구, 경고 톤.
3. `user.isSuspended=true` → 「복구」 문구, 일반 톤.
4. **성공 (정지)** — mutation 이 `{primaryEmail, suspended: true}` 로 호출됨.
5. **오류 (admin_cannot_edit_admin)** → 배너 「관리자 계정은…」.

**`AccountsTable.test.tsx`** 신규 2:
1. **정지·복구 버튼 렌더** — 각 행에 `suspend-user-{email}` 렌더. 정지 상태이면 「복구」, 정상 상태이면 「정지」 텍스트.
2. **자기 계정 disabled** — `isSelf=true` 인 행의 정지·복구 버튼도 disabled (title 확인).

**`usersUpdate.test.tsx`** (packages/web) 신규 1:
- `suspended: true` payload 로 호출 시 body 에 그대로 포함되는지 검증.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 350 + 신규 3+5+2+1 = 361 근처.
5. `pnpm -r test:emu` — 이전 40 통과 유지 (신규 emu 테스트 없음, 기존 usersUpdate.emu 는 `suspended` 커버 안 함).
6. dev 서버 확인:
   - `/admin` 각 행 관리 열 「편집 · 정지 · 삭제」 3 링크
   - 「정지」 클릭 → SuspendUserDialog (경고 톤)
   - 이메일 재입력 → 「정지」 클릭 → 표 자동 새로고침, 상태 「정지됨」 으로
   - 정지된 행에서 「복구」 클릭 → 「복구」 다이얼로그
   - 자기 계정 「정지」 는 disabled
7. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **실 워크스페이스 정지·복구 실측** — 배포 후 사용자 확인.
- **대량 정지 (bulk)** — 별도 slice.
- **users.reset_password** — 별도 slice (새 scope 필요).
- **super_admin 이 admin 을 정지** — 백엔드 `admin_cannot_edit_admin` 이 admin/super_admin 만 super_admin 처리 허용. workspace admin 을 정지하려는 admin 은 permission-denied.

### 커밋 규칙

**4 커밋 분리**:
1. `feat(functions): users.update 에 suspended 필드 지원 + 감사 스냅샷 확장`
2. `test(functions): users.update suspended 시나리오 3 추가`
3. `feat(web): SuspendUserDialog 컴포넌트`
4. `feat(web): AccountsTable 관리 열에 정지·복구 버튼 통합 + usersUpdate 타입 확장`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/users-suspend-v21`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
