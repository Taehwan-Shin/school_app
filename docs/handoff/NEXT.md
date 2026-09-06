# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom archive/delete v0.83** — courses.patch (state 전환) + courses.delete callable + UI 액션 컬럼.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-archive-delete-v83`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4 개.

## 기준 커밋

**Base**: `b0351b5` (classroom.list v0.82 merge)

## 지금 할 것 — classroom archive + delete

### 왜

v0.82 로 classroom.list 완비. 이제 편집 액션 시작:
- **아카이브**: `courses.patch` 로 `courseState` 를 `ACTIVE` → `ARCHIVED` 전환 (또는 그 반대).
- **삭제**: `courses.delete` 로 완전 삭제 (Google 도 복구 불가).

Chat 도메인 delete 패턴 그대로 재사용.

**하지 않는 것**:
- create · rosters · teacher 뷰 · transfer_owner — 별도 slice (v0.84+).
- restore (ARCHIVED → ACTIVE) 는 archive 와 같은 patch endpoint 사용 → 「보관 취소」 버튼 하나 더.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/classroom/patch.ts` — courseState 전환 callable
- `packages/functions/src/callable/classroom/delete.ts` — 삭제 callable
- `packages/functions/tests/classroomPatch.test.ts` (시나리오 6~7)
- `packages/functions/tests/classroomDelete.test.ts` (시나리오 6~7)
- `packages/web/src/api/classroomPatch.ts` — fetch + useMutation
- `packages/web/src/api/classroomDelete.ts` — fetch + useMutation
- `packages/web/src/routes/admin/ArchiveClassroomDialog.tsx`
- `packages/web/src/routes/admin/DeleteClassroomDialog.tsx`
- `packages/web/tests/classroomPatch.test.ts` (시나리오 2)
- `packages/web/tests/classroomDelete.test.ts` (시나리오 2)
- `packages/web/tests/ArchiveClassroomDialog.test.tsx` (시나리오 4)
- `packages/web/tests/DeleteClassroomDialog.test.tsx` (시나리오 4)

**수정 대상**:
- `packages/functions/src/google/classroomClient.ts` — courses.patch · delete 인터페이스 추가
- `packages/functions/src/index.ts` — export
- `firebase.json` — rewrites `/api/classroomPatch` · `/api/classroomDelete`
- `packages/web/src/routes/admin/ClassroomTable.tsx` — 관리 컬럼 「아카이브/복구」 · 「삭제」 버튼

**손대지 마라**:
- classroom.list 그대로.
- chat 도메인 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `classroomClient.ts` — patch + delete

```ts
export interface ClassroomClient {
  courses: {
    list: ...;                                                    // 기존
    patch: (params: {
      id: string;
      updateMask: string;                                          // 'courseState'
      requestBody: Partial<Pick<ClassroomCourse, 'courseState' | 'name' | 'section'>>;
    }) => Promise<{ data: ClassroomCourse }>;
    delete: (params: { id: string }) => Promise<{ data: {} }>;
  };
}
```

#### 2. `classroom/patch.ts` — courseState 전환

Cap `classroom.archive` (아카이브 액션은 별도 · shared 에 이미 존재).

```ts
export interface ClassroomPatchRequest {
  id: string;                       // course id
  courseState: 'ACTIVE' | 'ARCHIVED';
}

export interface ClassroomPatchResponse {
  course: ClassroomCourse;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

const COURSE_ID_RE = /^[A-Za-z0-9_-]+$/;

// mapUpstreamError · readHeader v0.81 그대로 재사용 (helper 별도 파일 분리 안 함 · 각 callable 로컬 함수)

// 인증 → Cap `classroom.archive` → Scope classroom.courses → 형식 검증 (id · courseState in enum) →
//   classroom.courses.patch({ id, updateMask: 'courseState', requestBody: { courseState } }) →
//   audit `classroom.write` · target=`courses/{id}` · message=`courseState=${courseState}`
```

#### 3. `classroom/delete.ts` — 완전 삭제

Cap `classroom.write` (delete 캡 없음 · write 로 포함. 별도 캡 필요하면 shared 확장 이후 slice).

```ts
export interface ClassroomDeleteRequest {
  id: string;                       // course id
}

export interface ClassroomDeleteResponse {
  ok: true;
}

// 형식: id COURSE_ID_RE 검증.
// classroom.courses.delete({ id }) → audit `classroom.write` · action prefix `classroom.delete` 로 audit action 명명:
//   action: 'classroom.delete', target: `courses/${id}`
```

**주의**:
- audit action 명 `classroom.delete` — 새 action (기존 없음). audit filter UI 는 자동 · action 하드코딩 없음.
- upstream 404 는 idempotency 로 취급 (「이미 없음」) 하지 말고 그대로 not-found 로 던짐 → UI 에서 「이미 삭제됨」 문구.

#### 4. functions/index.ts + firebase.json

```ts
export { classroomPatch } from './callable/classroom/patch.js';
export { classroomDelete } from './callable/classroom/delete.js';
```

`firebase.json` rewrites 2건 추가.

#### 5. 테스트

**functions `classroomPatch.test.ts`** (7 시나리오):
1. 미인증 → denied.
2. 캡 `classroom.archive` 부족 → denied.
3. 스코프 부족 → denied.
4. id 형식 오류 → invalid-argument.
5. courseState 값 오류 (예: `'FOO'`) → invalid-argument.
6. 정상 (mock patch) → response.course.courseState === request.courseState.
7. upstream 403 → HttpsError permission-denied · audit denied.

**functions `classroomDelete.test.ts`** (7 시나리오):
1. 미인증 → denied.
2. 캡 `classroom.write` 부족 → denied.
3. 스코프 부족 → denied.
4. id 형식 오류 → invalid-argument.
5. 정상 (mock delete) → response.ok === true · audit action `classroom.delete`.
6. upstream 403 → HttpsError permission-denied · audit denied.
7. upstream 404 → HttpsError not-found · audit error.

#### 6. `classroomPatch.ts` · `classroomDelete.ts` — hooks

`chatDelete.ts` 패턴 그대로. useMutation · invalidateQueries `['classroom', 'list']`.

```ts
export function useClassroomPatch() {
  const qc = useQueryClient();
  return useMutation<ClassroomPatchResponse, Error, ClassroomPatchRequest>({
    mutationFn: callClassroomPatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classroom', 'list'] });
    },
  });
}

