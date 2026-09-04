# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **부서별 그룹 자동 생성 v0.51** — BasicDataPanel 「부서 그룹 자동 생성」 버튼 + AutoCreateDepartmentGroupsDialog. departments 각 부서마다 admin 이 slug 지정 (기본 `dept-{N}`) → group email 생성.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-create-dept-groups-v51`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `61dbc04` (자동 생성 skip 처리 v0.50)

## 지금 할 것 — 부서별 그룹 자동 생성 (slug admin 지정)

### 왜

v0.49 로 부서 스키마 추가, v0.48 로 반 그룹 자동 생성 완비. 부서 (국어과 · 수학과 등) 는 한글 이름이라 그룹 이메일 (ASCII only) 로 직접 변환 불가. 해결: admin 이 다이얼로그에서 부서별 slug (예: `korean`, `math`) 를 인라인 입력 → 이메일 자동 조합.

**하지 않는 것**:
- 스키마 변경 (departments 를 객체 배열로) — 별도 slice · backward compat 유지.
- slug 자동 로마자화 (예: 국어→gugeo) — 사용자 명시 입력.
- 부서-교사 매핑 (별도 slice).
- Skip 카테고리 (v0.50 패턴 재사용).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/AutoCreateDepartmentGroupsDialog.tsx` — slug 입력 + preview + 반복 호출
- `packages/web/tests/AutoCreateDepartmentGroupsDialog.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 헤더에 「부서 그룹 자동 생성」 버튼 (departments 없으면 disabled) + Dialog state
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1

**손대지 마라**:
- 백엔드 · shared · Firestore · basicData 스키마.
- AutoCreateGroupsDialog (반 그룹 자동 생성) — 그대로.
- callGroupsCreate.

### 세부 요구

#### 1. `AutoCreateDepartmentGroupsDialog.tsx`

**Props**:
```ts
export interface AutoCreateDepartmentGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  departments: string[];   // basic_data.departments
  onDone?: () => void;
}
```

**slug 상수·헬퍼**:
```ts
const ALLOWED_DOMAIN = 'cam.hs.kr';
const SLUG_REGEX = /^[a-z0-9-]+$/;   // 소문자·숫자·하이픈만

function buildDeptGroupEmail(slug: string): string {
  return `${slug}@${ALLOWED_DOMAIN}`;
}

function buildDeptGroupName(deptName: string): string {
  return deptName;   // 원본 그대로
}

function buildDeptGroupDescription(year: number, deptName: string): string {
  return `${year}년 ${deptName} 자동 생성`;
}

function defaultSlug(index: number): string {
  return `dept-${index + 1}`;
}
```

**state**:
```ts
type Phase = 'confirm' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';
type Result = { deptName: string; email: string; kind: ResultKind; message?: string };

const [phase, setPhase] = useState<Phase>('confirm');
const [slugs, setSlugs] = useState<string[]>([]);   // departments 와 index 동기화
const [progress, setProgress] = useState(0);
const [results, setResults] = useState<Result[]>([]);
```

**초기화 (open true 시)**:
```ts
useEffect(() => {
  if (open) {
    setPhase('confirm');
    setProgress(0);
    setResults([]);
    setSlugs(departments.map((_, i) => defaultSlug(i)));
  }
}, [open, departments]);
```

**preview 계산**:
```ts
const preview = departments.map((dept, i) => {
  const slug = (slugs[i] ?? '').trim().toLowerCase();
  const valid = SLUG_REGEX.test(slug);
  return {
    deptName: dept,
    slug,
    email: valid ? buildDeptGroupEmail(slug) : '',
    valid,
  };
});

const allValid = preview.length > 0 && preview.every((p) => p.valid);
const uniqueSlugs = new Set(preview.map((p) => p.slug));
const noDuplicates = uniqueSlugs.size === preview.length;
const canConfirm = allValid && noDuplicates;
```

**iteration**:
```ts
const handleConfirm = async () => {
  setPhase('running');
  const localResults: Result[] = [];
  for (let i = 0; i < preview.length; i++) {
    const p = preview[i];
    try {
      await callGroupsCreate({
        email: p.email,
        name: buildDeptGroupName(p.deptName),
        description: buildDeptGroupDescription(year, p.deptName),
      });
      localResults.push({ deptName: p.deptName, email: p.email, kind: 'ok' });
    } catch (e) {
      const message = (e as Error).message;
      const kind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
      localResults.push({ deptName: p.deptName, email: p.email, kind, message });
    }
    setProgress(i + 1);
  }
  setResults(localResults);
  setPhase('done');
  queryClient?.invalidateQueries({ queryKey: ['groups', 'list'] });
};
```

`isAlreadyExistsError` — AutoCreateGroupsDialog 와 동일 (인라인 복사, 리팩터 금지).

