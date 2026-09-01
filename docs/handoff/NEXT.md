# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **groups.create 백엔드 v0.13** — Google Workspace 그룹 생성 callable 추가. Groups 도메인 CRUD 시작.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-create-v13`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3~4 개로 분리.

**writeAudit 규율**: `action: 'groups.write'`, 4 경로 (auth denied / cap denied / ok / error) 모두 감사. `groups/list.ts` 패턴 그대로.

## 기준 커밋

**Base**: `b976a87` (body-based token transport 수정 커밋 — 프로덕션 배포 확인됨)

## 지금 할 것 — groups.create callable

### 왜

v0.11 이 `groups.list` 를 놓았고, 프로덕션에서 실 워크스페이스 그룹 목록이 정상 로드됨. 이제 CRUD 를 완성해야 그룹 관리 도메인이 실사용 가능. 이 슬라이스가 **create** 를 추가 (users 도메인의 `users.create` 패턴 그대로).

**하지 않는 것**: groups.update/delete (다음 슬라이스). 멤버 관리 (다음 슬라이스). 프론트엔드 UI (v0.14 이후). 그룹 정책 (aliases 수정 · joinPolicy 등, 별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/google/directoryClient.ts` — `groups` 인터페이스에 `insert` 메서드 추가 (실 impl + stub).
- `packages/functions/src/index.ts` — `groupsCreate` export 추가.
- `packages/web/src/lib/auth.tsx` — `GOOGLE_LOGIN_SCOPES` 배열에 `admin.directory.group` (write scope) 추가.
- `packages/web/tests/auth.test.ts` — 스코프 어서션 갱신.

**신규 파일**:
- `packages/functions/src/callable/groups/create.ts` — 새 callable.
- `packages/functions/tests/groupsCreate.test.ts` — 단위 테스트 8~10 개.
- `packages/functions/tests/groupsCreate.emu.test.ts` — emu HTTP 통합 테스트 3 개.

**손대지 마라**:
- `groups/list.ts` — 이번 슬라이스 밖.
- 다른 callable · web 라우트 — 이번 슬라이스 밖 (프론트엔드 v0.14).

### 세부 요구

#### 1. `directoryClient.ts` — `groups.insert` 메서드

**인터페이스에 추가** (기존 `groups` 옆에):
```ts
groups: {
  list: (params?: any) => Promise<{ data: any }>;
  insert: (params: { requestBody: any }) => Promise<{ data: any }>;
};
```

**실 impl** — googleapis 자동 (`google.admin({version:'directory_v1'}).groups.insert(...)`).

**stub impl**:
```ts
insert: async (params: { requestBody: any }) => {
  const stub = readStubResponse();
  if (stub.data && stub.data.groupInsert) {
    return { data: stub.data.groupInsert };
  }
  return {
    data: {
      id: 'stub-group-' + Date.now(),
      email: params?.requestBody?.email,
      name: params?.requestBody?.name,
      description: params?.requestBody?.description ?? '',
      directMembersCount: '0',
    },
  };
},
```

#### 2. `packages/functions/src/callable/groups/create.ts` (신규)

**입력 스키마**:
```ts
export interface GroupsCreateRequest {
  email: string;           // 새 그룹 이메일 (예: 'team-a@cam.hs.kr')
  name: string;            // 그룹 표시 이름
  description?: string;    // 옵션
}

export interface GroupsCreateResponse {
  email: string;
  id: string;              // Directory API 가 반환하는 그룹 ID
}
```

**구조** — `users/create.ts` 패턴 따라:
1. `authenticateRequest` (실패 → denied audit `role='unknown'`)
2. `assertHasCap(user, 'groups.write')` + `assertHasScopes(user, REQUIRED_SCOPES)` (실패 → denied audit)
3. **입력 검증**:
   - `email` 필수, `@ALLOWED_DOMAIN` (cam.hs.kr) 매치
   - `name` 필수 (trim 후 비어있으면 안 됨)
4. `directory.groups.insert({ requestBody: { email, name, description } })` 호출
5. 성공 audit: `action: 'groups.write'`, `target: email`, `message: 'created group'`
6. catch 블록: error audit + HttpsError rethrow

**REQUIRED_SCOPES**:
```ts
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group',
] as const;
```

#### 3. `packages/functions/src/index.ts`

```ts
export { groupsCreate } from './callable/groups/create.js';
```

#### 4. `packages/web/src/lib/auth.tsx` — 스코프 확장

`GOOGLE_LOGIN_SCOPES` 배열 마지막에:
```ts
'https://www.googleapis.com/auth/admin.directory.group',  // 신규 (write)
```

기존 `admin.directory.group.readonly` 는 유지 (그룹 목록 조회용).

#### 5. `packages/web/tests/auth.test.ts` — 스코프 어서션 갱신

`signInWithGoogle` 이 `addScope` 를 4 번 호출하는지 확인. 4 번째 인자는 새 write scope.

#### 6. `packages/functions/tests/groupsCreate.test.ts` (신규)

`usersCreate.test.ts` 패턴, 8~10 케이스:
1. 인증 실패 → denied audit + throw
2. cap 없음 (teacher) → denied audit + throw
3. scopes 없음 (write scope 부재) → denied audit + throw
4. 이메일 검증 실패 (도메인 불일치) → error audit + throw
5. 이메일 없음 → error audit + throw
6. 이름 없음 → error audit + throw
7. admin + 유효 입력 → ok audit + `{email, id}` 반환
8. super_admin 도 성공 (동일 흐름)
9. Directory API 오류 (409 이미 존재 등) → error audit + throw
10. description 없이 성공 (옵션 필드 확인)

#### 7. `packages/functions/tests/groupsCreate.emu.test.ts` (신규)

`usersCreate.emu.test.ts` 패턴, 3 케이스:
1. **allow (admin)** — admin 계정 + 유효 입력 → 200 + audit_log 에 ok
2. **denied non-admin (teacher)** — 403 + audit_log 에 denied
3. **denied scope 없음** — admin 이지만 write scope 안 보냄 → 403 + denied audit

stub 파일 예시:
```json
{
  "data": {
    "groupInsert": {"id": "group-new-id", "email": "new-team@cam.hs.kr", "name": "New Team"}
  }
}
```

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 202 + 신규 8~10 + auth.test 갱신 = 213 근처.
5. `pnpm -r test:emu` — 이전 22 + 신규 3 = 25 통과.
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 Directory Groups API `insert` 응답** — 사용자 콘솔 조치 후 실측 (프론트엔드 v0.14 이후 실 워크스페이스 테스트).
- **`admin.directory.group` 스코프 재동의** — 기존 로그인 세션은 로그아웃 후 재로그인 필요.
- **동일 이메일 그룹 이미 존재 시** — Directory API 가 409 반환. 프론트엔드에서 사용자 친화 메시지로 매핑은 다음 슬라이스.
- **그룹 별칭 (aliases) 설정** — insert 시 aliases 를 지정할 수도 있으나 이번 슬라이스 밖.
- **프론트엔드 UI** — v0.14 이후.

### 커밋 규칙

**3~4 커밋 분리**:
1. `feat(functions): directoryClient 에 groups.insert 메서드 추가 (실 + stub)`
2. `feat(functions): groups.create callable + 감사 로그`
3. `feat(web): OAuth 로그인 스코프에 admin.directory.group (write) 추가`
4. `test(functions): groups.create 단위 + emu 통합 테스트`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/groups-create-v13`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
