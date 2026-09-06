# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom teachers add/delete v0.85** — courses.teachers.create + delete callable + CourseMembersDialog 편집 UI (교사 탭에서 이메일 추가 · 각 행 삭제).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-teachers-crud-v85`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4 개.

## 기준 커밋

**Base**: `1afd4f6` (classroom rosters v0.84 merge)

## 지금 할 것 — classroom teachers add + delete

### 왜

v0.84 로 rosters 조회 완비. 이제 교사 편집:
- **추가**: `courses.teachers.create` — Classroom API 는 `userId` 필드에 이메일 그대로 받아줌 (도메인 admin 계정 · classroom.rosters scope 조합).
- **삭제**: `courses.teachers.delete`

Chat 과 달리 Directory API email→userId 리졸버 불필요 (Classroom API 자체가 email 수용).

**하지 않는 것**:
- students 편집 — v0.86 별도 (teacher CRUD 안정화 후).
- transfer_owner — v0.87+ 별도.
- 자동 배정 (basic_data rosters) — v0.88+ 별도.
- Chat members.add — v0.89+ (Directory helper 필요).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/classroom/teachersAdd.ts` — 신규 callable
- `packages/functions/src/callable/classroom/teachersDelete.ts` — 신규 callable
- `packages/functions/tests/classroomTeachersAdd.test.ts` (시나리오 7)
- `packages/functions/tests/classroomTeachersDelete.test.ts` (시나리오 7)
- `packages/web/src/api/classroomTeachersAdd.ts` (useMutation)
- `packages/web/src/api/classroomTeachersDelete.ts` (useMutation)
- `packages/web/tests/classroomTeachersAdd.test.ts` (시나리오 2)
- `packages/web/tests/classroomTeachersDelete.test.ts` (시나리오 2)

**수정 대상**:
- `packages/functions/src/google/classroomClient.ts` — teachers.create · teachers.delete 인터페이스
- `packages/functions/src/index.ts` — export 2건
- `firebase.json` — rewrites 2건 (`/api/classroomTeachersAdd` · `/api/classroomTeachersDelete`)
- `packages/web/src/routes/admin/CourseMembersDialog.tsx` — 교사 탭에 이메일 입력 · 「추가」 버튼 + 각 행 「삭제」 버튼
- `packages/web/tests/CourseMembersDialog.test.tsx` — 편집 시나리오 추가 (3~4개)

**손대지 마라**:
- classroom.list · patch · delete · teachersList · studentsList 그대로.
- students 편집 관련 UI 는 이번 슬라이스 미포함 (v0.86 별도).
- 다른 도메인.

### 세부 요구

#### 1. `classroomClient.ts` — teachers.create · teachers.delete

```ts
courses: {
  ...,
  teachers: {
    list: ..., // 기존
    create: (params: {
      courseId: string;
      requestBody: { userId: string };  // email or userId
    }) => Promise<{ data: ClassroomTeacher }>;
    delete: (params: { courseId: string; userId: string }) => Promise<{ data: {} }>;
  };
};
```

#### 2. `classroom/teachersAdd.ts` — 교사 추가

Cap `classroom.write` · Scope `classroom.rosters`.

```ts
export interface ClassroomTeachersAddRequest {
  courseId: string;
  userId: string;   // email (권장) 또는 userId
}

export interface ClassroomTeachersAddResponse {
  teacher: ClassroomTeacher;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.rosters',
] as const;

const COURSE_ID_RE = /^[A-Za-z0-9_-]+$/;
const USER_ID_RE = /^[A-Za-z0-9._@+\-]+$/;   // email 또는 numeric id 허용

// 인증 → Cap classroom.write → Scope → 형식 검증 (courseId · userId 둘 다) →
//   courses.teachers.create({ courseId, requestBody: { userId } }) →
//   audit `classroom.write` · action 'classroom.teachers.add' · target `courses/{courseId}/teachers/{userId}` · message=`userId=${userId}`
```

#### 3. `classroom/teachersDelete.ts` — 교사 삭제

Cap `classroom.write` · Scope `classroom.rosters`.

```ts
export interface ClassroomTeachersDeleteRequest {
  courseId: string;
  userId: string;   // 서버 응답의 userId 그대로 (email 아니라 numeric id 인 경우도 있음)
}

// 형식: courseId · userId 정규식 (같은 USER_ID_RE 재사용)
// classroom.courses.teachers.delete({ courseId, userId }) →
//   audit action 'classroom.teachers.delete' · target `courses/${courseId}/teachers/${userId}`
```

**주의**:
- Google 은 마지막 owner (=coursework primary teacher) 삭제 거절 → 409 또는 400. `mapUpstreamError` 로 그대로 던져 UI 에서 표시.
- self-delete (본인 = 유일 owner) 도 마찬가지로 API 거절.

#### 4. functions/index.ts + firebase.json

```ts
export { classroomTeachersAdd } from './callable/classroom/teachersAdd.js';
export { classroomTeachersDelete } from './callable/classroom/teachersDelete.js';
```

`firebase.json` rewrites 2건 추가.

#### 5. 테스트

**functions `classroomTeachersAdd.test.ts`** (7 시나리오):
1. 미인증 → denied.
2. 캡 `classroom.write` 부족 → denied.
3. 스코프 `classroom.rosters` 부족 → denied.
4. courseId 형식 오류 → invalid-argument.
5. userId 형식 오류 (빈 문자열 · 공백 포함) → invalid-argument.
6. 정상 (mock teachers.create) → response.teacher.userId · audit action 'classroom.teachers.add'.
7. upstream 409 (이미 존재 등) → HttpsError · audit error · message 유지.

**functions `classroomTeachersDelete.test.ts`** (7 시나리오):
1~5 동일 패턴.
6. 정상 (mock delete) → audit action 'classroom.teachers.delete'.
7. upstream 400 (마지막 owner) → HttpsError · audit error.

#### 6. `classroomTeachersAdd.ts` · `classroomTeachersDelete.ts` — hooks

useMutation · invalidateQueries `['classroom', 'teachers', courseId]` (성공 시 rosters 자동 새로고침).

```ts
export function useClassroomTeachersAdd() {
  const qc = useQueryClient();
  return useMutation<ClassroomTeachersAddResponse, Error, ClassroomTeachersAddRequest>({
    mutationFn: callClassroomTeachersAdd,
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classroom', 'teachers', variables.courseId] });
    },
  });
}

