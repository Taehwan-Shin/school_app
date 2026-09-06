# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data JSON 불러오기 v0.65** — BasicDataPanel 「JSON 불러오기」 + ImportBasicDataDialog. v0.61 export 대칭.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-json-import-v65`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `63f93af` (BasicDataPanel 레이아웃·총계 v0.64)

## 지금 할 것 — JSON import

### 왜

v0.61 로 JSON export 완비 — admin 이 basic_data 백업 · 스프레드시트 편집 후 다시 저장 가능. 하지만 UI 는 여전히 다이얼로그로만 편집 → 대량 편집 어려움. JSON import 로 외부 편집 후 restore.

**하지 않는 것**: 부분 병합 (import 는 전체 replace). 다중 연도 import (JSON 하나에 여러 연도). 스키마 자동 migration (validator fail 시 그대로 실패).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/ImportBasicDataDialog.tsx` — FileReader + JSON.parse + validator + preview + confirm + save
- `packages/web/tests/ImportBasicDataDialog.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 「JSON 불러오기」 버튼 + Dialog state

**손대지 마라**:
- 백엔드 · shared · basicData.set (그대로 사용).
- 다른 다이얼로그.

### 세부 요구

#### 1. `ImportBasicDataDialog.tsx`

**Props**:
```ts
export interface ImportBasicDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentYear: number;   // 기본 편집 대상 연도 (JSON year 와 불일치 시 경고)
  onDone?: () => void;
}
```

**state**:
```ts
type Phase = 'select' | 'preview' | 'saving' | 'done';
const [phase, setPhase] = useState<Phase>('select');
const [parsedData, setParsedData] = useState<BasicDataYear | null>(null);
const [parseError, setParseError] = useState<string | null>(null);
const [saveError, setSaveError] = useState<string | null>(null);
const { mutateAsync: saveBasicData } = useBasicDataSet();
```

**open 초기화**:
```ts
useEffect(() => {
  if (open) {
    setPhase('select');
    setParsedData(null);
    setParseError(null);
    setSaveError(null);
  }
}, [open]);
```

**파일 읽기 + validate**:
```ts
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setParseError(null);
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result as string;
      const obj = JSON.parse(text);
      if (!isValidBasicDataYear(obj)) {
        setParseError('JSON 이 basic_data 스키마와 일치하지 않습니다.');
        setParsedData(null);
        return;
      }
      setParsedData(obj as BasicDataYear);
      setPhase('preview');
    } catch (err) {
      setParseError(`JSON 파싱 실패: ${(err as Error).message}`);
      setParsedData(null);
    }
  };
  reader.readAsText(file);
};
```

**save 실행**:
```ts
const handleSave = async () => {
  if (!parsedData) return;
  setPhase('saving');
  setSaveError(null);
  try {
    await saveBasicData({
      year: parsedData.year,
      grades: parsedData.grades,
      ...(parsedData.departments !== undefined ? { departments: parsedData.departments } : {}),
      ...(parsedData.rosters !== undefined ? { rosters: parsedData.rosters } : {}),
    });
    setPhase('done');
  } catch (err) {
    setSaveError((err as Error).message);
    setPhase('preview');   // 다시 preview 로 복귀 (수정 여지)
  }
};
```

**UI — phase 별**:

- `select`:
  ```tsx
  <DialogHeader>
    <DialogTitle>basic_data JSON 불러오기</DialogTitle>
    <DialogDescription>
      JSON 파일을 선택하세요. 스키마 검증 후 미리보기 표시 → 확인 시 해당 연도 전체 덮어쓰기.
    </DialogDescription>
  </DialogHeader>
  <input
    type="file"
    accept="application/json,.json"
    onChange={handleFileChange}
    data-testid="import-basic-data-file-input"
    className="block w-full text-body text-fg-primary file:mr-4 file:py-2 file:px-4 file:border file:border-border-subtle file:bg-canvas file:text-fg-primary file:cursor-pointer"
  />
  {parseError && (
    <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="import-basic-data-parse-error">
      {parseError}
    </div>
  )}
  <DialogFooter>
    <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
  </DialogFooter>
  ```

