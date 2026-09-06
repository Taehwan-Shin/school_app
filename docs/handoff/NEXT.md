# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex hotfix v0.87** — CourseMembersDialog 세션 reset + pending close 차단 + 2-step 삭제 확인 + pending 중 전체 행 disabled. 교사 · 학생 두 탭 통합 적용.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/course-members-dialog-codex-v87`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `2e6664b` (classroom students CRUD v0.86 merge)

## 지금 할 것 — Codex P1 + P2 통합 hotfix

### 왜

Codex 감사 (`c574e50` v0.85, 학생 탭 상속 후 v0.86 에도 동일) 결과 실패 2 건:

**P1** — CourseMembersDialog.tsx:44 — session leak:
- `addEmail` 과 mutation error 를 close / courseId 변경 시 초기화 안 함.
- pending 중 close 도 허용 → A 코스 요청 중 B 코스 재열면 이전 완료 콜백이 B 입력을 지우거나 A 오류가 B 화면에 남음.

**P2** — CourseMembersDialog.tsx:209 — delete 즉시 실행:
- 교사/학생 삭제가 확인 없이 한 번의 클릭으로 즉시 실행.
- pending 중 다른 행은 계속 활성 → 여러 명을 실수로 연속 제거 가능.

교사 탭 (v0.85) 와 학생 탭 (v0.86) 모두 상속했으므로 두 탭 통합 fix.

**하지 않는 것**: 다른 도메인. Students · teachers CRUD 로직 자체는 유지. 이번은 dialog UX/state 만.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/CourseMembersDialog.tsx` — session reset useEffect + pending close 차단 + 2-step 삭제 + 전체 행 disabled
- `packages/web/tests/CourseMembersDialog.test.tsx` — 시나리오 추가 6~8 (session reset · pending close · 2-step 삭제 · 전체 행 lock)

**손대지 마라**:
- teachersAdd/Delete · studentsAdd/Delete callable · hook 그대로 (server-side 는 문제 없음).
- classroom.list · patch · delete · rosters 그대로.
- 다른 도메인.

### 세부 요구

#### 1. Session reset (P1)

`useEffect` 추가:

```ts
import { useState, useEffect } from 'react';

useEffect(() => {
  if (open && courseId) {
    setAddEmail('');
    setDeleteConfirmUserId(null);   // 2-step 삭제 state (아래)
    setTab('teachers');              // 매 open 마다 teachers 로 초기화
    addTeacherMutation.reset();
    deleteTeacherMutation.reset();
    addStudentMutation.reset();
    deleteStudentMutation.reset();
  }
}, [open, courseId]);
```

**주의**:
- `open` false → true 로 바뀔 때, 또는 courseId 가 바뀔 때 초기화.
- mutation.reset() 은 `error` · `isPending` 등을 clear (react-query hook 표준 API).

#### 2. Pending close 차단 (P1)

```ts
const anyPending =
  addTeacherMutation.isPending ||
  deleteTeacherMutation.isPending ||
  addStudentMutation.isPending ||
  deleteStudentMutation.isPending;

const handleOpenChange = (next: boolean) => {
  if (!next && anyPending) return;   // pending 중 close 무시
  onOpenChange(next);
};
```

Dialog · 「닫기」 버튼 모두 `handleOpenChange` 사용.

#### 3. Delete 2-step 확인 (P2)

**state 추가**:
```ts
const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
```

각 행 관리 셀:
```tsx
<TableCell className="text-right">
  {deleteConfirmUserId === m.userId ? (
    <div className="flex gap-2 justify-end">
      <button
        type="button"
        onClick={() => handleDelete(m.userId)}
        disabled={currentDelete.isPending}
        data-testid={`course-member-confirm-delete-btn-${m.userId}`}
        className="text-state-danger font-semibold underline text-small cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {currentDelete.isPending ? '삭제 중...' : '정말 삭제?'}
      </button>
      <button
        type="button"
        onClick={() => setDeleteConfirmUserId(null)}
        disabled={currentDelete.isPending}
        data-testid={`course-member-cancel-delete-btn-${m.userId}`}
        className="text-fg-secondary underline text-small cursor-pointer disabled:opacity-40"
      >
        취소
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setDeleteConfirmUserId(m.userId)}
      disabled={currentDelete.isPending || anyPending}
      data-testid={`course-member-delete-btn-${m.userId}`}
      className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
    >
      삭제
    </button>
  )}
</TableCell>
```

**handleDelete 수정**:
```ts
const handleDelete = async (userId: string) => {
  if (!courseId) return;
  try {
    await currentDelete.mutateAsync({ courseId, userId });
    setDeleteConfirmUserId(null);   // 성공 시 confirm state 초기화
  } catch {
    // 에러는 currentDelete.error 로 렌더 (state 는 유지 · 사용자가 취소하거나 재시도 결정)
  }
};
```

**tab 변경 시 confirm 초기화**:
```ts
useEffect(() => {
  setDeleteConfirmUserId(null);
}, [tab]);
```

#### 4. Pending 중 전체 행 disabled (P2)

이미 위 확인 버튼 `disabled={currentDelete.isPending || anyPending}` 로 커버. 확인 상태 진입한 행은 자체적으로 disabled (currentDelete.isPending).

Add 폼도:
```tsx
<Button
  onClick={handleAdd}
  disabled={!addEmail.trim() || anyPending}
  data-testid="course-members-add-btn"
>
  {currentAdd.isPending ? '추가 중...' : '추가'}
</Button>
```

Add input 도 pending 중 disabled:
```tsx
<input
  type="email"
  value={addEmail}
  onChange={(e) => setAddEmail(e.target.value)}
  disabled={anyPending}
  ...
/>
```

Tab 버튼 도 pending 중 disabled:
```tsx
<button
  type="button"
  onClick={() => setTab('teachers')}
  disabled={anyPending}
  ...
>
```

#### 5. 테스트 시나리오 (`CourseMembersDialog.test.tsx`)

기존 시나리오 15 유지 · 신규 6~8 추가:

16. `open=true` → courseId 변경 → addEmail · mutation.error 리셋 확인.
17. `open=true` → close 시도 (`handleOpenChange(false)`), mutation.isPending true 이면 미호출.
18. 각 행 「삭제」 클릭 → 확인 버튼 나타남 (원 「삭제」 버튼은 사라짐).
19. 「취소」 클릭 → 확인 사라짐 · 원 「삭제」 복원.
20. 「정말 삭제?」 클릭 → callClassroomTeachers/StudentsDelete 호출 · 성공 시 confirm state 초기화.
21. tab 「학생」 클릭 시 teacher 탭의 confirm state 초기화.
22. delete pending 중 다른 행 「삭제」 버튼 disabled.
23. add pending 중 tab 버튼 · add input · delete 버튼 모두 disabled.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 839 + 신규 6~8 = 845~847 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 코스 「멤버」 → 다른 코스로 전환 시 입력/오류 초기화 확인.
   - 삭제 → 확인 → 실행 흐름 · pending 중 다른 행 disabled 확인.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Classroom 액션 동작** — 실 계정 필요.
- **자동 배정** — v0.88+ 별도.
- **transfer_owner** — v0.88+ 별도.
- **Chat members.add** — v0.89+ (Directory 리졸버).

### 커밋 규칙

**1 커밋** (dialog 단일 파일 + 테스트만 · 로직 분리 불필요):

`fix(web): CourseMembersDialog session reset + pending close block + 2-step delete confirm + row lock (Codex v0.85 P1+P2)`

`git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/course-members-dialog-codex-v87`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
