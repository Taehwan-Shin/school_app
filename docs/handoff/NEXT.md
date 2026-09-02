# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 v3 (URL 동기화 + CSV export) v0.24** — v0.22 감사 필터에 URL 동기화 (`?result=`, `?q=`) + CSV 다운로드 버튼. 프론트엔드 전용, 백엔드·스코프 변화 없음.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-log-v3-v24`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `670f3b9` (비밀번호 재설정 v0.23)

## 지금 할 것 — 감사 로그 필터 URL 동기화 + CSV export

### 왜

v0.22 로 감사 로그 필터 (result 드롭다운 + action 검색) 를 추가했지만 URL 반영 없음 → 특정 필터 상태를 링크로 공유 못 함. 실 감사 시 「이 조건으로 filtered 된 로그」 를 상대에게 공유하는 요구가 자연스러움.

또한 CSV export 는 실 감사 보고서 작성 필수.

**하지 않는 것**: actor 필터 (별도 slice). 서버 사이드 필터 (audit_log 크기 크면 별도 slice). 상세 diff 뷰.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — 필터 상태를 `useSearchParams` 로 이관. CSV 다운로드 버튼 추가.
- `packages/web/tests/AuditLogTable.test.tsx` — URL 동기화 + CSV 시나리오 3 추가.

**신규 파일**: 없음.

**손대지 마라**:
- 백엔드 · API 클라이언트 · 다른 라우트 — 이 슬라이스 밖.

### 세부 요구

#### 1. `AuditLogTable.tsx` URL 동기화

**현재**:
```ts
const [resultFilter, setResultFilter] = useState<'all' | 'ok' | 'error' | 'denied'>('all');
const [actionSearch, setActionSearch] = useState('');
```

**변경 후** (accounts v0.6 패턴 미러):
```ts
const [searchParams, setSearchParams] = useSearchParams();
const resultFilter = (() => {
  const raw = searchParams.get('result');
  return raw === 'ok' || raw === 'error' || raw === 'denied' ? raw : 'all';
})();
const actionSearch = searchParams.get('q') ?? '';
```

**onChange 핸들러**:
```tsx
<select
  value={resultFilter}
  onChange={(e) => {
    const next = new URLSearchParams(searchParams);
    const v = e.target.value;
    if (v && v !== 'all') next.set('result', v); else next.delete('result');
    setSearchParams(next, { replace: false });
  }}
  ...
>

<input
  type="text"
  value={actionSearch}
  onChange={(e) => {
    const next = new URLSearchParams(searchParams);
    const v = e.target.value;
    if (v) next.set('q', v); else next.delete('q');
    setSearchParams(next, { replace: true });  // 검색어는 replace: true (히스토리 오염 방지)
  }}
  ...
/>
```

**규칙**:
- 결과 드롭다운: `replace: false` (뒤로 가기 가능)
- 검색 인풋: `replace: true` (히스토리 오염 방지)
- 「all」 은 URL 에서 result 파라미터 삭제 (URL 짧게)

#### 2. CSV export 버튼

**위치**: 상단 로우 「새로 고침」 버튼 옆.

**마크업**:
```tsx
<Button
  variant="secondary"
  size="sm"
  onClick={handleExportCsv}
  disabled={filteredEntries.length === 0}
  data-testid="audit-log-export-csv"
>
  CSV 내보내기
</Button>
```

**로직** — `handleExportCsv`:
```ts
const handleExportCsv = () => {
  const header = ['시간', '행위자', '역할', '액션', '대상', '결과', '요청 ID', '메시지'];
  const rows = filteredEntries.map((e) => [
    new Date(e.at).toISOString(),
    e.actor,
    e.role,
    e.action,
    e.target,
    e.result,
    e.request_id,
    (e.message ?? '').replace(/\n/g, ' '),  // 개행 제거
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM 으로 Excel 한글 지원
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

**주의 (CSV 이스케이프)**:
- 각 셀 값을 `"` 로 감싸고, 내부 `"` 는 `""` 로 이스케이프
- 개행은 공백으로 대체 (다중 라인 셀 피함)
- BOM `﻿` 로 Excel 한글 표시 안 깨짐

**빈 상태**: `filteredEntries.length === 0` 이면 버튼 disabled.

#### 3. `AuditLogTable.test.tsx` 신규 3

기존 유지, 다음 3 추가 (`MemoryRouter` 초기 경로):

1. **URL result=denied 초기 로드** — `initialEntries={['/super_admin/audit?result=denied']}` → select 값 `denied`, 표에 denied 만.
2. **result 변경 시 URL 반영** — select 「거부」 선택 → `?result=denied` 로 URL 갱신 (useLocation 스파이).
3. **CSV export 클릭** — 「CSV 내보내기」 클릭 → `document.createElement('a')` + `a.download` 파일명 매치 (`/audit-log-\d{4}-\d{2}-\d{2}\.csv/`). `Blob` 생성 확인 (spy on URL.createObjectURL).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 386 + 신규 3 = 389 근처.
5. dev 서버 확인:
   - `/super_admin/audit?result=denied` 직접 접근 → 필터 자동 적용
   - 검색어 입력 → URL 즉시 갱신
   - 뒤로 가기: 필터는 이전, 검색어는 replace 라 스킵
   - 「CSV 내보내기」 클릭 → `audit-log-YYYY-MM-DD.csv` 다운로드
   - Excel 로 열 시 한글 깨짐 없음 (BOM)
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **actor 필터** — 별도 slice.
- **서버 사이드 필터·페이지 넘김** — audit_log 대량 시 별도 slice.
- **CSV Excel 호환 실측** — 사용자 확인 후.
- **날짜 범위 필터** — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): AuditLogTable 필터 상태를 URL 쿼리로 이관 (useSearchParams)`
2. `feat(web): AuditLogTable CSV export 버튼 + BOM 한글 지원`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-log-v3-v24`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