export function useClassroomTeachersDelete() {
  const qc = useQueryClient();
  return useMutation<ClassroomTeachersDeleteResponse, Error, ClassroomTeachersDeleteRequest>({
    mutationFn: callClassroomTeachersDelete,
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classroom', 'teachers', variables.courseId] });
    },
  });
}
```

#### 7. `CourseMembersDialog.tsx` — 편집 UI (교사 탭)

**현재 구조**: 탭 (교사/학생) → 표 (이름 · 이메일 · userId).

**추가**:

교사 탭 아래 (표 위) 추가 폼:
```tsx
{tab === 'teachers' && courseId && (
  <div className="flex items-end gap-2" data-testid="course-members-add-form">
    <div className="flex-1">
      <label className="text-small text-fg-secondary mb-1 block">이메일 추가</label>
      <input
        type="email"
        value={addEmail}
        onChange={(e) => setAddEmail(e.target.value)}
        placeholder="user@cam.hs.kr"
        data-testid="course-members-add-email"
        className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
      />
    </div>
    <Button
      onClick={handleAddTeacher}
      disabled={!addEmail.trim() || addMutation.isPending}
      data-testid="course-members-add-btn"
    >
      {addMutation.isPending ? '추가 중...' : '추가'}
    </Button>
  </div>
)}
{addMutation.error && (
  <div className="border border-state-danger p-2 text-small text-state-danger" data-testid="course-members-add-error">
    추가 실패: {addMutation.error.message}
  </div>
)}
```

각 교사 행 (표 안, 이름/이메일/userId 오른쪽 4번째 컬럼):
```tsx
<TableHead className="text-right">관리</TableHead>
...
<TableCell className="text-right">
  {tab === 'teachers' ? (
    <button
      type="button"
      onClick={() => handleDeleteTeacher(m.userId)}
      disabled={deleteMutation.isPending && deleteMutation.variables?.userId === m.userId}
      data-testid={`course-member-delete-btn-${m.userId}`}
      className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
    >
      삭제
    </button>
  ) : (
    <span className="text-fg-muted text-small">-</span>
  )}
</TableCell>
```

**state 추가**:
```ts
const [addEmail, setAddEmail] = useState('');
const addMutation = useClassroomTeachersAdd();
const deleteMutation = useClassroomTeachersDelete();
```

**handlers**:
```ts
const handleAddTeacher = async () => {
  if (!courseId || !addEmail.trim()) return;
  try {
    await addMutation.mutateAsync({ courseId, userId: addEmail.trim() });
    setAddEmail('');
  } catch {
    // 에러는 addMutation.error 로 렌더
  }
};

const handleDeleteTeacher = async (userId: string) => {
  if (!courseId) return;
  try {
    await deleteMutation.mutateAsync({ courseId, userId });
  } catch {
    // 에러는 deleteMutation.error 로 렌더 (삭제는 alert 대신 hook error 사용)
  }
};
```

**주의**:
- 학생 탭에서는 편집 UI 렌더 안 함 (v0.86 별도).
- 「관리」 컬럼은 두 탭 모두 존재하되, 학생 탭에서는 「-」 만.
- 삭제는 확인 문구 없음 (교사 편집은 되돌리기 쉬움 · classroom UI 관행).

#### 8. 테스트

**web `classroomTeachersAdd.test.ts`** (2 신규): 200 → data.teacher · 400 → throws.
**web `classroomTeachersDelete.test.ts`** (2 신규): 200 → ok · 404 → throws.

**web `CourseMembersDialog.test.tsx`** (3~4 신규 · 기존 확장):
1. 교사 탭 → 「추가」 버튼 존재 · 이메일 입력.
2. 이메일 입력 후 「추가」 클릭 → callClassroomTeachersAdd 호출 (courseId, userId=email).
3. 학생 탭 → 「추가」 폼 미렌더.
4. 교사 행 「삭제」 버튼 → callClassroomTeachersDelete 호출 · rosters invalidate.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 791 + 신규 20~22 = 811~813 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 코스 「멤버」 → 교사 탭에서 이메일 추가 · 각 교사 삭제 동작
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Classroom add/delete** — 실 계정 · 실 코스 · 실 교사 필요.
- **students 편집** — v0.86 별도.
- **transfer_owner** — v0.87+ 별도.
- **자동 배정** — v0.88+ (basic_data 활용).
- **Chat members.add** — v0.89+ (Directory 리졸버 필요).

### 커밋 규칙

**4 커밋 분리**:
1. `feat(functions): classroom.teachers.add callable + client.teachers.create + firebase rewrite`
2. `feat(functions): classroom.teachers.delete callable + client.teachers.delete + firebase rewrite`
3. `feat(web): classroomTeachersAdd/Delete API + mutation hooks`
4. `feat(web): CourseMembersDialog 교사 편집 UI (이메일 추가 · 행별 삭제)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-teachers-crud-v85`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
