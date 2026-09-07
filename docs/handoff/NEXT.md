# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom bulk invite v0.88** — CourseMembersDialog 학생 탭에 「학급 일괄 초대」 버튼 · basic_data grade+class 선택 → 학생 이메일 순차 초대 · skip on 이미 멤버.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-bulk-invite-v88`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `1086fe1` (Codex hotfix v0.87 merge)

## 지금 할 것 — Classroom 학급 일괄 초대

### 왜

학교 실사용: 학기 시작 시 각 반 학생 30~40명을 코스 하나에 일일이 이메일 입력하는 건 비현실적. `basic_data` 에 이미 학년/반/학생 rosters 있음.

기존 Groups 도메인에 `AutoInviteStudentsDialog` 있음 (`packages/web/src/routes/admin/AutoInviteStudentsDialog.tsx`). 하지만 Groups 는 이메일 규칙 (`class-2c@cam.hs.kr`) 으로 반과 그룹 자동 매칭. Classroom 코스는 이메일 없음 · 자동 매칭 불가능.

**해결**: 관리자가 코스 안에서 「학급 일괄 초대」 클릭 → basic_data 에서 학년+반 선택 → 해당 반 학생 이메일 미리보기 → 실행. 순차 초대 · 이미 멤버는 skip.

**하지 않는 것**:
- transfer_owner (v0.89+ 별도)
- Chat members.add (v0.90+ · Directory 리졸버 필요)
- 코스 → 반 자동 매칭 (naming convention 정해지면 별도 slice)
- 교사 자동 배정 (당분간 수동)

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/ClassroomBulkInviteDialog.tsx` — 학년/반 선택 + preview + 실행 진행 다이얼로그
- `packages/web/tests/ClassroomBulkInviteDialog.test.tsx` (시나리오 5~7)

**수정 대상**:
- `packages/web/src/routes/admin/CourseMembersDialog.tsx` — 학생 탭 하단에 「학급 일괄 초대」 버튼 추가 · 클릭 시 새 다이얼로그 open

**손대지 마라**:
- classroom callable (list · patch · delete · rosters · CRUD) 그대로.
- basic_data hook 그대로 (`useBasicDataGet`).
- classroomStudentsAdd hook 재사용.
- 다른 도메인.

### 세부 요구

#### 1. `ClassroomBulkInviteDialog.tsx`

**Props**:
```ts
export interface ClassroomBulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;         // 필수 (열릴 때 courseId 확정)
  courseName?: string;
  onDone?: () => void;
}
```

**Phase state**: `'select' | 'preview' | 'running' | 'done'`

**Hooks**:
- `useBasicDataGet(selectedYear)` — 학년 선택 UI 재사용 위해 year selector 도 필요 (현재 연도 기본)
- `useClassroomStudentsAdd()` — 순차 호출용 (mutateAsync)

**Phase: select**
- 학년/반 선택 grid: basic_data 의 grades → 각 학년 → 각 반 · 클릭 시 selected.
- 선택 시 rosters 학생 이메일 preview 표시.
- 「미리보기」 버튼 (활성화: grade/class 선택 후) → phase='preview'.

**Phase: preview**
- 선택 반의 학생 이메일 목록 (rosters[grade][class]).
- 학생 수 (예: 「32명」).
- 확인 텍스트 input (학생 수 정확히 타이핑) — `AutoInviteStudentsDialog` 패턴 재사용.
- 「초대 실행」 버튼 (활성화: 확인 정확) → phase='running'.

**Phase: running**
- 순차 `mutateAsync({ courseId, userId: email })` 반복.
- 각 결과 로컬 array 에 push (ok | skipped | failed).
- 진행률 (progress / total) + progress bar.
- close 차단 (`if (phase === 'running') return`).
- `isAlreadyMemberError` 헬퍼 (`AutoInviteStudentsDialog.tsx` 참고): message 안에 `already`, `duplicate`, `member exists`, `409` 있으면 skip 으로 분류.

**Phase: done**
- ok / skipped / failed 카운트.
- skipped · failed 목록 (max 40 · overflow scroll).
- 「확인」 → onOpenChange(false) + onDone?.().
- 성공 시 부모 dialog 의 studentsQuery invalidate (queryClient.invalidateQueries(['classroom', 'students', courseId]))

**testid**:
- year select: `bulk-invite-year-input`
- grade/class button: `bulk-invite-class-btn-${grade}-${class}`
- preview: `bulk-invite-preview`
- confirm input: `bulk-invite-confirm-input`
- execute: `bulk-invite-execute-btn`
- running progress: `bulk-invite-running`
- done: `bulk-invite-done` · skipped 리스트: `bulk-invite-skipped` · failed: `bulk-invite-failures`

#### 2. `CourseMembersDialog.tsx` — 「학급 일괄 초대」 버튼 추가

**수정**:

학생 탭 && data 로드 완료 상태에서, add form 하단에 (그리고 표 위에) 버튼 추가:

```tsx
{tab === 'students' && courseId && (
  <div className="flex justify-end mb-2">
    <Button
      variant="secondary"
      onClick={() => setBulkInviteOpen(true)}
      disabled={anyPending}
      data-testid="course-members-bulk-invite-btn"
    >
      학급 일괄 초대
    </Button>
  </div>
)}
```

**state**:
```ts
const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
```

**Dialog render** (parent dialog 안 · Dialog nesting):
```tsx
{courseId && (
  <ClassroomBulkInviteDialog
    open={bulkInviteOpen}
    onOpenChange={setBulkInviteOpen}
    courseId={courseId}
    courseName={courseName}
  />
)}
```

**주의**:
- 「학급 일괄 초대」 는 학생 탭에서만 (교사 탭은 렌더 안 함).
- anyPending 중 disabled.
- Dialog nested 는 shadcn dialog 로 지원 (별개 z-index).

#### 3. 테스트

**`ClassroomBulkInviteDialog.test.tsx`** (5~7 신규):
1. open=false → 미렌더.
2. open=true + basic_data 로드 후 → phase select 상태 · 학년/반 버튼 렌더.
3. 반 선택 → preview 학생 이메일 리스트 렌더.
4. 확인 텍스트 오류 → 「초대 실행」 disabled.
5. 「초대 실행」 클릭 → mock classroomStudentsAdd 순차 호출 · 완료 후 done phase · ok 카운트 정확.
6. 이미 멤버 오류 → skipped 로 분류 · skipped 리스트 렌더.
7. 다른 오류 → failed 로 분류 · failed 리스트 렌더.

**`CourseMembersDialog.test.tsx`** (2~3 신규):
1. 학생 탭 · 로드 완료 → 「학급 일괄 초대」 버튼 렌더 (data-testid course-members-bulk-invite-btn).
2. 교사 탭 → 렌더 안 함.
3. 버튼 클릭 → bulkInviteOpen state 변경 (mock spy 로 검증).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 847 + 신규 7~10 = 854~857 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 코스 「멤버」 → 학생 탭 → 「학급 일괄 초대」 → 학년/반 선택 → preview → 실행 → 결과.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Classroom bulk invite** — 실 계정 · 실 rosters · 실 코스 필요.
- **transfer_owner** — v0.89+ 별도.
- **Chat bulk 초대** — v0.90+ (Directory 리졸버).
- **코스 → 반 자동 매칭** — 별도 slice (naming convention 필요).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): ClassroomBulkInviteDialog (basic_data → classroom.students 순차 초대)`
2. `feat(web): CourseMembersDialog 「학급 일괄 초대」 버튼 통합`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-bulk-invite-v88`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
