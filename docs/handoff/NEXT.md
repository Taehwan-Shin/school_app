# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **users.update 프론트엔드 v0.8** — 계정 표 행에 「편집」 링크와 `EditUserDialog` 를 추가해 v0.7 백엔드 callable 을 UI 로 노출한다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/users-update-ui-v8`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**Designer 몫**: 이 슬라이스의 모든 스타일 값은 `docs/design/UI_SYSTEM.md` §4.5·§4.6·§4.7 에 있다. 특히 `CreateUserDialog.tsx` (기존) 의 폼 마크업·토큰을 그대로 재사용.

## 기준 커밋

**Base**: `330616b` (users.update 백엔드 v0.7 병합 커밋)

## 지금 할 것 — 편집 버튼 + EditUserDialog

### 왜

v0.7 이 `users.update` callable 을 놓았지만 지금 프론트엔드에서 부를 수 있는 방법이 없다. 사용자 편집은 관리자가 가장 자주 하는 조작 중 하나 (오탈자·부서 이동) 이고, UI 로 노출되지 않으면 백엔드가 있어도 실사용 안 됨.

이 슬라이스가 세 가지를 한다:
1. **`usersUpdate.ts` API 클라이언트** — v0.7 callable 호출 (fetch 기반, `usersDelete.ts` 패턴 재사용).
2. **`EditUserDialog.tsx` 컴포넌트** — 사용자 정보 (firstName·lastName·orgUnitPath) 편집 폼. `CreateUserDialog.tsx` 마크업 재사용.
3. **`AccountsTable.tsx` 관리 열 재구성** — 「편집」 링크를 「삭제」 앞에 추가. 두 링크 사이 · 로 구분.

**하지 않는 것**: 이메일 편집 (백엔드 지원 안 함). 비밀번호 재설정 (별도 slice). isAdmin·suspended 토글 (별도 slice). 편집 후 사용자 목록 즉시 재조회는 자동 (`useMutation` `onSuccess` 로 `invalidateQueries`).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — 관리 열에 「편집」 버튼 + `EditUserDialog` 렌더. `editTarget` state 추가.
- `packages/web/tests/AccountsTable.test.tsx` — 신규 UX 시나리오 2 추가 (편집 버튼 렌더 + 클릭 시 다이얼로그 열림).

**신규 파일**:
- `packages/web/src/api/usersUpdate.ts` — v0.7 callable 호출 클라이언트 (`usersDelete.ts` 패턴).
- `packages/web/src/routes/admin/EditUserDialog.tsx` — 편집 다이얼로그 (`CreateUserDialog.tsx` 패턴).
- `packages/web/tests/usersUpdate.test.tsx` — API 클라이언트 시나리오 4~5 (usersDelete 테스트 참고).
- `packages/web/tests/EditUserDialog.test.tsx` — 다이얼로그 시나리오 5 (렌더·pre-fill·검증·성공·오류).

**손대지 마라**:
- 다른 라우트·컴포넌트·기존 dialog·api — 이 슬라이스 밖.
- 백엔드 (`packages/functions/*`) — v0.7 완료.

### 세부 요구

#### 1. `packages/web/src/api/usersUpdate.ts` (신규)

`usersDelete.ts` 를 그대로 옮겨오되:

```ts
export interface UsersUpdateRequest {
  primaryEmail: string;
  firstName?: string;
  lastName?: string;
  orgUnitPath?: string;
}

export interface UsersUpdateResponse {
  primaryEmail: string;
  updatedFields: string[];
}
```

- URL: `usersUpdate` (dev: `/asia-northeast3/usersUpdate`, prod: `/api/usersUpdate`)
- 헤더·`x-request-id`·오류 처리 모두 `usersDelete.ts` 그대로
- `useUpdateUser()` mutation hook, `onSuccess` 에서 `queryClient.invalidateQueries({ queryKey: ["users", "list"] })`

#### 2. `packages/web/src/routes/admin/EditUserDialog.tsx` (신규)

**Props**:
```ts
export interface EditUserTarget {
  email: string;         // 읽기 전용
  firstName: string;
  lastName: string;
  orgUnitPath: string;
}

export interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: EditUserTarget | null;   // null 이면 다이얼로그 열려도 폼 비어있음
}
```

**구조** — `CreateUserDialog.tsx` 마크업 그대로 이식하되:
- 제목: 「사용자 편집」, 설명: 「사용자 이름과 조직 단위를 수정합니다」
- 이메일 필드: **읽기 전용** — `input` 대신 `<div className="font-mono text-body text-fg-primary bg-surface px-3 py-2 border border-border-subtle">` 로 표시. 편집 불가.
- 성 · 이름 · 조직 단위 인풋: `CreateUserDialog` 마크업 그대로. `user` prop 이 바뀔 때 `useEffect` 로 form state 초기화:
  ```tsx
  useEffect(() => {
    if (user) {
      setFamilyName(user.lastName);
      setGivenName(user.firstName);
      setOrgUnitPath(user.orgUnitPath || "/");
      setValidationError(null);
    }
  }, [user]);
  ```
- 비밀번호 필드 없음.
- 검증: 성·이름 빈 문자열 검증 (`CreateUserDialog` 규칙 재사용). 최소 하나는 채워야 함:
  ```tsx
  if (
    familyName.trim() === user.lastName &&
    givenName.trim() === user.firstName &&
    (orgUnitPath.trim() || "/") === (user.orgUnitPath || "/")
  ) {
    setValidationError("변경된 내용이 없습니다.");
    return;
  }
  ```
