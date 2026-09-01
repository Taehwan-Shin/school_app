# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **groups.list 백엔드 v0.11** — Google Workspace 그룹 조회 callable 추가. 원본 `계정관리.gs` 의 그룹 관리 섹션 시작.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-list-v11`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 4 개로 분리 (스코프 추가 포함).

**writeAudit 규율**: users.list 패턴 그대로. `action: 'groups.read'`, 4 경로 모두 감사.

## 기준 커밋

**Base**: `1eccb88` (감사 로그 뷰어 UI v0.10 병합 커밋)

## 지금 할 것 — groups.list callable + OAuth 스코프 확장

### 왜

지금까지 users 도메인 (list/create/update/delete) + audit 도메인이 완성됐다. **groups 도메인** 은 원본 `계정관리.gs` 의 큰 부분 (그룹 CRUD, 멤버 관리, 정책 설정) 을 담당하는데 아직 미구현이다.

이 슬라이스가 두 가지를 한다:
1. **`groups.list` callable** — 조직 내 Google Groups 목록 조회 (email·name·description·members count).
2. **OAuth 로그인 스코프에 `admin.directory.group.readonly` 추가** — 실 워크스페이스 사용 시 사용자가 그룹 조회 권한을 재동의하도록.

**하지 않는 것**: groups.create/update/delete (다음 슬라이스). 멤버 조회·추가·삭제 (다음 슬라이스). 그룹 정책 설정 (다음 슬라이스). 프론트엔드 UI (v0.12).

**주의 (스코프 변경 파급)**: `admin.directory.group.readonly` 추가로 인해 **기존 로그인 세션은 groups.list 호출 시 scope 부족으로 denied**. 사용자는 로그아웃 후 재로그인 필요. 이 사실을 다음 슬라이스 배포 노트에 명시.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/google/directoryClient.ts` — `DirectoryClient` 에 `groups` 인터페이스 추가 (`list` 메서드) + 실 impl + stub.
- `packages/functions/src/index.ts` — `groupsList` export 추가.
- `packages/web/src/lib/auth.tsx` — `GOOGLE_LOGIN_SCOPES` 배열에 `admin.directory.group.readonly` 추가.
- `packages/web/tests/auth.test.ts` — 스코프 배열 어서션 갱신 (`addScope` 호출 횟수/인자).

**신규 파일**:
- `packages/functions/src/callable/groups/list.ts` — 새 callable.
- `packages/functions/tests/groupsList.test.ts` — 단위 테스트 8~10 개.
- `packages/functions/tests/groupsList.emu.test.ts` — emu HTTP 통합 테스트 3 개.

**손대지 마라**:
- 다른 callable · directoryClient users 인터페이스 · 다른 라우트/컴포넌트 — 이 슬라이스 밖.
- `packages/functions/src/audit/*` — 헬퍼 그대로.

### 세부 요구

#### 1. `packages/functions/src/google/directoryClient.ts` — `groups` 인터페이스

**인터페이스에 추가** (기존 `users` 옆에):

```ts
export interface DirectoryClient {
  users: { /* 기존 그대로 */ };
  groups: {
    list: (params?: any) => Promise<{ data: any }>;
  };
}
```

**실 impl** — googleapis 자동 (`google.admin({version:'directory_v1', auth}).groups.list(...)`).

**stub impl**:
```ts
groups: {
  list: async () => {
    const stub = readStubResponse();
    if (stub.data && stub.data.groups) {
      return { data: stub.data };  // groups 배열 + nextPageToken 이 있으면 그대로
    }
    return { data: { groups: [], nextPageToken: null } };
  },
},
```

#### 2. `packages/functions/src/callable/groups/list.ts` (신규)

`users/list.ts` 패턴 그대로 (import 경로도 동일):

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';

export interface GroupItem {
  email: string;
  name: string;
  description: string;
  aliases: string[];
  directMembersCount: number;
}

export interface GroupsListResponse {
  groups: GroupItem[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
] as const;
```