- `preview`:
  ```tsx
  <DialogHeader>
    <DialogTitle>미리보기</DialogTitle>
    <DialogDescription>
      아래 데이터로 <strong className="font-mono">{parsedData?.year}</strong>년 기초값을 전체 덮어씁니다.
      {parsedData?.year !== currentYear && (
        <span className="text-state-warning ml-2">(현재 편집 중 연도 {currentYear} 와 다릅니다)</span>
      )}
    </DialogDescription>
  </DialogHeader>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-small text-fg-secondary" data-testid="import-basic-data-preview">
    <div>학년: <strong className="font-mono text-fg-primary">{parsedData?.grades.length ?? 0}</strong></div>
    <div>반: <strong className="font-mono text-fg-primary">
      {parsedData?.grades.reduce((s, g) => s + g.classes.length, 0) ?? 0}
    </strong></div>
    <div>학생: <strong className="font-mono text-fg-primary">
      {Object.values(parsedData?.rosters ?? {}).reduce(
        (sum, grade) => sum + Object.values(grade).reduce((s, arr) => s + arr.length, 0),
        0
      )}
    </strong></div>
    <div>부서: <strong className="font-mono text-fg-primary">{parsedData?.departments?.length ?? 0}</strong></div>
  </div>
  {saveError && (
    <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="import-basic-data-save-error">
      저장 실패: {saveError}
    </div>
  )}
  <DialogFooter>
    <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
    <Button onClick={handleSave} data-testid="import-basic-data-save-btn">
      덮어쓰기 실행
    </Button>
  </DialogFooter>
  ```

- `saving`:
  ```tsx
  <div className="py-8 text-center text-body text-fg-primary" data-testid="import-basic-data-saving">
    저장 중...
  </div>
  ```

- `done`:
  ```tsx
  <div className="py-8 text-center space-y-3" data-testid="import-basic-data-done">
    <p className="text-body text-state-success">
      <strong className="font-mono">{parsedData?.year}</strong>년 기초값을 성공적으로 저장했습니다.
    </p>
    <DialogFooter>
      <Button onClick={() => { onOpenChange(false); onDone?.(); }}>확인</Button>
    </DialogFooter>
  </div>
  ```

**주의**:
- `isValidBasicDataYear` import from `@school-app/shared`.
- Import 성공 시 백엔드가 자동으로 `updatedAt`·`updatedBy` 갱신 (validator 는 그 필드 optional 이라 OK).
- basicDataSet 은 이미 listYears 무효화 포함 (v0.55) → 새 연도 저장 시 dropdown 자동 갱신.

#### 2. `BasicDataPanel.tsx` — 「JSON 불러오기」 버튼

기존 「JSON 내보내기」 옆:
```tsx
<Button
  variant="secondary"
  onClick={() => setIsImportOpen(true)}
  data-testid="basic-data-json-import-btn"
>
  JSON 불러오기
</Button>
```

**state**: `const [isImportOpen, setIsImportOpen] = useState(false);`

**다이얼로그 렌더**:
```tsx
<ImportBasicDataDialog
  open={isImportOpen}
  onOpenChange={setIsImportOpen}
  currentYear={selectedYear}
/>
```

**주의**:
- import 성공 후 sublect 연도가 import 된 연도와 다를 수 있음. 이번은 사용자가 필요 시 dropdown 으로 이동 (자동 이동 안 함).

#### 3. 테스트

**web `ImportBasicDataDialog.test.tsx`** (4 시나리오):
1. `open=true` → file input 렌더.
2. 유효 JSON 파일 → preview phase, 카운트 렌더.
3. 무효 JSON 파일 → parse-error 표시.
4. preview + save 클릭 → saveBasicData 호출, done phase.

FileReader mock 은 tests utils 에 없으면 새로 setup (readAsText → onload with result).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 598 + 신규 4 = 602 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 「JSON 불러오기」 버튼
   - 유효 JSON 로드 → preview → 덮어쓰기 → 성공
   - 무효 JSON → parse-error
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **부분 병합** — 별도 slice (grades 만 병합 · rosters 덧붙이기 등).
- **다중 연도 import** — 별도 slice.
- **스키마 migration** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): ImportBasicDataDialog + BasicDataPanel 「JSON 불러오기」 버튼`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-json-import-v65`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
