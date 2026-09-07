# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **classroom batch create v0.91** — CourseBulkCreateDialog · basic_data year 선택 · 학년/반 다중 선택 · 순차 classroomCreate.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/classroom-batch-create-v91`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `ff6b5c0` (classroom.create v0.90 merge)

## 지금 할 것 — Classroom 코스 batch create

### 왜

v0.90 로 코스 하나씩 create 완비. 신학기에 30~40개 반 있으면 하나씩 만들기 비현실. `basic_data` grades 활용해 batch create:
- year 선택 → basic_data 로드 → 학년/반 다중 체크박스
- 각 반마다 코스 이름 자동 생성 (pattern: `{year}학년도 {grade}학년 {class}반`)
- 확인 후 순차 실행 · 이미 존재하는 이름은 skip

기존 `ClassroomBulkInviteDialog` (v0.88) 패턴 대부분 재사용. v0.89 F3 교훈: direct callable 사용 · auto-invalidate 우회 · 종료 시 1회만 invalidate.

**하지 않는 것**:
- transfer_owner (v0.92+ 별도)
- Chat members.add (v0.93+ · Directory 리졸버)
- 코스↔반 자동 매칭 조회 (batch create 로 대체됨 · 이제 코스와 반 매칭은 이름 규약으로 판별 가능)
- 이미 존재하는 코스 update (skip 만)

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/CourseBulkCreateDialog.tsx` — 다이얼로그 (phase select→preview→running→done)
- `packages/web/tests/CourseBulkCreateDialog.test.tsx` (시나리오 5~7)

**수정 대상**:
- `packages/web/src/routes/admin/ClassroomTable.tsx` — 상단 「학년/반 일괄 생성」 버튼 (「+ 코스 추가」 옆)

**손대지 마라**:
- classroomCreate callable (그대로 재사용).
- classroom.list · patch · delete · rosters · CRUD · bulk invite 그대로.
- 다른 도메인.

### 세부 요구

#### 1. `CourseBulkCreateDialog.tsx`

**Props**:
```ts
export interface CourseBulkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}
```

**state**:
```ts
type Phase = 'select' | 'preview' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';

interface BatchCreateResult {
  gradeClass: string;    // '2-3'
  courseName: string;    // '2026학년도 2학년 3반'
  kind: ResultKind;
  courseId?: string;     // ok 시 응답 id
  message?: string;
}

