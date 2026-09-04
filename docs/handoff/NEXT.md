# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **rosters 편집 UI v0.57** — BasicDataPanel 에 「학생 명단 편집」 버튼 + 반별 학생 수 표시 + EditRostersDialog (반별 textarea).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-rosters-ui-v57`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `4ad8be7` (basic_data 학생 명단 스키마 v0.56)

## 지금 할 것 — rosters 편집 UI

### 왜

v0.56 로 백엔드 스키마 완비. admin 이 반별 학생 이메일 목록 관리할 UI 필요. EditBasicDataDialog 는 이미 grades+departments 로 크므로 별도 다이얼로그 `EditRostersDialog` 로 분리.

**하지 않는 것**: 학생 자동 초대 (그룹 생성 시). CSV import. 이메일 도메인 강제. 학생 개별 이동 (반 A → B) 별도 UX.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/EditRostersDialog.tsx` — 반별 textarea + 저장
- `packages/web/tests/EditRostersDialog.test.tsx` — 시나리오 5

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 「학생 명단 편집」 버튼 + 반 badge 아래 학생 수 표시
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 2 (버튼 조건 · 학생 수 표시)

**손대지 마라**:
- 백엔드 · shared · Firestore.
- EditBasicDataDialog · AutoCreate* — 그대로.
- basicDataSet API — 그대로 (rosters 이미 request 타입에 있음).

### 세부 요구

#### 1. `EditRostersDialog.tsx` — 반별 textarea

**Props**:
```ts
export interface EditRostersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  initialData: BasicDataYear;   // 전체 (rosters 뿐 아니라 grades·departments 도 merge 위해)
}
```

**state**:
```ts
// key: `${grade}-${class}` → textarea 값 (newline-separated emails)
const [rosterTexts, setRosterTexts] = useState<Record<string, string>>({});
const [validationError, setValidationError] = useState<string | null>(null);
const { mutateAsync: saveBasicData, isPending, error: mutationError } = useBasicDataSet();
```

**초기화 (open true 시)**:
```ts
useEffect(() => {
  if (open) {
    const texts: Record<string, string> = {};
    for (const g of initialData.grades) {
      for (const c of g.classes) {
        const key = `${g.grade}-${c}`;
        const students = initialData.rosters?.[String(g.grade)]?.[c] ?? [];
        texts[key] = students.join('\n');
      }
    }
    setRosterTexts(texts);
    setValidationError(null);
  }
}, [open, initialData]);
```

**submit**:
```ts
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setValidationError(null);

  const rosters: Record<string, Record<string, string[]>> = {};
  for (const g of initialData.grades) {
    for (const c of g.classes) {
      const key = `${g.grade}-${c}`;
      const emails = (rosterTexts[key] ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (emails.length > 0) {
        if (!rosters[String(g.grade)]) rosters[String(g.grade)] = {};
        rosters[String(g.grade)][c] = emails;
      }
    }
  }

  try {
    await saveBasicData({
      year,
      grades: initialData.grades,
      ...(initialData.departments !== undefined ? { departments: initialData.departments } : {}),
      rosters,
    });
    onOpenChange(false);
  } catch {
    // mutationError 아래 표시
  }
};
```

**UI**:
```tsx
<DialogHeader>
  <DialogTitle>{year}년 학생 명단 편집</DialogTitle>
  <DialogDescription>
    각 반의 학생 이메일을 한 줄에 하나씩 입력하세요. 빈 반은 저장 안 됨.
  </DialogDescription>
</DialogHeader>
<div className="max-h-96 overflow-y-auto space-y-4">
  {initialData.grades.map((g) => (
    <div key={g.grade} className="space-y-2">
      <div className="text-body font-semibold text-fg-primary">{g.grade}학년</div>
      {g.classes.map((c) => {
        const key = `${g.grade}-${c}`;
        const count = (rosterTexts[key] ?? '')
          .split('\n')
          .filter((s) => s.trim().length > 0).length;
        return (
          <div key={key} className="ml-4">
            <label className="text-small text-fg-primary">
              {c}반 <span className="text-fg-muted">({count}명)</span>
            </label>
            <textarea
              value={rosterTexts[key] ?? ''}
              onChange={(e) => setRosterTexts({ ...rosterTexts, [key]: e.target.value })}
              placeholder="student1@cam.hs.kr\nstudent2@cam.hs.kr"
              data-testid={`edit-rosters-${g.grade}-${c}`}
              rows={4}
              className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-1"
            />
          </div>
        );
      })}
    </div>
  ))}
