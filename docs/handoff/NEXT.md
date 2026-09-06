# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom.list v0.82** — Google Classroom 도메인 시작. 신규 callable `classroomList` + ClassroomTable UI + 새 라우트 `/admin/classrooms`.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-list-v82`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `7cfd73c` (Codex hotfix v0.81 merge)

## 지금 할 것 — classroom.list + ClassroomTable + 라우트

### 왜

v0.76~v0.81 로 chat 도메인 완비 (list · create · delete · members.list). 이제 클래스룸 도메인 시작. Google Classroom API `courses.list` 활용.

**하지 않는 것**:
- courses.create / delete / archive / transfer_owner (v0.83+ 별도).
- rosters (학생 · 교사 명단) — 별도 scope · 별도 slice.
- teacher 뷰 (자신 코스만) — 이번엔 admin 뷰만 (본인이 볼 수 있는 코스 전부).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/google/classroomClient.ts` — Google Classroom 클라이언트 factory
- `packages/functions/src/callable/classroom/list.ts` — 신규 callable
- `packages/functions/tests/classroomList.test.ts` — 시나리오 6~7
- `packages/web/src/api/classroomList.ts` — fetch + useQuery hook
- `packages/web/src/routes/admin/ClassroomTable.tsx` — 표 컴포넌트
- `packages/web/src/routes/admin/classrooms.tsx` — 페이지 (AdminClassroomsPage)
- `packages/web/tests/classroomList.test.ts` — 시나리오 2
- `packages/web/tests/ClassroomTable.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/functions/src/index.ts` — export `classroomList`
- `firebase.json` — hosting rewrite `/api/classroomList`
- `packages/web/src/App.tsx` — 새 라우트 `/admin/classrooms` · `/super_admin/classrooms` → AdminClassroomsPage
- `packages/web/src/components/shell/nav-items.ts` — 「클래스룸」 항목 `disabled: true` 제거 (super_admin · admin 둘 다)

**손대지 마라**:
- chat 도메인 (list · create · delete · members.list) 그대로.
- teacher nav 는 「내 클래스룸」 그대로 (v0.83+ 별도).
- 다른 도메인.

### 세부 요구

#### 1. `classroomClient.ts` — 클라이언트 factory

`chatClient.ts` 패턴 그대로.

```ts
import { google } from 'googleapis';

export interface ClassroomCourse {
  id: string;
  name?: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  creationTime?: string;
  updateTime?: string;
  enrollmentCode?: string;
  courseState?: string;      // 'ACTIVE' · 'ARCHIVED' · 'PROVISIONED' · 'DECLINED' · 'SUSPENDED'
  alternateLink?: string;    // classroom.google.com 링크
  teacherGroupEmail?: string;
  courseGroupEmail?: string;
  guardiansEnabled?: boolean;
}

export interface ClassroomCoursesListResponse {
  courses?: ClassroomCourse[];
  nextPageToken?: string;
}

export interface ClassroomClient {
  courses: {
    list: (params?: {
      pageSize?: number;
      pageToken?: string;
      teacherId?: string;
      studentId?: string;
      courseStates?: string[];
    }) => Promise<{ data: ClassroomCoursesListResponse }>;
  };
}

export function getClassroomClient(accessToken: string): ClassroomClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const classroom = google.classroom({ version: 'v1', auth });
  return classroom as unknown as ClassroomClient;
}
```

#### 2. `classroom/list.ts` — callable

`chat/list.ts` 패턴 그대로 참고. Cap `classroom.read` · Scope `classroom.courses.readonly` 또는 `classroom.courses` (login 은 이미 `classroom.courses` 있음 · 이 상위 scope 로 read 가능).

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getClassroomClient, type ClassroomCourse } from '../../google/classroomClient.js';

export interface ClassroomListRequest {}

export interface ClassroomListResponse {
  courses: ClassroomCourse[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  const status: number | undefined =
    (err as any)?.response?.status ??
    (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
  const msg = (err as Error).message ?? 'unknown';
  if (status === 401 || status === 403) {
    return new HttpsError('permission-denied', `google_upstream_denied: ${msg}`);
  }
  if (status === 404) {
    return new HttpsError('not-found', `google_upstream_not_found: ${msg}`);
  }
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
  }
  return new HttpsError('unknown', msg);
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const classroomList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ClassroomListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();

    let user;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      const actorEmail = (request.auth?.token?.email as string | undefined) ?? 'unknown';
      const claimRole = request.auth?.token?.role;
      const actorRole: Role | 'unknown' =
        claimRole === 'super_admin' || claimRole === 'admin' || claimRole === 'teacher'
          ? (claimRole as Role)
          : 'unknown';
      await writeAudit({
        actor: actorEmail, role: actorRole,
        action: 'classroom.read', target: '*',
        request_id: requestId, result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'classroom.read');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email, role: user.role,
        action: 'classroom.read', target: '*',
        request_id: requestId, result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const classroom = getClassroomClient(user.googleAccessToken);
      const results: ClassroomCourse[] = [];
      let pageToken: string | undefined;
      do {
        const res = await classroom.courses.list({ pageSize: 100, pageToken });
        results.push(...(res.data.courses ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      await writeAudit({
        actor: user.email, role: user.role,
        action: 'classroom.read', target: '*',
        request_id: requestId, result: 'ok',
        message: `listed ${results.length} classroom courses`,
      });

      return { courses: results };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email, role: user.role,
        action: 'classroom.read', target: '*',
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
```

