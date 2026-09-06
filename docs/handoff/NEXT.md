# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom rosters v0.84** — courses.teachers.list · courses.students.list callable + CourseMembersDialog UI (교사 · 학생 탭).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-rosters-v84`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `dadf553` (classroom archive/delete v0.83 merge)

## 지금 할 것 — classroom.rosters + CourseMembersDialog

### 왜

v0.83 로 courses.list · patch · delete 완비. 이제 각 코스 명단 확인:
- **교사**: `courses.teachers.list`
- **학생**: `courses.students.list`

Chat 도메인 members.list 패턴 그대로 (v0.80 · dialog + 표 · scroll container).

**하지 않는 것**:
- add/remove teacher/student (v0.85+ · Directory API email→userId 해결 필요).
- 자동 배정 (basic_data rosters 활용 · v0.86+).
- 다른 도메인.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/classroom/teachersList.ts` — 신규 callable
- `packages/functions/src/callable/classroom/studentsList.ts` — 신규 callable
- `packages/functions/tests/classroomTeachersList.test.ts` (시나리오 6~7)
- `packages/functions/tests/classroomStudentsList.test.ts` (시나리오 6~7)
- `packages/web/src/api/classroomTeachersList.ts` — fetch + useQuery hook
- `packages/web/src/api/classroomStudentsList.ts` — fetch + useQuery hook
- `packages/web/src/routes/admin/CourseMembersDialog.tsx` — 다이얼로그 (교사/학생 탭)
- `packages/web/tests/classroomTeachersList.test.ts` (시나리오 2)
- `packages/web/tests/classroomStudentsList.test.ts` (시나리오 2)
- `packages/web/tests/CourseMembersDialog.test.tsx` (시나리오 5~6)

**수정 대상**:
- `packages/functions/src/google/classroomClient.ts` — courses.teachers.list · courses.students.list 인터페이스
- `packages/functions/src/index.ts` — export 2건
- `firebase.json` — rewrites 2건 (`/api/classroomTeachersList` · `/api/classroomStudentsList`)
- `packages/web/src/routes/admin/ClassroomTable.tsx` — 관리 컬럼 「멤버」 버튼 (아카이브 왼쪽)

**손대지 마라**:
- classroom.list · patch · delete 그대로.
- chat 도메인 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `classroomClient.ts` — teachers.list · students.list

```ts
export interface ClassroomTeacher {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomStudent {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomTeachersListResponse {
  teachers?: ClassroomTeacher[];
  nextPageToken?: string;
}

export interface ClassroomStudentsListResponse {
  students?: ClassroomStudent[];
  nextPageToken?: string;
}

// ClassroomClient 에 추가:
courses: {
  list: ...,
  patch: ...,
  delete: ...,
  teachers: {
    list: (params: { courseId: string; pageSize?: number; pageToken?: string }) => Promise<{ data: ClassroomTeachersListResponse }>;
  };
  students: {
    list: (params: { courseId: string; pageSize?: number; pageToken?: string }) => Promise<{ data: ClassroomStudentsListResponse }>;
  };
};
```

#### 2. `classroom/teachersList.ts` · `studentsList.ts` — callables

두 파일 거의 동일 · 다만 endpoint · scope · response 필드 다름.

**공통**:
- Cap `classroom.read` (list · read-only)
- id 형식 검증 (COURSE_ID_RE = `/^[A-Za-z0-9_-]+$/`)
- pagination 순회 · pageSize 100
- upstream status 매핑 v0.81 helper 그대로
- audit action `classroom.read` · target `courses/{id}/teachers` 또는 `courses/{id}/students`

**Scope 차이**:
- teachersList: `https://www.googleapis.com/auth/classroom.rosters`
- studentsList: `https://www.googleapis.com/auth/classroom.rosters`

두 endpoint 모두 같은 `classroom.rosters` scope 사용 (Google 문서 확인 완료).

**중요**: login scopes 에 이미 `classroom.rosters` 있음 (v0.76). 사용자 추가 재로그인 불필요.

**Request/Response 예시** (teachersList):

```ts
export interface ClassroomTeachersListRequest {
  courseId: string;
}

export interface ClassroomTeachersListResponse {
  teachers: ClassroomTeacher[];
}
```

studentsList 동일 (`students` 필드).

#### 3. functions/index.ts + firebase.json

```ts
export { classroomTeachersList } from './callable/classroom/teachersList.js';
export { classroomStudentsList } from './callable/classroom/studentsList.js';
```

`firebase.json` rewrites 2건 추가.

#### 4. 테스트

**functions `classroomTeachersList.test.ts`** (7 시나리오):
1. 미인증 → denied.
2. 캡 `classroom.read` 부족 → denied.
3. 스코프 `classroom.rosters` 부족 → denied.
4. courseId 형식 오류 → invalid-argument.
5. 정상 (mock teachers.list) → response.teachers.length 정확.
6. pagination 2 페이지 → 모두 반환.
7. upstream 403 → HttpsError permission-denied · audit denied.

**functions `classroomStudentsList.test.ts`**: 위와 동일 (students 필드).

#### 5. `classroomTeachersList.ts` · `classroomStudentsList.ts` — hooks

`chatMembersList.ts` 패턴. useQuery · queryKey `['classroom', 'teachers', courseId]` · `['classroom', 'students', courseId]`.

```ts
export function useClassroomTeachersList(courseId: string | null, enabled = true) {
  return useQuery<ClassroomTeachersListResponse, Error>({
    queryKey: ['classroom', 'teachers', courseId],
    queryFn: () => callClassroomTeachersList({ courseId: courseId! }),
    enabled: enabled && !!courseId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

studentsList 동일.

#### 6. `CourseMembersDialog.tsx` — 탭 다이얼로그

**Props**:
```ts
export interface CourseMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  courseName?: string;
}
```

**구조**: 상단 탭 (교사 · 학생) + 하단 표.
- Tab state: `const [tab, setTab] = useState<'teachers' | 'students'>('teachers');`
- 두 hook 모두 `enabled: open && !!courseId` 로 마운트 시 병렬 호출 · React Query 캐시 이용.
- 각 탭에서 v0.81 스크롤 컨테이너 패턴 (max-h-96 · overflow-y-auto · sticky header).

**표 컬럼** (교사 · 학생 공통):
- 이름 (profile.name.fullName · fallback userId)
- 이메일 (profile.emailAddress · fallback '-')
- userId (font-mono · text-fg-secondary)

**data-testid**:
- 탭 버튼: `course-members-tab-teachers` · `course-members-tab-students`
- loading: `course-members-loading`
- error: `course-members-error`
- scroll container: `course-members-scroll-container`
- 행: `course-member-row-${userId}`

**주의**:
- teacher/student profile.emailAddress 는 노출됨 (Chat 과 다름 · 명시적 rosters scope).
- 편집 액션 없음 (v0.85+).

#### 7. `ClassroomTable.tsx` — 관리 컬럼 「멤버」 버튼

기존 6 컬럼 (이름 · 섹션 · 상태 · ID · 링크 · 관리[아카이브+삭제]) → 관리 컬럼 안에 「멤버」 버튼 추가 (아카이브 왼쪽).

```tsx
<TableCell className="text-right">
  <button
    type="button"
    onClick={() => setMembersTarget({ id: c.id, name: c.name })}
    data-testid={`classroom-members-btn-${c.id}`}
    className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong mr-3"
  >
    멤버
  </button>
  {(c.courseState === 'ACTIVE' || c.courseState === 'ARCHIVED') && (
    <button ... 아카이브/복구 ...>...</button>
  )}
  <button ... 삭제 ...>삭제</button>
</TableCell>
```

**state 추가**:
```ts
const [membersTarget, setMembersTarget] = useState<{ id: string; name?: string } | null>(null);
```

**다이얼로그 렌더**:
```tsx
<CourseMembersDialog
  open={!!membersTarget}
  onOpenChange={(o) => !o && setMembersTarget(null)}
  courseId={membersTarget?.id ?? null}
  courseName={membersTarget?.name}
/>
```

#### 8. 테스트

**web `classroomTeachersList.test.ts`** (2 신규): 200 → data.teachers · 401 → throws.
**web `classroomStudentsList.test.ts`** (2 신규): 동일 (students).

**web `CourseMembersDialog.test.tsx`** (5~6 신규):
1. `open=false` → 미렌더.
2. `open=true` + courseId null → 로딩 상태.
3. `open=true` + courseId 있음 + 기본 탭 (교사) → teachers mock 렌더.
4. 탭 「학생」 클릭 → students mock 렌더.
5. 스크롤 컨테이너 존재 확인 (v0.81 패턴).
6. 「닫기」 → `onOpenChange(false)`.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 764 + 신규 20~22 = 784~786 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 각 행 「멤버」 → 다이얼로그 → 교사/학생 탭 · 목록 표시
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Classroom rosters** — 실 계정 · 실 코스 · 실 명단 필요.
- **add/remove teacher/student** — v0.85+ 별도 (Directory API email→userId 필요).
- **자동 배정** — v0.86+ (basic_data rosters 활용).

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): classroom.teachers.list + students.list callables + client interfaces + firebase rewrites`
2. `feat(web): classroomTeachersList + classroomStudentsList API + hooks`
3. `feat(web): CourseMembersDialog + ClassroomTable 「멤버」 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-rosters-v84`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
