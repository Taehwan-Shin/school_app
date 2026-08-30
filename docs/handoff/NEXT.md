# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **첫 실 관리 기능 (서버 층만)** — `writeAudit` 헬퍼 + `users.list` callable.
> UI 는 다음 오더. 사용자 콘솔 조치 (OAuth 도메인·Identity Platform) 는 병렬.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 `git push -u origin feat/...` 로 원격에 올린다
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript 컴파일 · Vitest · 신규 에뮬레이터 통합 시험 · CI 워크플로 문법

**추가**: **완료 후 반드시 `#general` 스레드에 `@Claude Code_Honey` 포함해 결과 보고**. 지난 CI 오더는 push 안 한 채 보고했다가 잡혔다 — 이번엔 **작업 브랜치를 원격에 반드시 push** 하고 브랜치 이름을 보고에 명시하라.

## 기준 커밋

**Base**: `4888ea1` (Java 21 · 에뮬레이터 --only 정정)

`git log --oneline -1` 로 실물 확인 후 시작.

## 지금 할 것 — 감사 헬퍼 + 첫 실 관리 callable

### 왜

지금까지의 슬라이스는 「사용자가 로그인해서 껍데기 화면에 도달」까지였다. 이제 첫 **실 워크스페이스 API 호출** 을 붙인다. 목표: **관리자가 로그인해서 `users.list` 를 부르면 `cam.hs.kr` 도메인의 실 사용자 목록이 반환된다.** UI 는 다음 오더. 이 오더는 서버 층만.

동시에 `DESIGN_v1.md` §5 의 audit_log 관문 넷을 처음으로 코드에 심는다:
1. Rules — 이미 있음 (`firestore.rules`)
2. `writeAudit()` 헬퍼 — 이 오더에서 신설
3. AST ESLint 규칙 — 이 오더에서 신설
4. 에뮬레이터 테스트 — 이 오더에서 신설

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/audit/writeAudit.ts` — 단일 감사 로그 쓰기 헬퍼
- `packages/functions/src/authz/middleware.ts` — Callable 앞에 붙는 인증·역할·권한 검사
- `packages/functions/src/authz/capabilities.ts` — `Capability` 재수출 (shared 로부터)
- `packages/functions/src/callable/users/list.ts` — 첫 실 callable
- `packages/functions/src/google/directoryClient.ts` — googleapis 초기화 헬퍼 (사용자 OAuth 액세스 토큰으로)
- `packages/functions/tests/writeAudit.emu.test.ts` — Firestore Emulator 에서 audit_log 쓰기·조회
- `packages/functions/tests/usersList.emu.test.ts` — REST signUp → admin claim → callable HTTP 호출 → 결과·audit_log 검증 (googleapis mock)
- `packages/functions/tests/writeAudit.test.ts` — 단위 (mock Firestore)
- `packages/functions/tests/usersList.test.ts` — 단위 (mock googleapis · Firestore · Auth)
- 저장소 루트 `eslint.config.js` (또는 `.eslintrc.cjs`) — AST 규칙

**기존 파일 수정**:
- `packages/functions/src/index.ts` — `usersList` export 추가
- `packages/functions/package.json` — devDep 에 `googleapis`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`. `lint` 스크립트를 `tsc --noEmit && eslint src tests` 로 확장. `pnpm --filter @school-app/functions add …` 로 설치.

**기존 파일 삭제 금지**. `docs/`·`STATUS.md`·`project_notes.md` 는 헤드가 관리.

### 스택·라이브러리

- `googleapis` — Google Admin Directory API 클라이언트. `pnpm --filter @school-app/functions add googleapis` 로 dependencies 에 (devDependencies 아님 — 런타임 필요).
- `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` — devDep, functions 패키지 안에.

### 세부 요구

#### 1. `writeAudit` 헬퍼

`packages/functions/src/audit/writeAudit.ts`:

```ts
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export interface AuditEntry {
  actor: string;             // 이메일
  role: 'super_admin' | 'admin' | 'teacher';
  action: string;            // Capability 문자열 (예: 'users.read')
  target: string;            // 대상 자원 식별자
  request_id: string;
  result: 'ok' | 'error' | 'denied';
  before?: unknown;
  after?: unknown;
  message?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = getFirestore();
  await db.collection('audit_log').add({
    ...entry,
    at: FieldValue.serverTimestamp(),
  });
}
```

