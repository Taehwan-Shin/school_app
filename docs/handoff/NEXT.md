# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **계정 목록 UI 슬라이스** — `usersList` callable 을 부르는 관리자 화면.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/...` 로 올린다
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript 컴파일 · ESLint · Vitest · 신규 UI 테스트

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시 명시). 지난 오더 3~4 커밋 분리를 안 지켰다 (단일 커밋) — 이번엔 최소 2~3 커밋으로 분리.

## 기준 커밋

**Base**: `8c7fa81` (users.list slice 병합 승인)

## 지금 할 것 — 관리자 계정 목록 화면

### 왜

`usersList` 서버 callable 이 서버 층에서 검증·감사까지 완료됐다. 이제 사용자가 실제로 볼 수 있는 첫 UI 를 붙인다. **관리자가 `/admin` 화면에서 계정 목록 표를 본다.** 이 표가 워크스페이스 계정 관리의 진입점이 된다.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/api/functions.ts` — Firebase Functions 클라이언트 초기화 헬퍼 (aisa-northeast3, emulator 자동 연결)
- `packages/web/src/api/usersList.ts` — TanStack Query 훅 `useUsersList()`
- `packages/web/src/routes/admin/AccountsTable.tsx` — 표 컴포넌트
- `packages/web/src/routes/admin/index.tsx` — `/admin` 페이지 (기존 껍데기 대체)
- `packages/web/tests/AccountsTable.test.tsx` — 컴포넌트 테스트 (mocked query)
- `packages/web/tests/useUsersList.test.ts` — 훅 테스트 (mocked callable)

**기존 파일 수정**:
- `packages/web/src/lib/firebase.ts` — Firebase Functions 초기화 추가 (이미 있으면 확인만)
- `packages/web/src/App.tsx` — QueryClientProvider 감싸기 (아직 없으면)
- `packages/web/package.json` — `@tanstack/react-query` devDep 확인 (아직 없으면 추가)
- shadcn/ui Table 컴포넌트 추가 (`pnpm dlx shadcn@latest add table`)
- `packages/web/src/routes/admin.tsx` (또는 유사) 기존 껍데기 파일 — 신규 index.tsx 로 대체 또는 그 안에 표 삽입

**기존 파일 삭제**: 없음. 껍데기 페이지는 계정 표를 담는 컨테이너로 진화.

### 세부 요구

#### 1. Functions 클라이언트 헬퍼

`packages/web/src/api/functions.ts`:

```ts
import { getFunctions, connectFunctionsEmulator, httpsCallable, HttpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const functions = getFunctions(app, 'asia-northeast3');

if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export function getCallable<Req, Res>(name: string): HttpsCallable<Req, Res> {
  return httpsCallable<Req, Res>(functions, name);
}
```

**주의**: `firebase.ts` 에 이미 `getFunctions` 초기화가 있으면 중복하지 말고 `firebase.ts` 를 확장. 확장한 경우 이 파일은 얇게.

#### 2. TanStack Query 훅

`packages/web/src/api/usersList.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { getCallable } from './functions';

export interface UserItem {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath: string;
  isAdmin: boolean;
  isSuspended: boolean;
}

interface UsersListResponse {
  users: UserItem[];
}

const call = getCallable<{}, UsersListResponse>('usersList');

export function useUsersList(enabled = true) {
  return useQuery({
    queryKey: ['users', 'list'],
    queryFn: async () => (await call({})).data,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
```

**Google 액세스 토큰 · 스코프 헤더**:
Firebase Functions 클라이언트 SDK 의 `httpsCallable` 은 `Authorization: Bearer <ID토큰>` 을 자동으로 붙이지만 커스텀 헤더를 안 붙인다. 서버 미들웨어가 요구하는 `X-Google-Access-Token` · `X-Google-Scopes` 를 붙이려면 다음 중 하나:
- 옵션 A — `httpsCallable` 옵션의 `context` 사용 (일부 SDK 버전은 미지원). 시도 후 실패 시 옵션 B.
- 옵션 B — 클라이언트 SDK 를 우회하고 `fetch()` 로 직접 `POST` (endpoint URL 은 `functions/{region}/{name}`). Authorization 은 `getIdToken()` 으로. 커스텀 헤더 자유.

**옵션 B 를 채택**. 클라이언트 SDK 의 `httpsCallable` 을 쓰지 않고 얇은 fetch 헬퍼를 만들어라. 예:

```ts
async function callUsersList(): Promise<UsersListResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();

  // Google access token 은 로그인 시 획득해 세션에 저장해 둔 값 사용
  // (첫 슬라이스 lib/auth.tsx 에서 GoogleAuthProvider.credentialFromResult 로 얻은 accessToken)
  const googleAccessToken = getGoogleAccessTokenFromSession(); // 신설 헬퍼

  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/asia-northeast3/usersList`
    : `https://asia-northeast3-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/usersList`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,
      'X-Google-Scopes': 'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({ data: {} }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `http_${res.status}`);
  }
  const body = await res.json();
  return body.result ?? body;
}
```

**Google 액세스 토큰 저장** — `packages/web/src/lib/auth.tsx` 의 `signInWithGoogle` 이 반환한 credential 에서 `GoogleAuthProvider.credentialFromResult(result)?.accessToken` 을 획득. **`sessionStorage` 나 컨텍스트** 로 짧게 보관 (localStorage 금지 — `firebase_layout.md` §7). 개발 emulator 모드에서는 임의 값 (`'emulator-fake-token'`) 을 넣어 둔다.

##### 개발 모드 (Emulator) 처리
- Emulator 에서는 실 Google access token 이 없다.
- `signInWithEmulator()` 성공 시 `sessionStorage.setItem('googleAccessToken', 'emulator-fake-token')` 설정.
- 서버 미들웨어는 `FIREBASE_AUTH_EMULATOR_HOST` 감지 시 tokeninfo 우회 (이미 구현). 스코프는 `X-Google-Scopes` 헤더로 명시.

#### 3. 표 컴포넌트

`packages/web/src/routes/admin/AccountsTable.tsx`:

- shadcn/ui Table 컴포넌트 사용.
- 컬럼: **Email · 이름 · 조직 단위 · 관리자 · 정지**
- `useUsersList()` 로 데이터 취득. `isLoading`·`error`·`data` 처리.
- 에러 표시는 사용자 친화적 (권한 부족 시 「이 기능은 관리자만 사용할 수 있습니다」).
- 빈 상태: 「계정이 없습니다」.
- **정렬·필터·페이지네이션은 이 오더 밖** — 데이터 크기 커지면 다음 슬라이스.

#### 4. `/admin` 페이지

- 기존 껍데기 페이지에 표 삽입.
- 페이지 상단 제목 유지, 표를 본문으로.
- 라우팅은 이미 있음. `RoleGuard` 는 admin 이상만 통과 — 확인.

#### 5. 테스트

**단위**:
- `useUsersList.test.ts` — `getCallable` mock, `QueryClientProvider` wrapper. 성공·실패·로딩 세 상태.
- `AccountsTable.test.tsx` — `useUsersList` mock 으로 각 상태 렌더 검증.
  - 로딩 → 로딩 표시
  - 에러 → 에러 메시지
  - 빈 데이터 → 빈 메시지
  - 정상 두 행 → 두 행 렌더

**통합**: 이 오더 밖 (실 emulator + 실 usersList 는 다음 오더).

### 완료 확인 방법

1. `pnpm install` — 새 devDep (`@tanstack/react-query`, shadcn table 종속) 정합.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 새 UI 테스트 통과. 기존 31 + web 5 (routes 3 · auth 2) → 신규 훅·표 테스트로 40+ 목표.
5. `pnpm --filter @school-app/web dev` 로 웹 뜨는지 확인 (실행 자체만).
6. 프로덕션 빌드 시 emulator 접속 코드가 제거되는지 확인 (`import.meta.env.DEV` gate). grep 결과 보고.

### 판정 불가로 두는 것

- **실 emulator 에서 로그인 → `/admin` 도달 → 표에 실 데이터** — 이 자리 Java 부재로 미실행. 헤드 또는 사용자가 실측.
- **실 Google Admin Directory 목록** — 사용자 콘솔 조치 (OAuth 도메인 · Identity Platform) 후 실측.

### 커밋 규칙

**최소 2~3 커밋 분리** (지난 오더는 단일 커밋으로 리뷰 부담 큼):
1. `feat(web): Functions 클라이언트 헬퍼 + Google access token 세션 헬퍼`
2. `feat(web): useUsersList 훅 + fetch 기반 callable 호출`
3. `feat(web): 계정 목록 표 컴포넌트 + /admin 화면 통합`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/accounts-ui` (또는 유사).

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함하여:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- prod 빌드 grep 결과 (emulator 코드 미포함 확인)
- 오더 대비 차이

push 없이 보고 시 재작업.