export function useClassroomDelete() { /* 동일 */ }
```

#### 7. `ArchiveClassroomDialog.tsx`

**Props**:
```ts
export interface ArchiveClassroomTarget {
  id: string;
  name?: string;
  currentState: string;
}

export interface ArchiveClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ArchiveClassroomTarget | null;
  onSuccess?: () => void;
}
```

**동작**:
- `currentState === 'ACTIVE'` → 다이얼로그 「아카이브」 · nextState=`ARCHIVED`.
- `currentState === 'ARCHIVED'` → 「복구」 · nextState=`ACTIVE`.
- 그 외 (`PROVISIONED`·`DECLINED`·`SUSPENDED`) → 버튼 표시 안 함 (`disabled` 또는 렌더 안 함).
- 확인 문구 타이핑 안 함 (돌이킬 수 있는 액션 · confirm 버튼만).
- data-testid: `archive-classroom-submit` · `archive-classroom-error`.

#### 8. `DeleteClassroomDialog.tsx`

`DeleteChatSpaceDialog.tsx` 패턴 그대로 (displayName 있으면 name 타이핑, 없으면 id 타이핑). 확인 문구 · destructive 스타일.

data-testid: `delete-classroom-confirm-input` · `delete-classroom-submit` · `delete-classroom-error`.

#### 9. `ClassroomTable.tsx` — 액션 컬럼 추가

기존 5 컬럼 (이름 · 섹션 · 상태 · ID · 링크) → 6 컬럼 추가:
```tsx
<TableHead className="text-right">관리</TableHead>
```

각 행:
```tsx
<TableCell className="text-right">
  {(c.courseState === 'ACTIVE' || c.courseState === 'ARCHIVED') && (
    <button
      type="button"
      onClick={() => setArchiveTarget({ id: c.id, name: c.name, currentState: c.courseState || '' })}
      data-testid={`classroom-archive-btn-${c.id}`}
      className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong mr-3"
    >
      {c.courseState === 'ACTIVE' ? '아카이브' : '복구'}
    </button>
  )}
  <button
    type="button"
    onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
    data-testid={`classroom-delete-btn-${c.id}`}
    className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
  >
    삭제
  </button>
</TableCell>
```

**state 추가**:
```ts
const [archiveTarget, setArchiveTarget] = useState<ArchiveClassroomTarget | null>(null);
const [deleteTarget, setDeleteTarget] = useState<{ id: string; name?: string } | null>(null);
```

**다이얼로그 렌더**:
```tsx
<ArchiveClassroomDialog
  open={!!archiveTarget}
  onOpenChange={(o) => !o && setArchiveTarget(null)}
  target={archiveTarget}
/>
<DeleteClassroomDialog
  open={!!deleteTarget}
  onOpenChange={(o) => !o && setDeleteTarget(null)}
  target={deleteTarget}
/>
```

#### 10. 테스트

**web `classroomPatch.test.ts`** (2 신규): 200 응답 → data.course · 403 응답 → throws.
**web `classroomDelete.test.ts`** (2 신규): 200 응답 → data.ok · 404 응답 → throws.

**web `ArchiveClassroomDialog.test.tsx`** (4 신규):
1. currentState=ACTIVE → 「아카이브」 버튼 · 클릭 시 patch 호출 (courseState: 'ARCHIVED').
2. currentState=ARCHIVED → 「복구」 버튼 · 클릭 시 patch 호출 (courseState: 'ACTIVE').
3. mutation error → error 배너 렌더.
4. 성공 → 다이얼로그 닫힘.

**web `DeleteClassroomDialog.test.tsx`** (4 신규):
1. target null → 미렌더.
2. name 타이핑 필요 (일치할 때만 「삭제」 활성화).
3. mutation error → error 배너 렌더.
4. 성공 → 다이얼로그 닫힘.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 735 + 신규 26~28 = 761~763 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 각 행 「아카이브」 · 「삭제」 버튼 → 다이얼로그 → 동작
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Classroom archive/delete** — 실 계정 · 실 코스 필요.
- **transfer_owner** — v0.84+ 별도.
- **rosters** — v0.84+ 별도.

### 커밋 규칙

**4 커밋 분리**:
1. `feat(functions): classroom.patch callable (courseState 전환) + classroomClient.patch + firebase rewrite`
2. `feat(functions): classroom.delete callable + classroomClient.delete + firebase rewrite`
3. `feat(web): classroomPatch/Delete API + hooks`
4. `feat(web): Archive/Delete ClassroomDialog + ClassroomTable 관리 컬럼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-archive-delete-v83`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