**구조** — users.list 4 경로 그대로:
1. `authenticateRequest` (실패 → denied audit `role='unknown'` 폴백)
2. `assertHasCap(user, 'groups.read')` + `assertHasScopes(user, REQUIRED_SCOPES)` (실패 → denied audit)
3. **성공 경로**: 페이지네이션 loop 로 모든 그룹 수집:
   ```ts
   do {
     const res = await directory.groups.list({
       customer: 'my_customer',
       maxResults: 200,
       pageToken,
     });
     results.push(
       ...((res.data.groups ?? []) as any[]).map((g): GroupItem => ({
         email: g.email ?? '',
         name: g.name ?? '',
         description: g.description ?? '',
         aliases: Array.isArray(g.aliases) ? g.aliases : [],
         directMembersCount: typeof g.directMembersCount === 'string'
           ? Number.parseInt(g.directMembersCount, 10)
           : Number(g.directMembersCount ?? 0),
       })),
     );
     pageToken = res.data.nextPageToken ?? undefined;
   } while (pageToken);
   ```
   **주의**: `directMembersCount` 는 Directory API 가 문자열로 반환하는 경우가 있어 정수 변환.
4. 성공 audit: `action: 'groups.read'`, `target: '*'`, `message: 'listed N groups'`.
5. catch 블록: error audit + HttpsError rethrow.

#### 3. `packages/functions/src/index.ts`

```ts
export { groupsList } from './callable/groups/list.js';
```

#### 4. `packages/web/src/lib/auth.tsx` — 스코프 확장

`GOOGLE_LOGIN_SCOPES` 상수 배열에 새 스코프 **추가**:

```ts
export const GOOGLE_LOGIN_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',  // 신규
] as const;
```

기존 두 스코프는 유지. 새 스코프는 배열 마지막에.

#### 5. `packages/web/tests/auth.test.ts` — 스코프 어서션 갱신

`signInWithGoogle` 테스트에서 `addScope` 가 3 번 호출됨을 확인. 정확한 인자 검증 (앞 두 개 그대로 + 새 것).

#### 6. `packages/functions/tests/groupsList.test.ts` (신규)

`usersList.test.ts` 패턴, 8~10 케이스:
1. 인증 실패 → denied audit + throw
2. cap 없음 (teacher) → denied audit + throw
3. scopes 없음 (`X-Google-Scopes` 에 group.readonly 없음) → denied audit + throw
4. admin + 스코프 있음 + 그룹 3 개 → ok audit + `groups` 배열 3
5. super_admin 도 성공 (동일 흐름)
6. 그룹 0 개 (빈 배열) → ok audit + 빈 `groups`
7. `directMembersCount` 문자열 `"5"` → 정수 5 로 변환
8. `directMembersCount` 없음 → 0
9. `aliases` 없음 → 빈 배열
10. googleapis 오류 (rejects) → error audit + throw

#### 7. `packages/functions/tests/groupsList.emu.test.ts` (신규)

`usersList.emu.test.ts` 패턴, 3 케이스:
1. **allow** (admin 계정 + 그룹 2 개 stub) → 200 + audit_log 에 ok
2. **denied non-admin** (teacher) → 403 + audit_log 에 denied (cap 없음)
3. **denied scope 없음** (admin 이지만 group scope 안 보냄) → 403 + denied audit

stub 파일 예시:
```json
{
  "data": {
    "groups": [
      {"email": "team-a@cam.hs.kr", "name": "Team A", "description": "Alpha team", "aliases": [], "directMembersCount": "10"},
      {"email": "team-b@cam.hs.kr", "name": "Team B", "description": "", "aliases": ["tb@cam.hs.kr"], "directMembersCount": "5"}
    ],
    "nextPageToken": null
  }
}
```

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 186 + 신규 8~10 + auth.test 갱신 = 195 근처.
5. `pnpm -r test:emu` — 이전 19 + 신규 3 = 22 통과.
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 Directory Groups API 응답** — 사용자 콘솔 조치 후 실측 (Identity Platform 활성화 + 재로그인 필요).
- **`admin.directory.group.readonly` 재동의** — 기존 로그인 세션은 로그아웃 후 재로그인해야 새 스코프 획득. 다음 슬라이스 배포 노트에 명시.
- **직접 멤버 vs 전체 멤버 수 (`directMembersCount` vs 그룹 계층 확장)** — Directory API 는 직접 멤버만 반환. 그룹의 그룹은 다음 슬라이스.
- **그룹 CRUD** — 다음 슬라이스.
- **프론트엔드 UI** — v0.12.

### 커밋 규칙

**4 커밋 분리**:
1. `feat(functions): directoryClient 에 groups 인터페이스 (list) 추가 (실 + stub)`
2. `feat(functions): groups.list callable + 감사 로그`
3. `feat(web): OAuth 로그인 스코프에 admin.directory.group.readonly 추가`
4. `test(functions): groups.list 단위 + emu 통합 테스트`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/groups-list-v11`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
