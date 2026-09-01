# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **groups.update + groups.delete 백엔드 v0.14** — Groups CRUD 완결. `users` 도메인 CRUD 패턴 그대로 (users.update · users.delete 재사용).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-crud-v14`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 4~5 개로 분리.

**writeAudit 규율**: `action: 'groups.write'` (update) / `action: 'groups.delete'` (delete). 4 경로 (auth · cap/scope · ok · error) 모두 감사. `users/update.ts` · `users/delete.ts` 패턴.

## 기준 커밋

**Base**: `f512a3d` (groups.create v0.13 병합 커밋)

## 지금 할 것 — Groups CRUD 완결

### 왜

v0.11 (list) + v0.13 (create) 이후 update/delete 만 추가하면 Groups 도메인 CRUD 완성. 이 슬라이스가 마무리.

**하지 않는 것**: 그룹 멤버 관리 (다음 슬라이스, `groups.members.list/add/remove`). 프론트엔드 UI (별도 slice). 그룹 정책 (`joinPolicy` · `whoCanPostMessage` 등, 별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/google/directoryClient.ts` — `groups` 인터페이스에 `patch` + `delete` + `get` 추가 (실 impl + stub).
- `packages/functions/src/index.ts` — `groupsUpdate` + `groupsDelete` export.

**신규 파일**:
- `packages/functions/src/callable/groups/update.ts` — 새 callable.
- `packages/functions/src/callable/groups/delete.ts` — 새 callable.
- `packages/functions/tests/groupsUpdate.test.ts` — 단위 8~10.
- `packages/functions/tests/groupsUpdate.emu.test.ts` — emu 3.
- `packages/functions/tests/groupsDelete.test.ts` — 단위 6~8.
- `packages/functions/tests/groupsDelete.emu.test.ts` — emu 3.

**손대지 마라**:
- `groups/list.ts` · `groups/create.ts` — 이번 슬라이스 밖.
- `packages/web/*` — 프론트엔드는 별도 slice.
- middleware · writeAudit · readAudit — 헬퍼 그대로.

### 세부 요구

#### 1. `directoryClient.ts` — `groups.patch/delete/get`

**인터페이스 확장**:
```ts
groups: {
  list: (params?: any) => Promise<{ data: any }>;
  insert: (params: { requestBody: any }) => Promise<{ data: any }>;
  patch: (params: { groupKey: string; requestBody: any }) => Promise<{ data: any }>;
  delete: (params: { groupKey: string }) => Promise<{ data: any }>;
  get: (params: { groupKey: string }) => Promise<{ data: any }>;
};
```

**실 impl**: googleapis 자동.

**stub impl** — `users` 의 patch/delete/get 패턴 그대로 미러:
- `patch`: `stub.data.groupPatch` 또는 `{ groupKey, ...requestBody }` 반환
- `delete`: `stub.data.groupDelete` 또는 `{}` 반환
- `get`: `stub.data.groupGet` 또는 `stub.data.groups[]` 에서 찾기, 없으면 stub 그룹 반환

#### 2. `packages/functions/src/callable/groups/update.ts` (신규)

**입력**:
```ts
export interface GroupsUpdateRequest {
  email: string;         // 대상 그룹 이메일 (필수)
  name?: string;         // 새 이름
  description?: string;  // 새 설명
}

export interface GroupsUpdateResponse {
  email: string;
  updatedFields: string[];
}
```

**구조** — `users/update.ts` 패턴 미러:
1. `authenticateRequest` (실패 → denied audit `role='unknown'`)
2. `assertHasCap(user, 'groups.write')` + `assertHasScopes(user, ['admin.directory.group'])` (실패 → denied audit)
3. **입력 검증**:
   - `email` 필수, `@ALLOWED_DOMAIN` 매치
   - `name` · `description` 중 최소 하나는 있어야 함, 아니면 `invalid-argument: no_fields_to_update`
4. **before 조회**: `await directory.groups.get({ groupKey: email })` — 감사 스냅샷용
5. **patch 요청 바디**:
   ```ts
   const requestBody: any = {};
   const updatedFields: string[] = [];
   if (typeof name === 'string' && name.trim()) {
     requestBody.name = name.trim();
     updatedFields.push('name');
   }
   if (typeof description === 'string') {
     requestBody.description = description.trim();
     updatedFields.push('description');
   }
   ```
6. `directory.groups.patch({ groupKey: email, requestBody })` 호출
7. **성공 audit** — before/after 스냅샷 포함:
   ```ts
   message: `updated fields: ${updatedFields.join(', ')} | before: ${JSON.stringify({name: before.data?.name, description: before.data?.description})} | after: ${JSON.stringify(requestBody)}`
   ```
8. catch 블록: error audit + HttpsError rethrow.

#### 3. `packages/functions/src/callable/groups/delete.ts` (신규)

**입력**:
```ts
export interface GroupsDeleteRequest {
  email: string;   // 대상 그룹 이메일
}

export interface GroupsDeleteResponse {
  email: string;
  deleted: true;
}
```

**구조** — `users/delete.ts` 패턴 미러:
1. `authenticateRequest` (실패 → denied audit `action: 'groups.delete'`)
2. `assertHasCap(user, 'groups.delete')` + scopes (실패 → denied)
3. **입력 검증**:
   - `email` 필수, `@ALLOWED_DOMAIN` 매치
4. **삭제 실행**: `directory.groups.delete({ groupKey: email })`
5. **성공 audit** — `action: 'groups.delete'`, `target: email`, `message: 'deleted group'`
6. catch 블록: error audit + rethrow.

**cap 이름**: `groups.delete` (별개, users.delete 와 대칭).

#### 4. `packages/functions/src/index.ts`

```ts
export { groupsUpdate } from './callable/groups/update.js';
export { groupsDelete } from './callable/groups/delete.js';
```

#### 5. 테스트

**`groupsUpdate.test.ts`** (8~10 cases, `usersUpdate.test.ts` 미러):
1. 인증 실패 → denied
2. cap 없음 (teacher) → denied
3. scopes 없음 → denied
4. 이메일 검증 실패 (도메인) → error
5. 편집 필드 없음 → error `no_fields_to_update`
6. admin + name 만 수정 성공 → ok audit + before/after
7. admin + description 만 수정 성공
8. admin + 둘 다 수정 성공
9. Directory API 오류 (404 등) → error audit + throw
10. before 조회 실패 → error audit + throw

**`groupsUpdate.emu.test.ts`** (3):
1. allow (admin) — 200 + audit_log
2. denied non-admin (teacher) — 403
3. denied scope 없음 — 403

**`groupsDelete.test.ts`** (6~8, `usersDelete.test.ts` 미러):
1. 인증 실패 → denied
2. cap 없음 → denied
3. scopes 없음 → denied
4. 이메일 검증 실패 → error
5. admin + 유효 이메일 → ok audit
6. Directory API 오류 → error audit
7. teacher 는 cap 없어서 403 (재검증)
8. super_admin 도 성공

**`groupsDelete.emu.test.ts`** (3):
1. allow (admin)
2. denied non-admin
3. denied scope 없음

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 226 + 신규 14~18 = 240~244 근처.
5. `pnpm -r test:emu` — 이전 25 + 신규 6 = 31 통과.
6. 프로덕션 번들 grep — emulator 코드 0 건.

### 판정 불가

- **실 Directory API 응답** — 사용자 콘솔 조치 후 실측 (프론트엔드 UI 이후).
- **그룹 alias 관리** — patch 에 aliases 필드 지정 가능하나 이번 슬라이스 밖.
- **삭제 후 undelete** — Google Workspace 는 그룹 undelete 없음 (users 와 다름). 삭제는 영구.
- **members 자동 해제** — 그룹 삭제 시 자동으로 멤버십 해제 (Google 자동, 우리 코드 안 함).
- **프론트엔드 UI** — 별도 slice.

### 커밋 규칙

**4~5 커밋 분리**:
1. `feat(functions): directoryClient 에 groups.patch/delete/get 추가 (실 + stub)`
2. `feat(functions): groups.update callable + 감사 로그 (before/after)`
3. `feat(functions): groups.delete callable + 감사 로그`
4. `test(functions): groups.update 단위 + emu`
5. `test(functions): groups.delete 단위 + emu`

각 conventional commits. `git add -A` 금지.

**작업 브랜치 원격 push** — `git push -u origin feat/groups-crud-v14`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 결과
- 오더 대비 차이
