# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basicData.listYears + 연도 dropdown v0.54** — 신규 callable `basicData.listYears()` 로 저장된 연도 목록 조회 + BasicDataPanel 이 dropdown + 수동 input 병행.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-list-years-v54`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `a7f7272` (BasicDataPanel 연도 선택 v0.53)

## 지금 할 것 — listYears callable + dropdown

### 왜

v0.53 로 연도 input 완비 — admin 은 임의 연도 편집 가능. 그러나 「이미 저장된 연도가 뭐 있는지」 확인하려면 하나씩 입력해봐야 함. `basic_data` collection 의 문서 이름 (`2025`, `2026` 등) 을 목록화하는 callable 이 필요. UI 는 dropdown + 수동 input 병행 (미저장 연도로도 이동 가능).

**하지 않는 것**:
- 연도 삭제 (별도 slice · 위험도 있어 UX 재고 필요).
- 페이지네이션 (지금 연도 개수 적음 · 전체 반환 충분).
- 연도별 요약 (반 수 · 부서 수) — 별도 slice.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/basicData/listYears.ts` — Firestore 컬렉션 조회
- `packages/functions/tests/basicDataListYears.test.ts` — 시나리오 4~5
- `packages/web/src/api/basicDataListYears.ts` — fetch + useQuery hook
- `packages/web/tests/basicDataListYears.test.ts` — 시나리오 2

**수정 대상**:
- `packages/functions/src/index.ts` — export `basicDataListYears`
- `firebase.json` — hosting rewrite `/api/basicDataListYears`
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — dropdown 추가 + input 병행
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1 (dropdown 렌더)

**손대지 마라**:
- `basicData.get/set` · shared 스키마 · middleware.
- 다른 라우트 · Dialog.

### 세부 요구

#### 1. `basicData/listYears.ts` — callable

`basicData/get.ts` (`packages/functions/src/callable/basicData/get.ts`) 를 참고. 다른 점:

**입력**: `{}` — 파라미터 없음.

**응답**:
```ts
export interface BasicDataListYearsResponse {
  years: number[];   // descending order
}
```

**로직**:
- authenticate → assertHasCap('basic_data.read')
- `db.collection('basic_data').listDocuments()` (Firestore admin SDK) 또는 `db.collection('basic_data').select().get()` — 문서 참조/스냅샷만 필요, 데이터 안 읽어도 됨
- 각 문서 id (`String(year)`) 를 `Number.parseInt` 로 파싱
- 유효 숫자만 필터, 내림차순 정렬
- audit: action `'basic_data.read'`, target `'basic_data/*'`, message `listed ${years.length} years`

**주의**:
- `listDocuments()` 는 실제 문서 데이터 안 읽음 → 저비용.
- Firestore admin SDK 에서 `db.collection('basic_data').listDocuments()` 사용 가능 (client SDK 는 없지만 admin SDK 는 있음).

#### 2. functions/index.ts + firebase.json

```ts
export { basicDataListYears } from './callable/basicData/listYears.js';
```

firebase.json rewrite:
```json
{
  "source": "/api/basicDataListYears",
  "function": { "functionId": "basicDataListYears", "region": "asia-northeast3" }
}
```

#### 3. 백엔드 테스트 (`basicDataListYears.test.ts`) — 4~5 시나리오

1. 미인증 → denied audit.
2. 캡 부족 (teacher) → denied audit.
3. 컬렉션 비어있음 → `years: []`, ok audit.
4. 문서 3개 (2024, 2025, 2026) → `years: [2026, 2025, 2024]` (내림차순), ok audit.
5. 잘못된 doc id (`invalid_year_str`) 무시 → 숫자만 반환.

Firestore mock 은 `auditLogList.test.ts` 참고. `listDocuments()` 는 mock 에서 documents ref 배열 반환.

#### 4. `basicDataListYears.ts` — hook

`basicDataGet.ts` (`packages/web/src/api/basicDataGet.ts`) 참고:

```ts
export interface BasicDataListYearsResponse {
  years: number[];
}

export async function callBasicDataListYears(): Promise<BasicDataListYearsResponse> {
  // fetch to /basicDataListYears
  // body: JSON.stringify({ data: { _googleAccessToken: googleAccessToken } })
}

export function useBasicDataListYears(enabled = true) {
  return useQuery<BasicDataListYearsResponse, Error>({
    queryKey: ['basic_data', 'list_years'],
    queryFn: () => callBasicDataListYears(),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

#### 5. 프론트엔드 테스트 (`basicDataListYears.test.ts`) — 2

1. 200 응답 → hook `data.years = [...]`.
2. 401 → hook throws.

#### 6. `BasicDataPanel.tsx` — dropdown

기존 연도 input 위/옆에 dropdown 추가:
```tsx
const { data: yearsData } = useBasicDataListYears();
const savedYears = yearsData?.years ?? [];

<div className="flex items-center gap-2">
  <label className="text-small text-fg-secondary" htmlFor="basic-data-year-input">연도:</label>
  {savedYears.length > 0 && (
    <select
      value={savedYears.includes(selectedYear) ? String(selectedYear) : ''}
      onChange={(e) => {
        const v = e.target.value;
        if (v) setYearInput(v);
      }}
      data-testid="basic-data-year-select"
      className="border border-border-subtle bg-canvas px-2 py-1 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
    >
      <option value="">-- 저장된 연도 --</option>
      {savedYears.map((y) => (
        <option key={y} value={String(y)}>{y}</option>
      ))}
    </select>
  )}
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

**주의**:
- dropdown 은 저장된 연도가 하나 이상 있을 때만 렌더 (빈 목록 UX 혼란 방지).
- dropdown 선택 → `yearInput` 갱신 → 기존 useEffect 가 selectedYear 반영.
- 수동 입력도 여전히 가능 (예: 저장 안 된 미래 연도).

#### 7. 프론트엔드 테스트 확장

**`BasicDataPanel.test.tsx`** (1 신규):
- mock `useBasicDataListYears` 가 `{years: [2026, 2025]}` 반환 → `basic-data-year-select` 렌더, `<option value="2026">2026</option>` 존재.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과 (`packages/functions/dist/callable/basicData/listYears.js` 생성).
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 558 + 신규 8~10 = 566~568 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 저장된 연도 있으면 dropdown 렌더
   - dropdown 선택 → yearInput 갱신 → 해당 연도 로드
   - 수동 입력도 여전히 작동
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **연도 삭제** — 별도 slice.
- **페이지네이션** — 지금 규모 문제 없음.
- **listYears 결과 캐시 무효화 시점** — set 성공 시 무효화 필요 (별도 slice, 이번은 staleTime 60s 로 자연 refetch).

### 커밋 규칙

**2 커밋 분리**:
1. `feat(functions): basicData.listYears callable + firebase.json rewrite`
2. `feat(web): useBasicDataListYears hook + BasicDataPanel 연도 dropdown`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-list-years-v54`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