이 함수 **하나만** `audit_log` 컬렉션에 접근한다. 다른 자리에서 `.collection('audit_log')` 를 부르면 ESLint 에서 실패.

#### 2. ESLint AST 규칙

저장소 루트 (또는 functions 패키지) 에 ESLint 설정. `no-restricted-syntax` 로:

- 금지: `CallExpression[callee.property.name='collection'][arguments.0.value='audit_log']`
  · 즉 `xxx.collection('audit_log')` 리터럴 호출.
- 예외: `packages/functions/src/audit/writeAudit.ts` (override 로 이 파일만 허용).
- 추가 금지: **비리터럴** 컬렉션 경로 — `xxx.collection(variable)` · `xxx.collection(\`...\`)` — 동적 우회 방지. (`DESIGN_v1.md` §5).

**로컬 실증** — 다른 파일에 `firestore.collection('audit_log').add(...)` 를 임시로 넣어 `pnpm lint` 가 실패하는지 확인. 확인 후 임시 코드 되돌리기. 이 실증 결과를 보고에 포함.

#### 3. 인증·권한 미들웨어

`packages/functions/src/authz/middleware.ts`:

- `authenticateRequest(request)` 시그니처:
  ```ts
  export async function authenticateRequest(request: CallableRequest): Promise<{
    email: string;
    role: 'super_admin' | 'admin' | 'teacher';
    googleAccessToken: string;
  }>;
  ```
  - Firebase ID 토큰 검증 (`request.auth`) → E1 (이메일)
  - `X-Google-Access-Token` 헤더 추출 → tokeninfo 조회 → E2, scopes[]
  - E1 ≠ E2 시 `HttpsError('unauthenticated', 'token_subject_mismatch')`
  - `request.auth.token.role` 이 `'super_admin'|'admin'|'teacher'` 중 하나가 아니면 `HttpsError('failed-precondition', 'role_not_assigned')`
  - 반환

- `assertHasCap(user, cap)`:
  - `@school-app/shared` 의 `ROLE_CAPABILITIES` 매트릭스 조회
  - 없으면 `HttpsError('permission-denied', cap)`

#### 4. Google Directory client

`packages/functions/src/google/directoryClient.ts`:

```ts
import { google } from 'googleapis';

export function getDirectoryClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.admin({ version: 'directory_v1', auth });
}
```

**주의** — 서비스 계정 아님. 사용자 OAuth 액세스 토큰. `DESIGN_v1.md` §2·§4 의 원칙.

#### 5. `users.list` callable

`packages/functions/src/callable/users/list.ts`:

```ts
export const usersList = onCall({ region: 'asia-northeast3' }, async (request) => {
  const user = await authenticateRequest(request);
  const requestId = (request.rawRequest.headers['x-request-id'] as string) ?? crypto.randomUUID();

  try {
    assertHasCap(user, 'users.read');
  } catch (err) {
    await writeAudit({
      actor: user.email, role: user.role,
      action: 'users.read', target: '*',
      request_id: requestId, result: 'denied',
      message: (err as Error).message,
    });
    throw err;
  }

  try {
    const directory = getDirectoryClient(user.googleAccessToken);
    const results: any[] = [];
    let pageToken: string | undefined;

    do {
      const res = await directory.users.list({
        customer: 'my_customer',
        maxResults: 100,
        pageToken,
        orderBy: 'email',
      });
      results.push(...(res.data.users ?? []).map(u => ({
        email: u.primaryEmail ?? '',
        firstName: u.name?.givenName ?? '',
        lastName: u.name?.familyName ?? '',
        orgUnitPath: u.orgUnitPath ?? '',
        isAdmin: u.isAdmin ?? false,
        isSuspended: u.suspended ?? false,
      })));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    await writeAudit({
      actor: user.email, role: user.role,
      action: 'users.read', target: '*',
      request_id: requestId, result: 'ok',
      message: `listed ${results.length} users`,
    });

    return { users: results };
  } catch (err) {
    await writeAudit({
      actor: user.email, role: user.role,
      action: 'users.read', target: '*',
      request_id: requestId, result: 'error',
      message: (err as Error).message,
    });
    throw new HttpsError('unknown', (err as Error).message);
  }
});
```