**주의**:
- Cap `classroom.read` (shared/capabilities.ts 에 이미 존재).
- Scope `classroom.courses` (이미 login 에 있음 · read 포함).
- pagination 순회.
- upstream status 매핑 v0.81 helper 그대로.

#### 3. functions/index.ts + firebase.json

```ts
export { classroomList } from './callable/classroom/list.js';
```

`firebase.json` rewrites 에 `/api/classroomList` 추가.

#### 4. 테스트

**functions `classroomList.test.ts`** (6~7 시나리오):
1. 미인증 → denied audit.
2. 캡 부족 → denied audit.
3. 스코프 부족 (classroom.courses) → denied audit.
4. 정상 (mock classroom.courses.list) → response.courses.length 정확.
5. pagination 2 페이지 → 모두 반환.
6. Google upstream 401 → HttpsError permission-denied · audit denied.
7. Google upstream 429 → HttpsError unavailable · audit error.

#### 5. `classroomList.ts` — hook

`chatList.ts` 패턴 그대로.

```ts
import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface ClassroomCourse {
  id: string;
  name?: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  creationTime?: string;
  updateTime?: string;
  enrollmentCode?: string;
  courseState?: string;
  alternateLink?: string;
  teacherGroupEmail?: string;
  courseGroupEmail?: string;
  guardiansEnabled?: boolean;
}

export interface ClassroomListResponse {
  courses: ClassroomCourse[];
}

export async function callClassroomList(): Promise<ClassroomListResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/classroomList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/classroomList`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,
      'X-Google-Scopes': 'https://www.googleapis.com/auth/classroom.courses',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return (body.result ?? body) as ClassroomListResponse;
}

export function useClassroomList() {
  return useQuery<ClassroomListResponse, Error>({
    queryKey: ['classroom', 'list'],
    queryFn: callClassroomList,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

#### 6. `ClassroomTable.tsx` — 표 컴포넌트

`ChatSpacesTable.tsx` 패턴 참고 · 다만 create/delete 는 없음 (이번 슬라이스).

**컬럼**:
1. 이름 (name)
2. 섹션 (section)
3. 상태 (courseState — 'ACTIVE' 등을 「활성」/「보관됨」/「대기」로 번역)
4. ID (id · font-mono · text-fg-secondary)
5. 링크 (alternateLink → 새 탭 「열기」)

**data-testid**:
- container-loading: `classroom-list-loading`
- container-error: `classroom-list-error`
- container-empty: `classroom-list-empty`
- row: `classroom-row-${c.id}`
- link: `classroom-link-${c.id}`

**상태 번역 함수**:
```ts
function translateCourseState(s?: string): string {
  switch (s) {
    case 'ACTIVE': return '활성';
    case 'ARCHIVED': return '보관됨';
    case 'PROVISIONED': return '준비 중';
    case 'DECLINED': return '거절됨';
    case 'SUSPENDED': return '일시중지';
    default: return s || '-';
  }
}
```

#### 7. `classrooms.tsx` — 페이지

`chat.tsx` 패턴 그대로.

```tsx
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { ClassroomTable } from './ClassroomTable';

export function AdminClassroomsPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="클래스룸">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Classroom 코스</h2>
            <p className="text-small text-fg-secondary mt-1">
              내가 접근할 수 있는 클래스룸 코스 목록입니다. 생성 · 편집 · 아카이브는 다음 슬라이스에서 추가됩니다.
            </p>
          </div>
          <ClassroomTable />
        </section>
      </div>
    </AppShell>
  );
}
```

#### 8. App.tsx — 라우트

`AdminChatPage` 옆에 `AdminClassroomsPage` 라우트 추가 (super_admin · admin 둘 다).

#### 9. nav-items.ts — 활성화

super_admin 과 admin 의 `클래스룸` 항목에서 `disabled: true` 제거. teacher 는 그대로 (「내 클래스룸」 은 v0.83+ 별도).

#### 10. 테스트

**web `classroomList.test.ts`** (2 신규):
1. 200 응답 → hook `data.courses`.
2. 401 응답 → hook throws · status:401.

**web `ClassroomTable.test.tsx`** (4 신규):
1. loading → `classroom-list-loading` testid.
2. error → `classroom-list-error` testid.
3. 빈 목록 → `classroom-list-empty` testid.
4. 3개 코스 mock → 3 행 렌더 + 상태 번역 확인.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 721 + 신규 12~13 = 733~734 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 접근 → 로딩 → (실 코스가 없어도) 빈 상태 렌더
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Classroom API 동작** — 실 계정 · 실 코스 필요.
- **teacher 뷰** — v0.83+ 별도.
- **create/delete/archive** — v0.83+ 별도.
- **rosters** — v0.84+ 별도.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): classroom.list callable + classroomClient + firebase rewrite`
2. `feat(web): classroomList API + useClassroomList hook`
3. `feat(web): ClassroomTable + AdminClassroomsPage + 라우트 + nav 활성화`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-list-v82`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
