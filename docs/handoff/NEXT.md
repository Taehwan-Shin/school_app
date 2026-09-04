# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data 부서 확장 v0.49** — 스키마에 optional `departments: string[]` 추가. BasicDataPanel 표시 + EditBasicDataDialog 편집. 백엔드 validator 확장.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-departments-v49`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `f64ed96` (그룹 자동 생성 v0.48)

## 지금 할 것 — 부서 (departments) 필드 추가

### 왜

basic_data 는 지금 학년/반 만. 실 학교에는 부서 (국어과·수학과·과학과 등) 개념 필요 — 교사 배정, 부서별 mailing list 등에 활용. optional string 배열로 최소 추가 — 기존 문서 backward compat 유지.

**하지 않는 것**: 부서별 그룹 자동 생성 (v0.50 후보). 부서-교사 매핑 (별도 slice). 부서 위계 (부서장 등). 부서 이름의 자유도 (한글 · 영어 혼용 허용 · 검증 최소).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/shared/src/basicData.ts` — `BasicDataYear` 에 `departments?: string[]` 추가 + validator 확장
- `packages/shared/tests/basicData.test.ts` — 시나리오 3 (departments 유효/무효/optional)
- `packages/functions/tests/basicDataSet.test.ts` — 시나리오 2 (departments 정상 저장, 잘못된 값 reject)
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 학년/반 아래 부서 섹션
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1 (부서 렌더)
- `packages/web/src/routes/admin/EditBasicDataDialog.tsx` — 부서 편집 필드 (textarea 또는 쉼표 구분 input)
- `packages/web/tests/EditBasicDataDialog.test.tsx` — 시나리오 2 (departments 초기화·저장)

**손대지 마라**:
- basicData.get/set callable 자체 로직 — validator 만 자동으로 적용됨 (같은 함수 사용).
- Firestore 인덱스 · 새 callable.
- AutoCreateGroupsDialog · groupsCreate · 다른 라우트.

### 세부 요구

#### 1. `basicData.ts` — 스키마 확장

```ts
export interface BasicDataYear {
  year: number;
  grades: BasicDataGradeClass[];
  departments?: string[];         // 신규: 부서 이름 배열 (예: ['국어과', '수학과'])
  updatedAt?: number;
  updatedBy?: string;
}
```

validator 확장 — `!Array.isArray(obj.grades)` 검증 다음에:
```ts
if (obj.departments !== undefined) {
  if (!Array.isArray(obj.departments)) return false;
  if (!obj.departments.every((d: unknown) => typeof d === 'string' && d.trim().length > 0)) return false;
}
```

**주의**:
- optional — undefined 허용 (기존 문서 backward compat).
- 빈 배열 (`[]`) 은 유효 (부서 없음 명시적 설정).
- 각 부서 이름은 trim 후 non-empty.

#### 2. 백엔드 테스트 (`shared/tests/basicData.test.ts`) — 3 시나리오

기존 유효 시나리오에 추가:
1. departments 없이 유효 → true.
2. departments = ['국어과', '수학과'] → true.
3. departments = ['국어과', ''] (빈 문자열 포함) → false.
4. departments = 'notArray' → false.

기존 시나리오 회귀 유지.

#### 3. 백엔드 테스트 (`functions/tests/basicDataSet.test.ts`) — 2 시나리오

기존 유효 시나리오에 추가:
1. request 에 departments 포함 → Firestore.set 호출 인자에 departments 포함 확인.
2. departments 형식 오류 → invalid-argument error audit.

#### 4. `BasicDataPanel.tsx` — 부서 표시

기존 학년/반 렌더링 (`packages/web/src/routes/admin/BasicDataPanel.tsx`) 아래에 조건부 섹션:
```tsx
{data.data.departments && data.data.departments.length > 0 && (
  <div className="pt-4 border-t border-border-subtle" data-testid="basic-data-departments">
    <div className="text-micro uppercase tracking-wide text-fg-secondary mb-2">부서</div>
    <div className="flex flex-wrap gap-2">
      {data.data.departments.map((d) => (
        <span
          key={d}
          className="px-2 py-1 border border-border-subtle bg-canvas text-small text-fg-primary"
          data-testid={`basic-data-department-${d}`}
        >
          {d}
        </span>
      ))}
    </div>
  </div>
)}
```

#### 5. `EditBasicDataDialog.tsx` — 부서 편집

기존 학년 rows 편집 UI 아래에 (「+ 학년 추가」 밑에) 부서 섹션:
```tsx
<div>
  <label className="text-small text-fg-primary">부서 (선택 · 쉼표 구분)</label>
  <input
    type="text"
    value={departmentsText}
    onChange={(e) => setDepartmentsText(e.target.value)}
    placeholder="국어과, 수학과, 영어과"
    data-testid="edit-basic-data-departments"
    className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
  />
  <p className="text-micro text-fg-muted mt-1">비워두면 부서 없음.</p>
</div>
```

**state**:
```ts
const [departmentsText, setDepartmentsText] = useState('');
```

**초기화** (기존 useEffect 안):
```ts
setDepartmentsText((initialData?.departments ?? []).join(', '));
```

**submit 시 변환** (기존 grades 파싱 다음에):
```ts
const departmentsInput = departmentsText.trim();
const departments: string[] | undefined = departmentsInput
  ? departmentsInput.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  : undefined;
```

`saveBasicData` 호출 시 `departments` 포함 (undefined 이면 spread 조건 처리):
```ts
await saveBasicData({
  year,
  grades,
  ...(departments !== undefined ? { departments } : {}),
});
```

**주의**:
- `basicDataSet.ts` 의 `BasicDataSetRequest` 인터페이스에 optional `departments?: string[]` 추가 필요 (`packages/web/src/api/basicDataSet.ts`).
- 백엔드는 이미 validator 로 검증, 클라이언트 파싱은 UX 편의.

#### 6. 프론트엔드 테스트

**`BasicDataPanel.test.tsx`** (1 시나리오):
- data.data.departments = ['국어과', '수학과'] → `basic-data-departments` 렌더, 각 부서 badge (`basic-data-department-국어과`).

**`EditBasicDataDialog.test.tsx`** (2 시나리오):
1. initialData 에 departments 있음 → input 값이 `'국어과, 수학과'` 로 초기화.
2. 사용자가 「국어과, 수학과, 영어과」 입력 → submit 시 `saveBasicData` 가 `departments: ['국어과', '수학과', '영어과']` 로 호출됨.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 540 + 신규 9 = 549 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` BasicDataPanel 데이터에 부서 있으면 badge 로 표시
   - 편집 → 부서 input 초기화됨 · 편집 저장 → 새로고침 부서 반영
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **부서별 그룹 자동 생성** — v0.50 후보 (부서 명 → email slug 변환 · 그룹 이메일).
- **부서-교사 매핑** — 별도 slice (배정 로직 필요).
- **부서 이름 재사용** — 같은 이름 배열 중복 허용 (사용자 실수 방지는 별도 slice).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(shared,functions): basic_data 스키마에 departments 필드 추가 + validator 확장`
2. `feat(web): BasicDataPanel 부서 표시 + EditBasicDataDialog 부서 편집`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-departments-v49`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
