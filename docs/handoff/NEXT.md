# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom.create v0.90** — courses.create callable + CreateClassroomDialog + ClassroomTable 「+ 코스 추가」 버튼. 신학기 workflow 열림 (수동 코스 하나씩 · batch 는 v0.91+).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-create-v90`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `3df945b` (Codex hotfix v0.89 merge)

## 지금 할 것 — classroom.create + Dialog + 「+ 코스 추가」 버튼

### 왜

v0.82~v0.89 로 classroom list · patch · delete · rosters · CRUD · bulk invite 완비. 하지만 **코스 create 없음** → admin 이 코스를 UI 에서 생성 못함 (지금은 classroom.google.com 에서 수동 생성 후 우리 앱에서 관리만 가능).

Chat 도메인의 v0.78 create 패턴 그대로 재사용. 신학기에 admin 이 한두 개 코스 만들어 보고 → 익숙해지면 batch 요청 (v0.91+).

**하지 않는 것**:
- batch create (learn 반 리스트 → 여러 코스) — v0.91 별도.
- transfer_owner — v0.92+.
- Chat members.add (Directory 리졸버 필요) — v0.93+.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/classroom/create.ts` — 신규 callable
- `packages/functions/tests/classroomCreate.test.ts` (시나리오 6~7)
- `packages/web/src/api/classroomCreate.ts` — fetch + useMutation hook
- `packages/web/src/routes/admin/CreateClassroomDialog.tsx` — 코스 생성 다이얼로그
- `packages/web/tests/classroomCreate.test.ts` (시나리오 2)
- `packages/web/tests/CreateClassroomDialog.test.tsx` (시나리오 4)

**수정 대상**:
- `packages/functions/src/google/classroomClient.ts` — courses.create 인터페이스 추가
- `packages/functions/src/index.ts` — export `classroomCreate`
- `firebase.json` — hosting rewrite `/api/classroomCreate`
- `packages/web/src/routes/admin/ClassroomTable.tsx` — 상단에 「+ 코스 추가」 버튼 추가

**손대지 마라**:
- classroom.list · patch · delete · rosters · CRUD 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `classroomClient.ts` — courses.create 인터페이스

```ts
courses: {
  list: ...,
  patch: ...,
  delete: ...,
  create: (params: {
    requestBody: {
      name: string;                // 필수
      section?: string;
      description?: string;
      room?: string;
      ownerId: string;             // 'me' | email | userId
      courseState?: string;        // 기본 'PROVISIONED' → active 되려면 patch 필요
    };
  }) => Promise<{ data: ClassroomCourse }>;
  teachers: ...,
  students: ...,
};
```

#### 2. `classroom/create.ts` — callable

Cap `classroom.write` · Scope `classroom.courses`.

```ts
export interface ClassroomCreateRequest {
  name: string;                    // 필수 · 앞뒤 trim
  section?: string;
  description?: string;
  room?: string;
  ownerId?: string;                // 기본 'me'
  courseState?: 'PROVISIONED' | 'ACTIVE';   // 기본 'PROVISIONED'
}

export interface ClassroomCreateResponse {
  course: ClassroomCourse;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
] as const;

const NAME_RE = /^.{1,300}$/;                              // 1~300자 (Google 제한)
const OWNER_ID_RE = /^(me|[A-Za-z0-9._@+\-]+)$/;

