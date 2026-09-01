# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **users.update 백엔드 v0.7** — 사용자 이름·조직 단위 편집 callable 추가. 프론트엔드 통합은 v0.8 에서.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/users-update-v7`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**writeAudit 규율**: 이 슬라이스는 감사 로그를 다루는 새 callable 을 추가한다. 반드시:
- 모든 실패·성공 경로에서 `writeAudit` 호출
- Firestore `audit_log` 컬렉션에 직접 쓰지 마라 (ESLint AST 규칙이 잡음)
- `action: 'users.write'`, `role: user.role`, `actor: user.email` 그대로
- 인증 실패 경로에서 `role: 'unknown'` 사용

## 기준 커밋

**Base**: `73b6205` (검색·정렬 URL 동기화 v0.6 병합 커밋)

## 지금 할 것 — users.update callable

### 왜

지금 users CRUD 는 create/read/delete 뿐. **update** 가 빠져 있다. 실 운영에서 사용자 이름 오탈자 수정, 부서 이동 시 organizational unit 변경, 성명 변경 등이 필요하다. 원본 `계정관리.gs` 도 이 편집 기능을 가지고 있다.

이 슬라이스가 세 가지를 한다:
1. **`users.update` callable 추가** — `firstName` · `lastName` · `orgUnitPath` 부분 편집. Directory API `patch` 사용.
2. **`directoryClient.users.patch` 추가** — 실 API 호출 + 파일 stub 지원.
3. **`writeAudit` before/after 기록** — 변경 전 값과 변경 후 값을 함께 감사 로그에.

**하지 않는 것**: 이메일 (primaryEmail) 변경 — Directory API 는 별도 rename 흐름이라 이번 슬라이스 밖. 관리자 권한 (`isAdmin`) 토글 — 별도 slice. 정지 (`suspended`) 토글 — 별도 slice. 비밀번호 재설정 — 별도 slice. 프론트엔드 UI — v0.8.

