# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom students add/delete v0.86** — courses.students.create + delete callable + CourseMembersDialog 학생 탭 편집 UI. v0.85 teacher CRUD 패턴을 학생 탭으로 확장.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-students-crud-v86`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4 개.

## 기준 커밋

**Base**: `09ccb9b` (classroom teachers CRUD v0.85 merge)

## 지금 할 것 — classroom students add + delete

### 왜

v0.85 로 교사 편집 완비. 이제 학생 편집 (같은 패턴 · endpoint 만 다름):
- **추가**: `courses.students.create({ courseId, requestBody: { userId } })`
- **삭제**: `courses.students.delete({ courseId, userId })`

Classroom API 는 학생 add 도 `userId` 필드에 email 그대로 수용 · Directory 리졸버 여전히 불필요.

**하지 않는 것**:
- transfer_owner (v0.87+ 별도)
- 자동 배정 (basic_data rosters → classroom students) — v0.88+ 별도
- Chat members.add — v0.89+ (Directory 리졸버 필요)

### 이 과제가 바꿀 경로

**신규 파일** (v0.85 teacher 파일들의 학생 버전):
- `packages/functions/src/callable/classroom/studentsAdd.ts`
- `packages/functions/src/callable/classroom/studentsDelete.ts`
- `packages/functions/tests/classroomStudentsAdd.test.ts` (시나리오 7)
- `packages/functions/tests/classroomStudentsDelete.test.ts` (시나리오 7)
- `packages/web/src/api/classroomStudentsAdd.ts` (useMutation)
- `packages/web/src/api/classroomStudentsDelete.ts` (useMutation)
- `packages/web/tests/classroomStudentsAdd.test.ts` (시나리오 2)
- `packages/web/tests/classroomStudentsDelete.test.ts` (시나리오 2)

**수정 대상**:
- `packages/functions/src/google/classroomClient.ts` — students.create + delete 인터페이스
- `packages/functions/src/index.ts` — export 2건
- `firebase.json` — rewrites 2건
- `packages/web/src/routes/admin/CourseMembersDialog.tsx` — 학생 탭에 이메일 추가 폼 + 각 행 「삭제」 (현재는 `-` 만 렌더)
- `packages/web/tests/CourseMembersDialog.test.tsx` — 학생 편집 시나리오 3~4 추가

**손대지 마라**:
- teachersAdd · teachersDelete · teachersList · studentsList · patch · delete · list 그대로.
- 다른 도메인.

### 세부 요구

#### 1~4 (functions) — teachersAdd/Delete 파일을 그대로 복사·바꿔치기

**바꿀 것**:
- 클래스명 · export 명: `classroomTeachersAdd` → `classroomStudentsAdd` 등.
- endpoint: `courses.teachers.create` → `courses.students.create` · `courses.teachers.delete` → `courses.students.delete`.
- audit action: `classroom.teachers.add` → `classroom.students.add` · `classroom.teachers.delete` → `classroom.students.delete`.
- audit target 경로: `courses/{id}/teachers/{userId}` → `courses/{id}/students/{userId}`.
- response type: `ClassroomTeacher` → `ClassroomStudent`.
- **Cap 는 동일** (`classroom.write`) · Scope 도 동일 (`classroom.rosters`).
- 정규식·validation·mapUpstreamError·error 매핑 모두 동일.

**중요**: teachersAdd/Delete 를 「그대로 참조」 하지 말고 「그대로 복제 후 명칭 변경」. helper 추상화 시도 금지 (지금 단계 · 두 도메인 밖에 없음 · 추후 patterns.md 로 통합 여부 재검토).

#### 5. classroomClient.ts

```ts
students: {
  list: ..., // 기존
  create: (params: {
    courseId: string;
    requestBody: { userId: string };
  }) => Promise<{ data: ClassroomStudent }>;
  delete: (params: { courseId: string; userId: string }) => Promise<{ data: {} }>;
};
```

#### 6. hooks (web)

teachersAdd/Delete hook 그대로 복사 · queryKey `['classroom', 'students', courseId]` invalidate.

#### 7. `CourseMembersDialog.tsx` — 학생 편집

**현재 학생 탭**:
- 표 (이름 · 이메일 · userId) + 관리 컬럼 `-`.

**변경**:

`tab === 'students'` 일 때도 add form + 관리 컬럼 「삭제」 표시. 즉 학생/교사 두 탭에서 동일한 편집 UI 노출.

**함수**:
```ts
const addTeacherMutation = useClassroomTeachersAdd();
const deleteTeacherMutation = useClassroomTeachersDelete();
const addStudentMutation = useClassroomStudentsAdd();
const deleteStudentMutation = useClassroomStudentsDelete();

const currentAdd = tab === 'teachers' ? addTeacherMutation : addStudentMutation;
const currentDelete = tab === 'teachers' ? deleteTeacherMutation : deleteStudentMutation;

const handleAdd = async () => {
  if (!courseId || !addEmail.trim()) return;
  try {
    await currentAdd.mutateAsync({ courseId, userId: addEmail.trim() });
    setAddEmail('');
  } catch { /* error rendered from mutation */ }
};

const handleDelete = async (userId: string) => {
  if (!courseId) return;
  try {
    await currentDelete.mutateAsync({ courseId, userId });
  } catch { /* error rendered from mutation */ }
};
```

**add form / delete button 은 두 탭 모두 렌더**. 조건 `tab === 'teachers'` 검사 제거.

**testid**:
- add: `course-members-add-btn` (동일) · `course-members-add-email` (동일)
- 삭제: `course-member-delete-btn-${userId}` (동일)

**주의**:
- 학생 자동 배정 (basic_data rosters 사용) 은 별도 슬라이스. 이번엔 수동 이메일 추가만.

#### 8. 테스트

**functions**: teachersAdd/Delete 테스트 (7 시나리오씩) 복제. 시나리오 6 assertion 은 audit action `classroom.students.add` · `classroom.students.delete` 확인.

**web `classroomStudentsAdd.test.ts` · `classroomStudentsDelete.test.ts`** (2 + 2): 위 hooks 200/error 시나리오.

**web `CourseMembersDialog.test.tsx`** (3~4 신규):
1. 학생 탭 → 「추가」 폼 렌더.
2. 학생 탭에서 이메일 입력 후 「추가」 → callClassroomStudentsAdd 호출.
3. 학생 행 「삭제」 → callClassroomStudentsDelete 호출.
4. mutations 별개 · teacher tab 삭제가 student 데이터 invalidate 하지 않음 (query key 별개).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 816 + 신규 20~22 = 836~838 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 코스 「멤버」 → 학생 탭에서 이메일 추가 · 각 학생 삭제 동작
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Classroom student add/delete** — 실 계정 필요.
- **transfer_owner** — v0.87+ 별도.
- **자동 배정 (basic_data 활용)** — v0.88+ 별도.
- **Chat members.add** — v0.89+ 별도 (Directory 리졸버 필요).

### 커밋 규칙

**4 커밋 분리**:
1. `feat(functions): classroom.students.add callable + client.students.create + firebase rewrite`
2. `feat(functions): classroom.students.delete callable + client.students.delete + firebase rewrite`
3. `feat(web): classroomStudentsAdd/Delete API + mutation hooks`
4. `feat(web): CourseMembersDialog 학생 편집 UI (동일 컴포넌트 · tab 별 mutation 스위치)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-students-crud-v86`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
