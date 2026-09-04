# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data 편집 v0.47** — basicDataSet API + EditBasicDataDialog + BasicDataPanel 「편집」 버튼. 학년/반 동적 편집 폼.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-edit-v47`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `95348ab` (basic_data 프론트엔드 조회 v0.46)

## 지금 할 것 — 편집 다이얼로그 + Save mutation

### 왜

v0.46 로 BasicDataPanel read-only 배포. 실제 데이터를 admin 이 입력할 UI 는 아직 없음. `basicData.set` 은 v0.45 로 완비 — 다이얼로그만 붙이면 됨.

**하지 않는 것**: 부서. 학생 명단. 삭제 (v0.48 후보). 히스토리·복구.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/api/basicDataSet.ts` — fetch + useMutation
- `packages/web/src/routes/admin/EditBasicDataDialog.tsx` — 학년/반 동적 편집 폼
- `packages/web/tests/basicDataSet.test.ts` — API 시나리오 2
- `packages/web/tests/EditBasicDataDialog.test.tsx` — UI 시나리오 5

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 헤더에 「편집」 버튼 + Dialog state

**손대지 마라**:
- 백엔드 · shared — 그대로.
- basicDataGet · useBasicDataGet — 그대로.
- 다른 라우트.

### 세부 요구

#### 1. `basicDataSet.ts` — fetch + hook

`basicDataGet.ts` 참고. `useMutation` 사용, 성공 시 `basic_data` queryKey 무효화:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BasicDataGradeClass, BasicDataYear } from '@school-app/shared';

export interface BasicDataSetRequest {
  year: number;
  grades: BasicDataGradeClass[];
}

export interface BasicDataSetResponse {
  year: number;
  updatedAt: number;
}

export async function callBasicDataSet(data: BasicDataSetRequest): Promise<BasicDataSetResponse> {
  // fetch to https://asia-northeast3-${projectId}.cloudfunctions.net/basicDataSet
  // body: JSON.stringify({ data: { ...data, _googleAccessToken: googleAccessToken } })
  // 4xx/5xx handling 동일
}

export function useBasicDataSet() {
  const queryClient = useQueryClient();
  return useMutation<BasicDataSetResponse, Error, BasicDataSetRequest>({
    mutationFn: (data) => callBasicDataSet(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['basic_data', 'get', variables.year] });
    },
  });
}
```

#### 2. `EditBasicDataDialog.tsx` — 동적 폼

**Props**:
```ts
export interface EditBasicDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  initialData: BasicDataYear | null;
}
```

**state** (grade rows 을 배열로):
```ts
interface GradeRow {
  grade: string;      // 입력 편의상 string, submit 시 number 변환
  classesText: string;  // "A, B, C, D" — 쉼표 분할
}
const [rows, setRows] = useState<GradeRow[]>([]);
const [validationError, setValidationError] = useState<string | null>(null);
const { mutateAsync: saveBasicData, isPending, error: mutationError } = useBasicDataSet();
```

**open true 시 initialData 로 초기화**:
```ts
useEffect(() => {
  if (open) {
    if (initialData?.grades && initialData.grades.length > 0) {
      setRows(initialData.grades.map((g) => ({
        grade: String(g.grade),
        classesText: g.classes.join(', '),
      })));
    } else {
      setRows([{ grade: '1', classesText: '' }]);   // 신규 시 학년 1 로 초기 1 행
    }
    setValidationError(null);
  }
}, [open, initialData]);
```

**UI**:
- Dialog header: `{year}년 기초값 편집`
- 각 row: `학년 [num input]  반 [text input (쉼표 구분)]  [X 제거 버튼]`
- `+ 학년 추가` 버튼
- 하단: 취소 / 저장

**submit 처리**:
```ts
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setValidationError(null);

  // rows → grades 변환 + 검증
  const grades: BasicDataGradeClass[] = [];
  for (const r of rows) {
    const gradeNum = Number.parseInt(r.grade.trim(), 10);
    if (!Number.isFinite(gradeNum)) {
      setValidationError('학년은 숫자여야 합니다.');
      return;
    }
    const classes = r.classesText
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (classes.length === 0) {
      setValidationError(`${gradeNum}학년에 반이 없습니다.`);
      return;
    }
    grades.push({ grade: gradeNum, classes });
  }

  if (grades.length === 0) {
    setValidationError('최소 한 학년은 필요합니다.');
    return;
  }

  try {
    await saveBasicData({ year, grades });
    onOpenChange(false);
  } catch {
    // mutationError 는 아래 표시
  }
};
```

**에러 표시**:
```tsx
{validationError && (
  <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="edit-basic-data-validation-error">
    {validationError}
  </div>
)}
{mutationError && (
  <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="edit-basic-data-error">
    저장 실패: {mutationError.message}
  </div>
)}
```

**data-testid 규칙**:
- `edit-basic-data-grade-{idx}` (grade input, idx = row index)
- `edit-basic-data-classes-{idx}` (classes input)
- `edit-basic-data-remove-{idx}` (remove button)
- `edit-basic-data-add` (add row button)
- `edit-basic-data-submit`

#### 3. `BasicDataPanel.tsx` — 편집 버튼

헤더 오른쪽에:
```tsx
<div className="flex items-center gap-4">
  <div className="text-small text-fg-secondary">
    연도: <strong className="font-mono text-fg-primary">{currentYear}</strong>
  </div>
  <Button
    variant="secondary"
    onClick={() => setIsEditOpen(true)}
    data-testid="basic-data-edit-btn"
  >
    편집
  </Button>
</div>
```

**state**: `const [isEditOpen, setIsEditOpen] = useState(false);`

**다이얼로그 렌더**:
```tsx
<EditBasicDataDialog
  open={isEditOpen}
  onOpenChange={setIsEditOpen}
  year={currentYear}
  initialData={data?.data ?? null}
/>
```

Imports 추가: `useState`, `Button`, `EditBasicDataDialog`.

#### 4. 테스트

**web `basicDataSet.test.ts`** (2 신규):
1. 200 응답 → hook `data = { year, updatedAt }`.
2. 400 응답 (invalid_basic_data) → hook throws.

**web `EditBasicDataDialog.test.tsx`** (5 신규):
1. `open=true` + initialData 있음 → row 로 렌더링 (grade+classes 초기화).
2. `open=true` + initialData null → 신규 row 1 개 (학년 1, 반 빈 문자열).
3. 「학년 추가」 클릭 → row 하나 늘어남.
4. 「제거」 클릭 → row 하나 줄어듦.
5. 유효한 폼 제출 → mutation 호출 확인 + 성공 시 `onOpenChange(false)`.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 528 + 신규 7 = 535 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` BasicDataPanel 헤더 「편집」 버튼
   - 클릭 → 다이얼로그, initialData 로 rows 채워짐 (없으면 1 행)
   - 학년 추가/제거 정상
   - 저장 → 목록 자동 새로고침 (query invalidation)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **부서·학생 명단** — 스키마 확장 별도 slice.
- **삭제 (년도 통째로)** — 별도 slice.
- **히스토리** — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): basicDataSet API + useBasicDataSet mutation hook`
2. `feat(web): EditBasicDataDialog + BasicDataPanel 「편집」 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-edit-v47`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
