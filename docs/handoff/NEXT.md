# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **그룹 멤버 관리 백엔드 v0.16** — `groups.members.list/insert/delete` 3 callable 추가. Google Directory API `members` 리소스 사용.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-members-v16`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4~5 개.

**writeAudit 규율**:
- `members.list` → `action: 'groups.read'`
- `members.insert` → `action: 'groups.write'`
- `members.delete` → `action: 'groups.delete'` (별도 cap 재사용)
- 각 4 경로 감사. `users/*` 패턴.

## 기준 커밋

**Base**: `d600c0a` (Groups CRUD UI v0.15)

## 지금 할 것 — 그룹 멤버 CRUD 백엔드

### 왜

Groups 도메인의 그룹 자체는 이제 CRUD 가능하지만, 멤버 관리 (누가 그룹에 속하는지) 는 아직 없음. 그룹의 실사용에는 멤버 관리가 핵심. 이 슬라이스가 멤버 CRUD (list/insert/delete) 를 추가.

**하지 않는 것**: 멤버 역할 (OWNER/MANAGER/MEMBER) 수정 (`members.update` 은 별도 slice). 대량 멤버 추가/삭제 (bulk, 별도 slice). 프론트엔드 UI (별도 slice, v0.17). 그룹 정책 (joinPolicy 등, 별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/google/directoryClient.ts` — `groups` 인터페이스에 `members` 하위 (`list/insert/delete`) 추가 (실 + stub).
- `packages/functions/src/index.ts` — 3 callable export.

**신규 파일**:
- `packages/functions/src/callable/groups/members/list.ts`
- `packages/functions/src/callable/groups/members/insert.ts`
- `packages/functions/src/callable/groups/members/delete.ts`
- `packages/functions/tests/groupsMembersList.test.ts` — 8~10
- `packages/functions/tests/groupsMembersList.emu.test.ts` — 3
- `packages/functions/tests/groupsMembersInsert.test.ts` — 8~10
- `packages/functions/tests/groupsMembersInsert.emu.test.ts` — 3
- `packages/functions/tests/groupsMembersDelete.test.ts` — 6~8
- `packages/functions/tests/groupsMembersDelete.emu.test.ts` — 3

**손대지 마라**:
- `groups/list.ts` · `groups/create.ts` · `groups/update.ts` · `groups/delete.ts` — 이번 슬라이스 밖.
- `packages/web/*` — 프론트엔드는 v0.17.
- middleware · writeAudit — 헬퍼 그대로.

### 세부 요구

#### 1. `directoryClient.ts` — `groups.members` 하위

**인터페이스 확장**:
```ts
groups: {
  list: ...;
  insert: ...;
  patch: ...;
  delete: ...;
  get: ...;
  members: {
    list: (params: { groupKey: string; pageToken?: string; maxResults?: number }) => Promise<{ data: any }>;
    insert: (params: { groupKey: string; requestBody: { email: string; role?: string } }) => Promise<{ data: any }>;
    delete: (params: { groupKey: string; memberKey: string }) => Promise<{ data: any }>;
  };
};
```

**실 impl** — googleapis 자동 (`google.admin({version:'directory_v1'}).members.list/insert/delete`).

**stub impl** — `stub.data.members` 배열 또는 `stub.data.memberInsert/memberDelete` 사용.

#### 2. `packages/functions/src/callable/groups/members/list.ts` (신규)

**입력**:
```ts
export interface GroupsMembersListRequest {
  groupEmail: string;   // 그룹 이메일
  pageToken?: string;   // 페이지네이션 (선택)
  maxResults?: number;  // 1..200, default 200
}

export interface GroupItem {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
  type: 'USER' | 'GROUP' | 'CUSTOMER' | 'EXTERNAL';
  status: string;  // 'ACTIVE' 등
}

export interface GroupsMembersListResponse {
  members: GroupItem[];
  nextPageToken: string | null;
}
```

**구조** — `users/list.ts` 패턴:
1. `authenticateRequest` (실패 → denied audit `action: 'groups.read'`)
2. `assertHasCap(user, 'groups.read')` + `assertHasScopes(['admin.directory.group.member.readonly'])` (실패 → denied)
3. **입력 검증**: `groupEmail` 필수, 도메인 매치. `maxResults` clamp 1..200.
4. **members 목록 조회** — 한 페이지만 (프론트엔드에서 pageToken 넘기며 다음 페이지 요청):
   ```ts
   const res = await directory.groups.members.list({
     groupKey: trimmedEmail,
     maxResults,
     pageToken: pageToken || undefined,
   });
   const members = (res.data.members ?? []).map((m: any): GroupItem => ({
     email: m.email ?? '',
     role: m.role ?? 'MEMBER',
     type: m.type ?? 'USER',
     status: m.status ?? '',
   }));
   ```
5. 성공 audit: `message: 'listed N members of group X'`.
6. `nextPageToken`: `res.data.nextPageToken ?? null`.

**REQUIRED_SCOPES**:
```ts
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
] as const;
```

#### 3. `packages/functions/src/callable/groups/members/insert.ts` (신규)

**입력**:
```ts
export interface GroupsMembersInsertRequest {
  groupEmail: string;
  memberEmail: string;
  role?: 'OWNER' | 'MANAGER' | 'MEMBER';  // default 'MEMBER'
}

export interface GroupsMembersInsertResponse {
  groupEmail: string;
  memberEmail: string;
  role: string;
}
```

**구조** — `users/create.ts` 패턴:
1. `authenticateRequest` (denied audit `action: 'groups.write'`)
2. `assertHasCap('groups.write')` + `assertHasScopes(['admin.directory.group.member'])`
3. **입력 검증**:
   - `groupEmail`·`memberEmail` 둘 다 필수, 도메인 매치
   - `role` 은 지정 시 세 값 중 하나. 아니면 `MEMBER` default.
4. `directory.groups.members.insert({ groupKey: groupEmail, requestBody: { email: memberEmail, role: finalRole } })`.
5. 성공 audit: `message: 'added ${memberEmail} to group ${groupEmail} as ${finalRole}'`.

**REQUIRED_SCOPES**:
```ts
'https://www.googleapis.com/auth/admin.directory.group.member',
```

#### 4. `packages/functions/src/callable/groups/members/delete.ts` (신규)

**입력**:
```ts
export interface GroupsMembersDeleteRequest {
  groupEmail: string;
  memberEmail: string;
}

export interface GroupsMembersDeleteResponse {
  groupEmail: string;
  memberEmail: string;
  deleted: true;
}
```

**구조** — `users/delete.ts` 패턴:
1. `authenticateRequest` (denied audit `action: 'groups.delete'`)
2. `assertHasCap('groups.delete')` + `assertHasScopes(['admin.directory.group.member'])`
3. **입력 검증**: 두 이메일 필수, 도메인 매치.
4. `directory.groups.members.delete({ groupKey: groupEmail, memberKey: memberEmail })`.
5. 성공 audit: `message: 'removed ${memberEmail} from group ${groupEmail}'`.

**주의**: 자기 자신을 그룹에서 제외 가능. 그룹의 마지막 OWNER 를 제외하는 규칙은 Directory API 가 자체 처리 (에러 던짐), 우리 코드는 별도 검사 안 함.

#### 5. `packages/functions/src/index.ts`

```ts
export { groupsMembersList } from './callable/groups/members/list.js';
export { groupsMembersInsert } from './callable/groups/members/insert.js';
export { groupsMembersDelete } from './callable/groups/members/delete.js';
```

#### 6. 테스트 (총 22~26 + emu 9)

**`groupsMembersList.test.ts`** (8~10):
1. 인증 실패 → denied
2. cap 없음 (teacher) → denied
3. scopes 없음 → denied
4. 이메일 검증 실패 → error
5. admin + 유효 입력 + 3 멤버 → ok audit + members 배열
6. super_admin 도 성공
7. 그룹 존재 안 함 (404) → error audit
8. `maxResults` clamp (0 → 1, 999 → 200)
9. `pageToken` 전달 확인
10. `nextPageToken` 반환 확인

**`groupsMembersInsert.test.ts`** (8~10):
1. 인증 실패 → denied
2. cap 없음 → denied
3. scopes 없음 → denied
4. 이메일 검증 실패 (memberEmail 도메인) → error
5. 이메일 검증 실패 (groupEmail 도메인) → error
6. admin + default MEMBER role → ok audit
7. admin + explicit OWNER role → ok audit
8. Directory API 409 (이미 멤버) → error audit + throw
9. 잘못된 role 값 → error
10. groupEmail 없음 → error

**`groupsMembersDelete.test.ts`** (6~8):
1. 인증 실패 → denied
2. cap 없음 → denied
3. scopes 없음 → denied
4. 이메일 검증 실패 → error
5. admin + 유효 → ok audit
6. Directory API 404 (멤버 아님) → error audit
7. super_admin 도 성공
8. 마지막 OWNER 제외 시도 → Directory API 오류 → error audit

**각 emu 테스트** (3 × 3 = 9):
- allow (admin)
- denied non-admin
- denied scope 없음

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 279 + 신규 22~28 = 301~307 근처.
5. `pnpm -r test:emu` — 이전 31 + 신규 9 = 40 통과.
6. 프로덕션 번들 grep — emulator 코드 0 건.

### 판정 불가

- **실 워크스페이스 멤버 관리 실측** — 프론트엔드 UI (v0.17) + 사용자 실행.
- **OWNER 제한 로직** — Directory API 가 처리, 우리 미검사.
- **역할 수정 (`members.update`)** — 별도 slice.
- **대량 처리 (bulk)** — 별도 slice.
- **프론트엔드 UI** — v0.17.

### 커밋 규칙

**4~5 커밋 분리**:
1. `feat(functions): directoryClient 에 groups.members 하위 (list/insert/delete) 추가`
2. `feat(functions): groups.members.list callable + 감사`
3. `feat(functions): groups.members.insert callable + 감사`
4. `feat(functions): groups.members.delete callable + 감사`
5. `test(functions): groups.members.* 단위 + emu (총 22-28 + 9)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/groups-members-v16`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