</div>
{mutationError && (
  <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="edit-rosters-error">
    저장 실패: {mutationError.message}
  </div>
)}
<DialogFooter>
  <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
  <Button
    onClick={handleSubmit}
    disabled={isPending}
    data-testid="edit-rosters-submit"
  >
    {isPending ? '저장 중...' : '저장'}
  </Button>
</DialogFooter>
```

**주의**:
- rosters 는 grades·departments 와 병존 저장 (merge:false 이므로 전체 다시 넘김).
- 빈 반은 rosters 에 미포함 (스토리지 절약).
- 이메일 도메인 검증 안 함 (기본 non-empty).

#### 2. `BasicDataPanel.tsx` — 「학생 명단 편집」 버튼 + 학생 수 표시

**버튼**: 기존 「편집」 옆:
```tsx
<Button
  variant="secondary"
  onClick={() => setIsRostersEditOpen(true)}
  data-testid="basic-data-rosters-edit-btn"
  disabled={!data?.data || (data.data.grades ?? []).length === 0}
  title={!data?.data ? '기초값 먼저 설정하세요' : '반별 학생 명단 편집'}
>
  학생 명단 편집
</Button>
```

**state**: `const [isRostersEditOpen, setIsRostersEditOpen] = useState(false);`

**다이얼로그 렌더** (다른 다이얼로그 옆):
```tsx
{data?.data && (
  <EditRostersDialog
    open={isRostersEditOpen}
    onOpenChange={setIsRostersEditOpen}
    year={selectedYear}
    initialData={data.data}
  />
)}
```

**학생 수 표시** — 기존 반 badge 아래에 (또는 badge 오른쪽에 작은 텍스트):
```tsx
{g.classes.map((c) => {
  const rosterCount = data.data?.rosters?.[String(g.grade)]?.[c]?.length ?? 0;
  return (
    <span
      key={c}
      className="px-2 py-1 border border-border-subtle bg-canvas text-small font-mono text-fg-primary"
      data-testid={`basic-data-class-${g.grade}-${c}`}
    >
      {c}
      {rosterCount > 0 && (
        <span className="ml-1 text-fg-muted text-micro">({rosterCount})</span>
      )}
    </span>
  );
})}
```

**주의**:
- 학생 수 0 이면 표시 안 함 (깔끔).
- 기존 testid 유지 (`basic-data-class-{grade}-{class}`).

#### 3. 테스트

**web `EditRostersDialog.test.tsx`** (5 신규):

1. `open=false` → 컨텐츠 렌더되지 않음.
2. `open=true` + rosters=undefined → textarea 모두 빈 값.
3. `open=true` + rosters 있음 → 해당 반 textarea 에 이메일 초기값 (newline-joined).
4. textarea 편집 → 학생 수 카운트 실시간 갱신.
5. 유효한 폼 제출 → `saveBasicData` 호출됨, request 에 rosters + grades + departments 포함.

**web `BasicDataPanel.test.tsx`** (2 신규):
1. data 없음 → `basic-data-rosters-edit-btn` disabled.
2. rosters 존재 → 반 badge 에 `(N)` 학생 수 표시.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 578 + 신규 7 = 585 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 「학생 명단 편집」 버튼 (기초값 있으면 enabled)
   - 다이얼로그: 학년/반 별 textarea, 실시간 학생 수 카운트
   - 저장 → 반 badge 에 학생 수 (N) 표시됨
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **학생 자동 초대** — 별도 slice (그룹 생성 시 rosters 참조).
- **CSV import** — 별도 slice.
- **이메일 도메인 강제** — 별도 slice.
- **학생 이동 (반 A → B)** — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): BasicDataPanel 「학생 명단 편집」 버튼 + 반 badge 학생 수 표시`
2. `feat(web): EditRostersDialog (반별 textarea + rosters 저장)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-rosters-ui-v57`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