const thisYear = new Date().getFullYear();
const [year, setYear] = useState(thisYear);
const [yearInput, setYearInput] = useState(String(thisYear));
const [selected, setSelected] = useState<Set<string>>(new Set());   // '2-3' 형식
const [ownerId, setOwnerId] = useState('me');
const [courseState, setCourseState] = useState<'PROVISIONED' | 'ACTIVE'>('PROVISIONED');
const [confirmText, setConfirmText] = useState('');
const [phase, setPhase] = useState<Phase>('select');
const [progress, setProgress] = useState(0);
const [results, setResults] = useState<BatchCreateResult[]>([]);
```

**Hooks**:
- `useBasicDataGet(year, open)` — 학년/반 정보
- QueryClientContext — 종료 시 invalidate
- **`useClassroomCreate` 는 사용 안 함** (auto-invalidate 우회) · `callClassroomCreate` 직접 import

**isYearValid** (v0.89 F2 헬퍼 재사용 · 로컬 복제):
```ts
function isYearValid(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return false;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200;
}
```

**handleYearChange** (v0.89 패턴):
```ts
const handleYearChange = (val: string) => {
  setYearInput(val);
  setSelected(new Set());
  if (isYearValid(val)) {
    setYear(Number.parseInt(val.trim(), 10));
  }
};
```

**Course name pattern**:
```ts
function courseName(year: number, grade: number, cls: string): string {
  return `${year}학년도 ${grade}학년 ${cls}반`;
}
```

**Phase: select**
- year input (v0.89 F2 스타일).
- basic_data 로드 후 각 학년 · 반을 checkbox 로 렌더.
- 각 checkbox click → selected Set 토글 (key = `${grade}-${cls}`).
- 「전체 선택」 · 「전체 해제」 액션 (해당 학년 내).
- ownerId input (default `me`).
- courseState select ([PROVISIONED, ACTIVE]).
- 「미리보기」 버튼 (활성: 최소 1개 선택 + isYearValid).

**Phase: preview**
- 선택된 조합 리스트 (grade-class + 자동 생성 이름 pattern).
- 총 코스 수 (예: 12개).
- 확인 텍스트 input (코스 수 정확 타이핑).
- 「생성 실행」 버튼 (활성: 확인 정확).

**Phase: running**
- 순차 `callClassroomCreate({ requestBody: { name, section, ownerId, courseState } })`.
- section = `${grade}-${cls}` (예: '2-3').
- 각 결과 array push (ok/skipped/failed).
- upstream 409 (이미 존재) 은 skip 으로 분류 (`isAlreadyExistsError` 헬퍼):
  ```ts
  function isAlreadyExistsError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('already') ||
      lower.includes('duplicate') ||
      lower.includes('exists') ||
      lower.includes('409')
    );
  }
  ```
- 진행률 표시. close 차단.

**Phase: done**
- ok / skipped / failed 카운트.
- skipped · failed 목록 (스크롤).
- 「확인」 → onOpenChange(false) + queryClient.invalidateQueries(['classroom', 'list']) + onDone?.().

**testid**:
- year input: `bulk-create-year-input`
- 학년 checkbox: `bulk-create-class-cb-${grade}-${cls}` (하위 checkbox 형식)
- 「전체 선택」: `bulk-create-select-all-${grade}`
- ownerId: `bulk-create-owner`
- courseState: `bulk-create-state`
- preview 진입: `bulk-create-preview-btn`
- 미리보기 리스트: `bulk-create-preview`
- 확인 입력: `bulk-create-confirm-input`
- 실행: `bulk-create-execute-btn`
- 진행: `bulk-create-running`
- done: `bulk-create-done` · skipped: `bulk-create-skipped` · failed: `bulk-create-failures`

#### 2. `ClassroomTable.tsx` — 「학년/반 일괄 생성」 버튼

기존 「+ 코스 추가」 옆에 추가:
```tsx
<div className="flex items-center gap-2">
  <Button
    variant="secondary"
    onClick={() => setIsBatchOpen(true)}
    data-testid="classroom-batch-create-btn"
  >
    학년/반 일괄 생성
  </Button>
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
const [isBatchOpen, setIsBatchOpen] = useState(false);
```

**Dialog 렌더**:
```tsx
<CourseBulkCreateDialog
  open={isBatchOpen}
  onOpenChange={setIsBatchOpen}
/>
```

#### 3. 테스트

**`CourseBulkCreateDialog.test.tsx`** (5~7 신규):
1. open=false → 미렌더.
2. year invalid 입력 → selected 초기화 · preview 버튼 disabled.
3. 학년/반 체크 후 preview 진입 → 코스 이름 pattern 렌더 · 총 수 표시.
4. 확인 텍스트 오류 → 「생성 실행」 disabled.
5. 「생성 실행」 클릭 → mock callClassroomCreate 순차 호출 (선택된 개수만큼).
6. 이미 존재 오류 (409 · duplicate) → skipped 분류.
7. 종료 시 queryClient.invalidateQueries 1회 호출 (mock spy).

**`ClassroomTable.test.tsx`** (기존 확장 2 신규):
1. 「학년/반 일괄 생성」 버튼 렌더.
2. 클릭 시 isBatchOpen state 변경.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 904 + 신규 7~9 = 911~913 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 「학년/반 일괄 생성」 → year 선택 → 반 다중 선택 → preview → 실행 → 결과.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Classroom batch create** — 실 계정 · rosters 필요.
- **transfer_owner** — v0.92+ 별도.
- **Chat members.add** — v0.93+ (Directory 리졸버).
- **코스명 pattern 커스터마이즈** — 별도 판단 (settings 필요하면).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): CourseBulkCreateDialog (basic_data → classroom.create 순차 batch)`
2. `feat(web): ClassroomTable 「학년/반 일괄 생성」 버튼 통합`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/classroom-batch-create-v91`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
