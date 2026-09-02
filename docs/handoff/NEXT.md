# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **비밀번호 재설정 v0.23** — 새 callable `users.resetPassword` + 새 OAuth 스코프 `admin.directory.user.security` + AccountsTable 행에 「비밀번호」 버튼 + `ResetPasswordDialog`. cap `users.reset_password` 재사용.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/users-reset-password-v23`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 5 개.

## 기준 커밋

**Base**: `da428a7` (그룹 멤버 스코프 hotfix)

## 지금 할 것 — 비밀번호 재설정

### 왜

`AccountsTable` 은 계정 편집·정지·삭제까지 가능하지만 **비밀번호 재설정** 은 없음. `.gs` 원본에는 있고 실 운영에서 사용자 문의 (「비밀번호 잊었어요」) 가장 흔한 요청. 이 슬라이스가 추가.

**하지 않는 것**: 임시 비밀번호 자동 생성 (관리자가 직접 입력). 이메일로 재설정 링크 전송 (Directory API 지원하나 별도 스코프+워크플로 필요, 별도 slice). MFA/2FA 관련.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/index.ts` — `usersResetPassword` export.
- `packages/web/src/lib/auth.tsx` — `GOOGLE_LOGIN_SCOPES` 에 `admin.directory.user.security` 추가.
- `packages/web/tests/auth.test.ts` — 스코프 어서션 갱신 (6 → 7).
- `packages/web/src/routes/admin/AccountsTable.tsx` — 관리 열에 「비밀번호」 버튼 추가 (편집·정지·삭제 옆).
- `packages/web/tests/AccountsTable.test.tsx` — 시나리오 2 추가.

**신규 파일**:
- `packages/functions/src/callable/users/resetPassword.ts` — 새 callable.
- `packages/functions/tests/usersResetPassword.test.ts` — 단위 테스트 8~10 개.
- `packages/functions/tests/usersResetPassword.emu.test.ts` — emu HTTP 통합 3 개.
- `packages/web/src/api/usersResetPassword.ts` — API 클라이언트 + mutation hook.
- `packages/web/src/routes/admin/ResetPasswordDialog.tsx` — 다이얼로그.
- `packages/web/tests/usersResetPassword.test.tsx` — API 시나리오 5.
- `packages/web/tests/ResetPasswordDialog.test.tsx` — 다이얼로그 시나리오 5.

**손대지 마라**:
- middleware · writeAudit · directoryClient — 헬퍼 그대로.
- 다른 callable · 다른 UI.

### 세부 요구

#### 1. `packages/functions/src/callable/users/resetPassword.ts` (신규)

**입력**:
```ts
export interface UsersResetPasswordRequest {
  primaryEmail: string;
  newPassword: string;
  changePasswordAtNextLogin?: boolean;  // default true (권장)
}

export interface UsersResetPasswordResponse {
  primaryEmail: string;
  passwordReset: true;
}
```

**구조** — `users/update.ts` 패턴 참고. audit action = `'users.reset_password'`:
1. `authenticateRequest` (실패 → denied audit `role='unknown'`)
2. `assertHasCap(user, 'users.reset_password')` + `assertHasScopes(user, REQUIRED_SCOPES)` (실패 → denied)
3. **입력 검증**:
   - `primaryEmail` 필수, `@ALLOWED_DOMAIN` 매치
   - `newPassword` 필수, 최소 8 자 (users.create 규칙 재사용)
4. **admin_cannot_edit_admin 검증** (users.update 와 동일 로직 재사용):
   - `isSelf = user.email === trimmedEmail`
   - 자기 자신 아니고 user.role !== 'super_admin' 이면 target 이 admin 인지 확인
   - admin 이 admin 재설정 시도 → permission-denied
5. `directory.users.update({ userKey: trimmedEmail, requestBody: { password: newPassword, changePasswordAtNextLogin: change } })`
6. 성공 audit: `action: 'users.reset_password'`, `message: 'password reset (changeOnNextLogin: ${change})'` — **비밀번호 값은 audit 에 절대 남기지 마라**.
7. catch 블록: error audit + HttpsError rethrow.

**REQUIRED_SCOPES**:
```ts
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.security',
] as const;
```

주의: `admin.directory.user.security` 는 별도 스코프. `admin.directory.user` (write) 만으로는 비밀번호 조작 불가.

#### 2. `packages/functions/src/index.ts`

```ts
export { usersResetPassword } from './callable/users/resetPassword.js';
```

#### 3. `packages/web/src/lib/auth.tsx`

```ts
export const GOOGLE_LOGIN_SCOPES = [
  ...existing,
  'https://www.googleapis.com/auth/admin.directory.user.security',  // 신규 (7 번째)
] as const;
```

#### 4. `packages/web/tests/auth.test.ts`

`addScopeMock` 호출 횟수 6 → 7, 7 번째 인자 검증.

#### 5. `packages/web/src/api/usersResetPassword.ts` (신규)

`usersUpdate.ts` 패턴 그대로:
```ts
export interface UsersResetPasswordRequest {
  primaryEmail: string;
  newPassword: string;
  changePasswordAtNextLogin?: boolean;
}

export interface UsersResetPasswordResponse {
  primaryEmail: string;
  passwordReset: true;
}

export async function callUsersResetPassword(data: UsersResetPasswordRequest): Promise<UsersResetPasswordResponse> { /* body 에 _googleAccessToken 포함, Cloud Functions 직접 URL */ }