// 인증 → Cap classroom.write → Scope classroom.courses →
//   name 검증 (trim 후 비어있으면 invalid-argument) →
//   ownerId 검증 (미제공 시 'me' · 형식 통과) →
//   courseState 검증 (미제공 시 'PROVISIONED' · 'PROVISIONED' 또는 'ACTIVE' 만 허용) →
//   courses.create({ requestBody: { name, section, description, room, ownerId, courseState } }) →
//   audit `classroom.write` · action 'classroom.create' · target=`courses/${result.id}` · message=`name=${name}`
```

**주의**:
- audit target 은 응답의 course.id 로 완성 (audit `ok` 시). 실패 시 target='*'.
- 새 audit action `classroom.create` (기존 없음 · 하드코딩 없음 · UI filter 자동 반영).
- `mapUpstreamError` 재사용.
- upstream 400 (name 등 무효) → HttpsError invalid-argument (기존 매핑에 없음 · unknown 로 매핑됨) — 그대로 유지. 사용자에 API 오류 그대로 표시.

#### 3. functions/index.ts + firebase.json

```ts
export { classroomCreate } from './callable/classroom/create.js';
```

`firebase.json` rewrites 에 `/api/classroomCreate` 추가.

#### 4. 테스트 (functions)

**`classroomCreate.test.ts`** (7 시나리오):
1. 미인증 → denied.
2. 캡 `classroom.write` 부족 → denied.
3. 스코프 부족 → denied.
4. name 형식 오류 (빈 문자열 · 301자 이상) → invalid-argument.
5. ownerId 형식 오류 → invalid-argument.
6. 정상 (mock create · 응답에 id=abc) → response.course.id === 'abc' · audit action 'classroom.create' · target 'courses/abc'.
7. upstream 403 → HttpsError permission-denied · audit denied.

#### 5. `classroomCreate.ts` — hook

`classroomPatch.ts` 패턴 (useMutation).

```ts
export function useClassroomCreate() {
  const qc = useQueryClient();
  return useMutation<ClassroomCreateResponse, Error, ClassroomCreateRequest>({
    mutationFn: callClassroomCreate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classroom', 'list'] });
    },
  });
}
```

#### 6. `CreateClassroomDialog.tsx`

**Props**:
```ts
export interface CreateClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (course: ClassroomCourse) => void;
}
```

**구조**:
- Dialog · form
- Fields:
  - 코스 이름 (name · 필수) — text input
  - 섹션 (section · 선택) — text input
  - 설명 (description · 선택) — textarea
  - 강의실 (room · 선택) — text input
  - 소유자 (ownerId) — text input · placeholder `me` · 기본값 `me`
  - 상태 (courseState) — select [PROVISIONED, ACTIVE] · 기본 PROVISIONED
- Submit button: 「생성」 · pending 중 「생성 중...」
- Cancel button: 「취소」
- Error 배너 (mutation.error 있으면 렌더)

**동작**:
- Submit → mutateAsync → 성공 시 dialog close · onSuccess(course)
- open 되면 form state reset.
- pending 중 dialog close 차단.

**data-testid**:
- form: `create-classroom-form`
- name input: `create-classroom-name`
- section input: `create-classroom-section`
- description input: `create-classroom-description`
- room input: `create-classroom-room`
- owner input: `create-classroom-owner`
- state select: `create-classroom-state`
- submit: `create-classroom-submit`
- error: `create-classroom-error`

#### 7. `ClassroomTable.tsx` — 「+ 코스 추가」 버튼 추가

기존 표 위 · `<div className="flex justify-between items-center">` 안에 추가:
```tsx
<div className="flex justify-between items-center">
  <p className="text-small text-fg-secondary">
    {data?.courses ? `${data.courses.length}개 코스` : '코스 목록'}
  </p>
  <Button
    onClick={() => setIsCreateOpen(true)}
    data-testid="classroom-create-btn"
  >
    + 코스 추가
  </Button>
</div>
```

**state 추가**:
```ts
const [isCreateOpen, setIsCreateOpen] = useState(false);
```

**Dialog 렌더**:
```tsx
<CreateClassroomDialog
  open={isCreateOpen}
  onOpenChange={setIsCreateOpen}
/>
```

**주의**: 
- 「p 코스 목록」 라인 왼쪽 · 「+ 코스 추가」 오른쪽.
- 기존 관리 버튼들 · 표 · 다이얼로그 (Archive · Delete · Members) 모두 그대로.

#### 8. 테스트 (web)

**`classroomCreate.test.ts`** (2 신규):
1. 200 응답 → data.course · id 확인.
2. 400 응답 (name 오류) → hook throws · status 400.

**`CreateClassroomDialog.test.tsx`** (4 신규):
1. open=false → 미렌더.
2. name 빈 문자열 → submit 버튼 disabled.
3. 정상 입력 후 submit → callClassroomCreate 호출 (name · ownerId 기본값) · 성공 시 dialog close.
4. mutation error → error 배너 렌더.

**`ClassroomTable.test.tsx`** (기존 확장 1~2건):
- 「+ 코스 추가」 버튼 렌더 확인.
- 클릭 시 CreateClassroomDialog open state 변경 (mock).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 862 + 신규 14~16 = 876~878 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 「+ 코스 추가」 → dialog → 이름 입력 → 생성 → 목록에 추가됨.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Google Classroom create** — 실 계정 · 실 domain 필요.
- **batch create** — v0.91+ 별도.
- **transfer_owner** — v0.92+ 별도.
- **PROVISIONED → ACTIVE 자동 전환 흐름** — 별도 UX 고려 필요 (v0.93+ 나 별도 판단).

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): classroom.create callable + classroomClient.create + firebase rewrite`
2. `feat(web): classroomCreate API + useClassroomCreate mutation hook`
3. `feat(web): CreateClassroomDialog + ClassroomTable 「+ 코스 추가」 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-create-v90`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