**UI — confirm phase**:
```tsx
<DialogHeader>
  <DialogTitle>부서 그룹 자동 생성</DialogTitle>
  <DialogDescription>
    {year}년도 {departments.length}개 부서 그룹을 생성합니다. 각 부서의 slug (이메일 로컬 파트) 를 지정하세요.
  </DialogDescription>
</DialogHeader>
<div className="max-h-64 overflow-y-auto border border-border-subtle" data-testid="auto-create-dept-groups-targets">
  <table className="w-full text-small">
    <thead className="bg-canvas border-b border-border-subtle text-fg-secondary text-left sticky top-0">
      <tr>
        <th className="py-2 px-3 font-medium">부서</th>
        <th className="py-2 px-3 font-medium">Slug</th>
        <th className="py-2 px-3 font-medium">이메일</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border-subtle">
      {departments.map((dept, i) => (
        <tr key={`${dept}-${i}`}>
          <td className="py-2 px-3 text-fg-primary">{dept}</td>
          <td className="py-2 px-3">
            <input
              type="text"
              value={slugs[i] ?? ''}
              onChange={(e) => {
                const next = [...slugs];
                next[i] = e.target.value;
                setSlugs(next);
              }}
              data-testid={`auto-create-dept-slug-${i}`}
              className={
                preview[i]?.valid
                  ? 'w-32 border border-border-subtle bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none focus:border-border-strong'
                  : 'w-32 border border-state-danger bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none'
              }
            />
          </td>
          <td className="py-2 px-3 font-mono text-fg-secondary">
            {preview[i]?.valid ? preview[i].email : <span className="text-state-danger">invalid</span>}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
{!allValid && (
  <p className="text-small text-state-danger">일부 slug 이 유효하지 않습니다 (소문자·숫자·하이픈만).</p>
)}
{!noDuplicates && (
  <p className="text-small text-state-danger">중복된 slug 이 있습니다.</p>
)}
<DialogFooter>
  <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
  <Button
    onClick={handleConfirm}
    disabled={!canConfirm || departments.length === 0}
    data-testid="auto-create-dept-groups-confirm-btn"
  >
    생성 실행
  </Button>
</DialogFooter>
```

**running · done phase**: AutoCreateGroupsDialog 와 동일 구조 (3 카운트, skip 목록, failure 목록). data-testid 접두사 `auto-create-dept-groups-*`.

#### 2. `BasicDataPanel.tsx` — 「부서 그룹 자동 생성」 버튼

기존 「그룹 자동 생성」 버튼 옆:
```tsx
<Button
  variant="secondary"
  onClick={() => setIsAutoCreateDeptOpen(true)}
  data-testid="basic-data-auto-create-dept-groups-btn"
  disabled={!data?.data?.departments || data.data.departments.length === 0}
  title={
    !data?.data?.departments || data.data.departments.length === 0
      ? '부서를 먼저 추가하세요'
      : '부서로 그룹 자동 생성'
  }
>
  부서 그룹 자동 생성
</Button>
```

**state**: `const [isAutoCreateDeptOpen, setIsAutoCreateDeptOpen] = useState(false);`

**다이얼로그 렌더** (기존 AutoCreateGroupsDialog 옆):
```tsx
{data?.data?.departments && (
  <AutoCreateDepartmentGroupsDialog
    open={isAutoCreateDeptOpen}
    onOpenChange={setIsAutoCreateDeptOpen}
    year={currentYear}
    departments={data.data.departments}
  />
)}
```

#### 3. 테스트

**web `AutoCreateDepartmentGroupsDialog.test.tsx`** (4 시나리오):
1. `open=true` departments=['국어과','수학과'] → preview 2 행, 각 slug 기본값 `dept-1`, `dept-2`.
2. slug 유효하지 않게 편집 (예: 'Korean!' 대문자 + 특수문자) → invalid 표시, confirm 버튼 disabled.
3. 중복 slug (두 부서 모두 `dept-1`) → confirm 버튼 disabled + 중복 오류 메시지.
4. 성공/skip/실패 반복 (mock callGroupsCreate 3 결과) → done phase 3 카운트.

**web `BasicDataPanel.test.tsx`** (1 신규):
- departments 없음 → `basic-data-auto-create-dept-groups-btn` disabled.
- departments 있음 → enabled.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 549 + 신규 5 = 554 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - departments 저장 후 「부서 그룹 자동 생성」 버튼 enabled
   - 클릭 → 다이얼로그, slug 편집 인라인
   - 유효 slug + 중복 없음 → 실행 → 진행 바 → 결과
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **자동 로마자화** — 별도 slice (부서 이름 「국어」→「gugeo」 매핑 · 사전 필요).
- **스키마 확장 (departments 를 {name, slug} 객체 배열)** — 별도 slice, backward compat 필요.
- **AutoCreateGroups 와 AutoCreateDepartmentGroups 공통 로직 추출** — 아직 리팩터 범위 아님. 3 번째 다이얼로그 나오면 재고.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateDepartmentGroupsDialog + BasicDataPanel 「부서 그룹 자동 생성」 버튼`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-create-dept-groups-v51`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