**보안**: 자기 자신 편집은 허용 (일반 사용자가 자기 이름을 고치는 흐름은 나중 슬라이스에서 non-admin 캡으로 별도 처리). super_admin/workspace admin 편집은 super_admin 만 (users.delete 와 동일 규칙 재사용).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/google/directoryClient.ts` — `DirectoryClient.users` 인터페이스에 `patch` 추가. 실 impl (googleapis) + 파일 stub 지원. stub 은 `stub.data.patch` 또는 `stub.data.get` 반환.
- `packages/functions/src/index.ts` — `usersUpdate` export 추가.

**신규 파일**:
- `packages/functions/src/callable/users/update.ts` — 새 callable.
- `packages/functions/tests/usersUpdate.test.ts` — 단위 테스트 8~10 개.
- `packages/functions/tests/usersUpdate.emu.test.ts` — emu HTTP 종단 테스트 3 개 (allow · denied non-admin · admin editing admin denied).

**손대지 마라**:
- `packages/web/*` — 이 슬라이스는 백엔드만. 프론트 통합은 v0.8.
- `packages/functions/src/callable/users/create.ts` · `list.ts` · `delete.ts` — 기존 로직 손대지 마라.
- `packages/functions/src/audit/writeAudit.ts` — 헬퍼는 그대로 사용, 개조 금지.

### 세부 요구

#### 1. `directoryClient.ts` — `patch` 메서드

**인터페이스에 추가** (기존 `users` 객체에):
```ts
patch: (params: { userKey: string; requestBody: any }) => Promise<{ data: any }>;
```

**실 impl** — googleapis 는 자동. `google.admin({version:'directory_v1', auth}).users.patch(...)` 이미 존재.

**stub impl** — `stub.data.patch` 있으면 그 값. 없으면 요청받은 `requestBody` 를 그대로 반환 (merge simulation):
```ts
patch: async (params: { userKey: string; requestBody: any }) => {
  const stub = readStubResponse();
  if (stub.data && stub.data.patch) {
    return { data: stub.data.patch };
  }
  return {
    data: {
      primaryEmail: params?.userKey,
      ...params?.requestBody,
    },
  };
},
```

#### 2. `packages/functions/src/callable/users/update.ts` (신규)

**입력 스키마**:
```ts
export interface UsersUpdateRequest {
  primaryEmail: string;          // 대상 사용자 이메일 (필수)
  firstName?: string;            // 부분 편집 — 값 있으면 반영
  lastName?: string;
  orgUnitPath?: string;
}

export interface UsersUpdateResponse {
  primaryEmail: string;
  updatedFields: string[];       // 실제로 변경된 필드 이름들
}
```

**구조** — `create.ts` 패턴을 따라:
1. `requestId = header('x-request-id') ?? crypto.randomUUID()`
2. `authenticateRequest` (실패 시 role='unknown' 로 denied audit)
3. `assertHasCap(user, 'users.write')` + `assertHasScopes(user, REQUIRED_SCOPES)` (실패 시 denied audit)
4. **입력 검증**:
   - `primaryEmail` 필수, `@ALLOWED_DOMAIN` 매치
   - `firstName`·`lastName`·`orgUnitPath` 중 최소 하나는 있어야 함. 셋 다 없으면 `invalid-argument: no_fields_to_update`
   - `orgUnitPath` 는 `/` 로 시작하도록 정규화
5. **자기 편집이 아니라면 target 이 super_admin/workspace admin 인지 확인**:
   ```ts
   if (targetEmail !== user.email && user.role !== 'super_admin') {
     const [appRoleSnap, workspaceUser] = await Promise.all([
       db.collection('users').where('email', '==', targetEmail).limit(1).get(),
       directory.users.get({ userKey: targetEmail }),
     ]);
     const appRoleIsSuperAdmin = !appRoleSnap.empty && appRoleSnap.docs[0].data()?.role === 'super_admin';
     const isWorkspaceAdmin = workspaceUser.data?.isAdmin === true;
     if (appRoleIsSuperAdmin || isWorkspaceAdmin) {
       throw new HttpsError('permission-denied', 'admin_cannot_edit_admin');
     }
   }
   ```
   `db` 는 `getFirestore()` 로 얻고 `directory` 는 이미 있음.
6. **before 조회**: `const before = await directory.users.get({ userKey: targetEmail })`. `before.data.name.givenName`·`familyName`·`orgUnitPath` 를 감사에 담을 스냅샷으로.
7. **patch 요청 바디 구성** (제공된 필드만):
   ```ts
   const requestBody: any = {};
   const updatedFields: string[] = [];
   if (typeof firstName === 'string' && firstName.trim()) {
     requestBody.name = { ...(requestBody.name ?? {}), givenName: firstName.trim() };
     updatedFields.push('firstName');
   }
   if (typeof lastName === 'string' && lastName.trim()) {
     requestBody.name = { ...(requestBody.name ?? {}), familyName: lastName.trim() };
     updatedFields.push('lastName');
   }
   if (typeof orgUnitPath === 'string' && orgUnitPath.trim()) {
     const path = orgUnitPath.trim().startsWith('/') ? orgUnitPath.trim() : '/' + orgUnitPath.trim();
     requestBody.orgUnitPath = path;
     updatedFields.push('orgUnitPath');
   }
   if (updatedFields.length === 0) {
     throw new HttpsError('invalid-argument', 'no_fields_to_update');
   }
   ```
8. **patch 호출**: `await directory.users.patch({ userKey: targetEmail, requestBody })`
9. **성공 audit** — before/after 스냅샷 함께:
   ```ts
   await writeAudit({
     actor: user.email,
     role: user.role,
     action: 'users.write',
     target: targetEmail,
     request_id: requestId,
     result: 'ok',
     message: `updated fields: ${updatedFields.join(', ')} | before: ${JSON.stringify({firstName: before.data?.name?.givenName, lastName: before.data?.name?.familyName, orgUnitPath: before.data?.orgUnitPath})} | after: ${JSON.stringify(requestBody)}`,
   });
   ```
10. **반환**: `{ primaryEmail: targetEmail, updatedFields }`.
11. **catch** — `error` audit + HttpsError rethrow (create 패턴).

#### 3. `packages/functions/src/index.ts` — export

기존 `usersList` · `usersCreate` · `usersDelete` · `getMe` 옆에 `usersUpdate` 추가.

#### 4. `packages/functions/tests/usersUpdate.test.ts` (신규)

`usersCreate.test.ts` 패턴 따라 8~10 케이스:
1. 인증 실패 → denied audit + throw
2. cap 없음 (teacher) → denied audit + throw
3. scopes 없음 → denied audit + throw
4. 이메일 검증 실패 (도메인 불일치) → error audit + throw
5. 편집 필드 없음 → error audit (`no_fields_to_update`) + throw
6. admin 이 workspace admin 편집 시도 → permission-denied audit + throw
7. super_admin 이 workspace admin 편집 성공
8. admin 이 일반 사용자 편집 성공 (firstName 만)
9. admin 이 일반 사용자 편집 성공 (orgUnitPath 만 — `/` 자동 prefix)
10. 자기 자신 편집 성공 (admin 이 자기 이름 변경)

각 케이스에서 `writeAudit` 호출을 mock 검증 (횟수·인자).

#### 5. `packages/functions/tests/usersUpdate.emu.test.ts` (신규)

`usersDelete.emu.test.ts` (또는 `usersCreate.emu.test.ts`) 패턴 따라 3 케이스:
1. **allow** — admin 계정 로그인 → `/api/usersUpdate` POST → 200 응답 + audit_log 에 ok 항목
2. **denied non-admin** — teacher 계정 로그인 → 403 응답 + audit_log 에 denied 항목
3. **admin_cannot_edit_admin** — admin 이 다른 admin 편집 시도 → 403 + audit_log 에 permission-denied 항목

stub 파일 (`EMULATOR_DIRECTORY_STUB_FILE`) 은 `users` · `get` · `patch` 셋을 채워야 함. 예:
```json
{
  "data": {
    "users": [{"primaryEmail": "target@cam.hs.kr", "isAdmin": false, "name": {"givenName": "Old", "familyName": "Name"}, "orgUnitPath": "/"}],
    "get": {"primaryEmail": "target@cam.hs.kr", "isAdmin": false, "name": {"givenName": "Old", "familyName": "Name"}, "orgUnitPath": "/"},
    "patch": {"primaryEmail": "target@cam.hs.kr", "name": {"givenName": "New", "familyName": "Name"}, "orgUnitPath": "/"}
  }
}
```

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과 — 특히 `no-restricted-syntax` (audit_log 직접 접근 금지 규칙).
4. `pnpm -r test` — 이전 130 + 신규 10~13 = 140~143 근처.
5. `pnpm -r test:emu` — 이전 emu 테스트 유지 + 신규 3 통과.
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 Directory API `patch` 응답** — 사용자 콘솔 조치 후 실측 (v0.8 프론트 통합 후).
- **`workspaceUser.data?.isAdmin` 조회 시 `directory.users.get` 이 stub 인지 실인지** — stub 이면 항상 `isAdmin: false` 로 응답. emu 테스트는 stub 통해 검증.
- **before 스냅샷 실패 시 처리** — Directory API `get` 이 404 이면 target 이 존재 안 함. 이 경우 error audit + `not-found` throw.
- **updatedFields 비어있을 때 예방책** — 이미 검증에서 잡음.
- **동시성** (같은 사용자 동시 편집) — 다음 슬라이스에서 판단.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): directoryClient 에 users.patch 메서드 추가 (실 + stub)`
2. `feat(functions): users.update callable 추가 (before/after 감사 로그)`
3. `test(functions): users.update 단위 + emu 통합 테스트`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/users-update-v7`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