- 부분 편집: 변경된 필드만 `mutate` 호출 인자에 포함:
  ```tsx
  const payload: UsersUpdateRequest = { primaryEmail: user.email };
  if (familyName.trim() !== user.lastName) payload.lastName = familyName.trim();
  if (givenName.trim() !== user.firstName) payload.firstName = givenName.trim();
  const normalizedOrg = orgUnitPath.trim() || "/";
  if (normalizedOrg !== (user.orgUnitPath || "/")) payload.orgUnitPath = normalizedOrg;
  await updateUser(payload);
  handleClose(false);
  ```
- 하단 버튼: Secondary 「취소」 + Primary 「저장」 (v0.2 규칙).
- 오류 표시: `CreateUserDialog` 와 동일 배너. 특히 `admin_cannot_edit_admin` → 「관리자 계정은 다른 관리자가 수정할 수 없습니다.」

#### 3. `packages/web/src/routes/admin/AccountsTable.tsx` — 관리 열 재구성

**현재** (마지막 컬럼):
```tsx
<TableCell className="text-right">
  <button ...>삭제</button>
</TableCell>
```

**변경 후**:
```tsx
<TableCell className="text-right">
  <div className="flex justify-end items-center gap-3">
    <button
      type="button"
      onClick={() => setEditTarget({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        orgUnitPath: user.orgUnitPath || "/",
      })}
      data-testid={`edit-user-${user.email}`}
      className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      편집
    </button>
    <span className="text-fg-muted text-small" aria-hidden="true">·</span>
    <button ... /* 기존 삭제 버튼 그대로 */>
      삭제
    </button>
  </div>
</TableCell>
```

- `editTarget` state 추가 (`useState<EditUserTarget | null>(null)`).
- 「편집」 버튼은 **자기 자신도 활성**. 관리자 편집 시도는 백엔드가 permission-denied 로 막고 다이얼로그가 오류 메시지 표시.
- 「삭제」 버튼 기존 스타일·disabled 규칙 그대로.
- 표 최하단 (기존 `<DeleteUserDialog>` 옆) 에 `<EditUserDialog>` 렌더:
  ```tsx
  <EditUserDialog
    open={Boolean(editTarget)}
    onOpenChange={(open) => { if (!open) setEditTarget(null); }}
    user={editTarget}
  />
  ```

#### 4. `packages/web/tests/usersUpdate.test.tsx` (신규)

`useUsersList.test.tsx` 또는 `usersDelete.test.tsx` 참고:
1. **not_authenticated** — `auth.currentUser` null 이면 throw.
2. **성공** — 200 응답 파싱, `updatedFields` 반환.
3. **403 permission-denied** — `admin_cannot_edit_admin` 메시지 throw.
4. **400 no_fields_to_update** — 메시지 그대로 throw.
5. **hook onSuccess** — mutation 성공 시 `users/list` invalidate 확인.

#### 5. `packages/web/tests/EditUserDialog.test.tsx` (신규)

`CreateUserDialog.test.tsx` 참고, `MemoryRouter` 래퍼 필요:
1. **user 없음** — 다이얼로그 안 열림 (open=false).
2. **user pre-fill** — user prop 이 있을 때 이메일·성·이름·부서 필드에 값이 반영됨. 이메일은 읽기 전용.
3. **변경 없음** — 저장 클릭 시 「변경된 내용이 없습니다.」 배너.
4. **성공** — 성만 수정 후 저장 → `useUpdateUser` mock 이 `{ primaryEmail, lastName }` 만 받음 (부분 편집 검증).
5. **관리자 편집 실패** — mutation 이 `admin_cannot_edit_admin` throw → 배너 「관리자 계정은 다른 관리자가 수정할 수 없습니다.」

#### 6. `packages/web/tests/AccountsTable.test.tsx` 신규 2

기존 17 (v0.6 결과) 유지. 다음 2 추가:
1. **편집 버튼 렌더** — 표에 각 행마다 `edit-user-{email}` testid 버튼 존재.
2. **편집 클릭 시 다이얼로그 열림** — 특정 행 편집 클릭 → 다이얼로그가 해당 사용자 데이터로 pre-fill 되어 열림. `EditUserDialog` 를 mock 하고 props (`open=true`, `user=...`) 검증.

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 142 + 신규 5+5+2 = 154 근처.
5. dev 서버로 로컬 눈 확인 목록:
   - 계정 표 각 행 관리 열에 「편집 · 삭제」 두 링크
   - 「편집」 클릭 → 다이얼로그 열림, 이메일 회색 박스 (읽기 전용), 성·이름·부서 필드 pre-fill
   - 성만 수정 후 저장 → 다이얼로그 닫힘, 표 자동 새로고침 (수정된 이름 반영)
   - 자기 자신 편집 성공 (부서 변경)
   - 변경 없이 저장 → 「변경된 내용이 없습니다.」 배너
   - 관리자 편집 시도 (실 워크스페이스 필요) → 「관리자 계정은 다른 관리자가 수정할 수 없습니다.」 배너
   - 다크 모드 자연 전환
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 Directory API `patch` 응답** — 사용자 콘솔 조치 후 실측 (Identity Platform 활성화 대기).
- **관리자 편집 규율 실측** — admin/super_admin 두 계정 필요, 실 워크스페이스 대기.
- **네트워크 오류·시간 초과 UX** — 기본 fetch 오류 메시지 표시.
- **동시성** (같은 사용자 동시 편집) — 다음 슬라이스에서 판단.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): usersUpdate API 클라이언트 + mutation hook`
2. `feat(web): EditUserDialog 컴포넌트 (pre-fill · 부분 편집 · 검증)`
3. `feat(web): AccountsTable 관리 열에 편집 링크 통합`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/users-update-ui-v8`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