### 6. 테스트

**순수 단위** (mock):
- `writeAudit.test.ts` — Firestore mock 으로 `add()` 가 정확한 스키마로 불리는지.
- `usersList.test.ts` — Auth·Firestore·googleapis 모두 mock. 케이스:
  - `admin` 이 부르면 목록 반환 + writeAudit `ok`
  - `teacher` 가 부르면 `permission-denied` + writeAudit `denied`
  - 두 페이지 페이지네이션 정상
  - googleapis 실패 → writeAudit `error` + `HttpsError('unknown')`

**에뮬레이터 통합**:
- `writeAudit.emu.test.ts` — 실 Firestore Emulator 에 add → collection query 로 필드 정확성 확인.
- `usersList.emu.test.ts`:
  1. REST signUp 으로 `admin-emu@cam.hs.kr` 생성 → blocking trigger 가 role='teacher' 로 심음
  2. 헤드 admin SDK 로 `setCustomUserClaims(uid, { role: 'admin' })` 로 승격 (테스트 목적)
  3. `getIdToken(true)` 대신 REST 로 `signInWithPassword` 호출해 새 idToken 받음
  4. `googleapis` 를 `vi.mock` 으로 대체해서 `users.list` 가 가짜 페이지 반환하도록
  5. `usersList` callable 을 emulator functions HTTPS URL 로 fetch POST — `Authorization: Bearer <idToken>`, `X-Google-Access-Token: fake-google-token`
     · URL 예: `http://127.0.0.1:5001/demo-school/asia-northeast3/usersList`
     · Body: `{ data: {} }` (Callable 규격)
  6. 응답 검증: `users` 배열 정확
  7. Firestore `audit_log` 에 `action: 'users.read', result: 'ok'` 문서 하나 있는지 조회

- **주의** — tokeninfo 는 실 Google 서버 호출이라 emulator 에서 실패한다. 미들웨어에 **테스트 우회 스위치** 를 넣는 대신, **환경변수** (`FIREBASE_AUTH_EMULATOR_HOST` 설정 시) 에서는 tokeninfo 건너뛰고 헤더의 access token 을 신뢰. 프로덕션에서는 항상 tokeninfo.
  - 이 우회를 명시 주석으로. `TODO(v1.1): tokeninfo mock server 도입`.

### 7. CI 정합

- `pnpm test:emu` 는 자동으로 `*.emu.test.ts` 를 다 실행 (기존 `vitest.emu.config.ts` 그대로).
- `pnpm -r lint` 는 ESLint 통과 필수.

### 완료 확인 방법

1. `pnpm install` — googleapis, eslint 관련 devDep 정합.
2. `pnpm -r build` — 세 패키지 통과.
3. `pnpm -r lint` — 통과. **실증**: 임시로 audit_log 접근 코드 삽입 → lint 실패 → 되돌림. 실증 결과 보고에 포함.
4. `pnpm -r test` — 기존 21 + 새 단위 통과.
5. `pnpm test:emu` — 기존 5 + `writeAudit.emu.test.ts` (2~3 케이스) + `usersList.emu.test.ts` (허용·거부 최소 2 케이스) 통과.
6. **작업 브랜치 push**: `git push -u origin feat/users-list` (또는 유사 이름) 성공. 브랜치 이름을 보고에 명시.

### 판정 불가로 두는 것

- **실 Google Admin Directory API 호출** — 다음 오더 UI + 사용자 콘솔 조치 후 헤드가 실측.
- **CI 실행 결과** — 원격 실행은 사용자 관찰.

### 다음 오더 (참고, 이 오더 밖)

- 계정 목록 UI (`/admin/accounts` 페이지 · TanStack Query 훅 · shadcn/ui Table)
- 실 로그인 시험 통합

## 상태 보고 (필수)

완료 시 다음을 `#general` 스레드에 **`@Claude Code_Honey` 포함해서** 보고:
- **원격 브랜치 이름** (필수 — 지난 오더 무push 실수 재발 방지)
- 마지막 커밋 해시
- `git status` 결과
- 완료 확인 각 항목의 결과 (통과·실패·판정불가)
- **ESLint 실증 결과** (규칙 위반 코드 삽입 시 실패 확인)
- 오더와 다르게 진행한 부분

**push 없이 보고하면 재작업**.