export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation<UsersResetPasswordResponse, Error, UsersResetPasswordRequest>({
    mutationFn: (data) => callUsersResetPassword(data),
    // 성공 후 users list 다시 불러올 필요 없음 (사용자 필드 안 바뀜)
  });
}
```

#### 6. `packages/web/src/routes/admin/ResetPasswordDialog.tsx` (신규)

**Props**:
```ts
export interface ResetPasswordTarget {
  email: string;
  firstName: string;
  lastName: string;
}

export interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ResetPasswordTarget | null;
}
```

**필드**:
- 대상 이메일 (읽기 전용, `bg-surface` 박스)
- 새 비밀번호 (`type="password"`, `minLength={8}`)
- 새 비밀번호 재입력 (일치 검증)
- 「다음 로그인 시 변경 요구」 체크박스 (default checked, 강력 권장)

**검증**:
- 두 비밀번호 일치
- 8 자 이상
- 아니면 배너로 이유 표시

**하단**: Secondary 취소 + Primary 「재설정」

**성공**: 다이얼로그 닫힘. 「비밀번호가 재설정되었습니다.」 succes 배너를 잠시 (3 초) 표시 후 사라짐. **재설정된 비밀번호 값은 절대 UI 에 다시 표시하지 마라**.

**오류 매핑**:
- `permission-denied` (admin_cannot_edit_admin) → 「관리자 계정 비밀번호는 재설정할 수 없습니다.」
- `insufficient_scope` → 「비밀번호 재설정 권한이 부족합니다. 다시 로그인하세요.」
- 기타 → 「재설정 실패: ${message}」

#### 7. `AccountsTable.tsx` 관리 열 확장

**현재** 관리 열: 「편집 · 정지 · 삭제」 3 링크.

**변경 후**: 「편집 · 비밀번호 · 정지 · 삭제」 **4 링크** (`·` 로 구분).

```tsx
<button
  type="button"
  disabled={isSelf}
  title={isSelf ? "자기 계정 비밀번호는 여기서 재설정할 수 없습니다" : "비밀번호 재설정"}
  onClick={() => setResetTarget({email: user.email, firstName: user.firstName, lastName: user.lastName})}
  data-testid={`reset-password-${user.email}`}
  className={ /* isSelf 이면 muted disabled, 아니면 text-fg-primary underline */ }
>
  비밀번호
</button>
```

**주의**: 자기 계정 비밀번호는 여기서 재설정 안 함 (Google 자체 계정 관리 페이지에서). disabled.

**state 추가**: `useState<ResetPasswordTarget | null>` + `ResetPasswordDialog` 렌더.

#### 8. 테스트 (총 21+3 emu)

**`usersResetPassword.test.ts`** (8~10):
1. 인증 실패 → denied
2. cap 없음 (teacher) → denied
3. scopes 없음 (`user.security` 부재) → denied
4. 이메일 검증 실패 (도메인) → error
5. 비밀번호 짧음 (< 8 자) → error `password_too_short`
6. admin 이 workspace admin 재설정 시도 → permission-denied
7. super_admin 이 workspace admin 재설정 → 성공
8. admin + 일반 사용자 → 성공, audit 에 비밀번호 값 없음 확인
9. admin + changePasswordAtNextLogin=false → 성공 (audit message 반영)
10. Directory API 오류 → error audit

**`usersResetPassword.emu.test.ts`** (3):
1. allow (admin) — 200 + audit_log ok
2. denied non-admin (teacher) — 403 + denied
3. denied scope 없음 — 403 + denied

**web `usersResetPassword.test.tsx`** (5): API 클라이언트 표준 시나리오 (인증·성공·403·body 검증·mutation).

**`ResetPasswordDialog.test.tsx`** (5):
1. `user=null` → 다이얼로그 안 열림.
2. 8 자 미만 → 검증 배너.
3. 두 비밀번호 불일치 → 검증 배너.
4. 성공 → mutation 호출 검증 (`{primaryEmail, newPassword, changePasswordAtNextLogin}`).
5. 관리자 재설정 오류 매핑.

**`AccountsTable.test.tsx`** 신규 2: 「비밀번호」 버튼 렌더 + 클릭 시 다이얼로그 열림.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 366 + 신규 8+5+5+2+1 = 387 근처.
5. `pnpm -r test:emu` — 이전 40 + 신규 3 = 43 통과.
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **자동 임시 비밀번호 생성 · 이메일 전송** — 별도 slice.
- **비밀번호 정책 (복잡도) 검증** — Google Workspace 자체 정책이 서버 side 로 강제. 우리는 최소 8 자만 검증.
- **실 워크스페이스 실측** — 배포 후 사용자 확인.
- **사용자 세션 강제 로그아웃** — 별도 API, 별도 slice.

### 커밋 규칙

**5 커밋 분리**:
1. `feat(functions): users.resetPassword callable + 감사 로그 (비밀번호 값 마스킹)`
2. `feat(web): OAuth 로그인 스코프에 admin.directory.user.security 추가`
3. `feat(web): usersResetPassword API 클라이언트 + mutation`
4. `feat(web): ResetPasswordDialog 컴포넌트`
5. `feat(web): AccountsTable 관리 열에 비밀번호 재설정 버튼 통합`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/users-reset-password-v23`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
