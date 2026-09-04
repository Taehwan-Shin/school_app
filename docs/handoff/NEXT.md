# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **BasicDataPanel 연도 선택 v0.53** — 현재 연도 (`new Date().getFullYear()`) 하드코딩 대신 admin 이 연도 input 편집 가능. 지난·다음 연도 조회·편집 지원.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-year-picker-v53`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `20a3cd1` (AutoCreateGroups 접두사 편집 v0.52)

## 지금 할 것 — 연도 선택 input

### 왜

BasicDataPanel 은 지금 항상 `new Date().getFullYear()` 로 고정 (`packages/web/src/routes/admin/BasicDataPanel.tsx:9`). 실무에서 「지난 학년도 기초값 확인」 · 「내년도 미리 등록」 필요. admin 이 연도 input 편집 → hook 이 해당 연도로 refetch.

**하지 않는 것**: 연도 목록 자동 조회 (별도 slice — `basicData.listYears` callable 필요). 히스토리 (past versions). 연도 삭제.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — `currentYear` 를 `selectedYear` state 로. 연도 input 추가.
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 2 (기본 연도 · 편집)

**손대지 마라**:
- 백엔드 · shared · basicData.get/set — 그대로 (year 파라미터로 이미 지원).
- EditBasicDataDialog · AutoCreateGroupsDialog · AutoCreateDepartmentGroupsDialog — 이미 `year` prop 받음.
- useBasicDataGet hook — 그대로 (year 인자 이미 있음).

### 세부 요구

#### 1. `BasicDataPanel.tsx` — 연도 state

기존:
```ts
const currentYear = new Date().getFullYear();
```

변경:
```ts
const thisYear = new Date().getFullYear();
const [selectedYear, setSelectedYear] = useState(thisYear);
const [yearInput, setYearInput] = useState(String(thisYear));

// yearInput 변경 시 유효한 숫자면 selectedYear 반영
useEffect(() => {
  const parsed = Number.parseInt(yearInput, 10);
  if (Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200) {
    setSelectedYear(parsed);
  }
}, [yearInput]);
```

`useBasicDataGet(currentYear)` → `useBasicDataGet(selectedYear)`.

**주의**:
- `yearInput` 은 문자열 (input value). `selectedYear` 는 숫자 (hook 인자).
- 유효 범위 벗어나면 selectedYear 는 그대로 (마지막 유효값 유지).
- Dialog 에 넘길 때 `selectedYear` 사용 (년도 별 편집).

#### 2. UI — 연도 input

기존:
```tsx
<div className="text-small text-fg-secondary">
  연도: <strong className="font-mono text-fg-primary">{currentYear}</strong>
</div>
```

변경:
```tsx
<div className="flex items-center gap-2">
  <label className="text-small text-fg-secondary" htmlFor="basic-data-year-input">연도:</label>
  <input
    id="basic-data-year-input"
    type="number"
    min={1900}
    max={2200}
    value={yearInput}
    onChange={(e) => setYearInput(e.target.value)}
    data-testid="basic-data-year-input"
    className="w-20 border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary text-center focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
  />
</div>
```

버튼들에 `selectedYear` 반영 (기존 `currentYear` 참조를 전부 `selectedYear` 로):
- `EditBasicDataDialog year={selectedYear}`
- `AutoCreateGroupsDialog year={selectedYear}`
- `AutoCreateDepartmentGroupsDialog year={selectedYear}`
- 「N년 기초값이 아직 설정되지 않았습니다」 문구도 `selectedYear` 사용

#### 3. 테스트

**web `BasicDataPanel.test.tsx`** (2 신규):
1. **기본 연도 렌더**: 컴포넌트 mount → `basic-data-year-input` value 가 현재 연도 문자열.
2. **연도 편집 → refetch**: `basic-data-year-input` 에 `2027` 입력 → `useBasicDataGet` 이 `2027` 로 호출됨 (mock 확인).

기존 시나리오 회귀 유지 (특히 「N년 기초값이 아직 설정되지 않았습니다」 문구).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 556 + 신규 2 = 558 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 헤더 연도 input (기본 현재 연도)
   - 편집 → 다른 연도의 데이터 로드
   - 편집 · 그룹 자동 생성 · 부서 그룹 자동 생성 모두 선택된 연도 기준으로 작동
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **연도 목록 자동 조회** — 별도 slice (basicData.listYears callable 필요).
- **히스토리 (past versions of same year)** — 별도 slice.
- **연도 삭제** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): BasicDataPanel 연도 선택 input (지난·다음 연도 조회·편집 지원)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-year-picker-v53`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
