# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 필터 v0.22** — `AuditLogTable` 상단에 「결과」 필터 드롭다운 (ok/error/denied/all) + 「액션」 검색 인풋 추가. 클라이언트 사이드 필터, 백엔드 무변.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-log-filter-v22`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `251368b` (사용자 정지·복구 v0.21)

## 지금 할 것 — 감사 로그 필터 (결과 · 액션 검색)

### 왜

v0.10 감사 로그 뷰어는 페이지네이션만 있고 필터 없음. 실 감사 시 「denied 만 보고 싶다」, 「특정 액션 (예: users.delete) 만 보고 싶다」 는 요구가 자연스러움. 이 슬라이스가 그 필터를 추가.

**하지 않는 것**: 서버 사이드 필터 (백엔드 확장 없이 클라이언트에서 처리, `loadMore` 로 축적한 데이터에 대해). 액션 자동완성. actor 필터. CSV export (별도 slice). URL 동기화 (별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — 상단에 필터 UI 추가. `useMemo` 로 필터 적용.
- `packages/web/tests/AuditLogTable.test.tsx` — 필터 시나리오 3 추가.

**신규 파일**: 없음.

**손대지 마라**:
- 백엔드 · API 클라이언트 · 다른 라우트 — 이 슬라이스 밖.

### 세부 요구

#### 1. `AuditLogTable.tsx` — 필터 UI 추가

**상단 로우** (기존 「N 건 표시됨 · 새로 고침」 옆에):
```tsx
<div className="flex justify-between items-center gap-4">
  <p className="text-small text-fg-secondary">
    {filteredEntries.length}건 표시됨 / 전체 {entries.length}건 · 최근 {entries.length > 0 ? new Date(entries[0].at).toLocaleDateString('ko-KR') : '-'} 까지
  </p>
  <div className="flex items-center gap-3">
    <select
      value={resultFilter}
      onChange={(e) => setResultFilter(e.target.value)}
      data-testid="audit-log-filter-result"
      className="border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary focus:outline-none focus:border-border-strong"
    >
      <option value="all">모든 결과</option>
      <option value="ok">성공</option>
      <option value="error">오류</option>
      <option value="denied">거부</option>
    </select>
    <input
      type="text"
      value={actionSearch}
      onChange={(e) => setActionSearch(e.target.value)}
      placeholder="액션 검색"
      data-testid="audit-log-filter-action"
      className="w-56 border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
    />
    <Button variant="secondary" size="sm" onClick={reload} data-testid="audit-log-reload">
      새로 고침
    </Button>
  </div>
</div>
```

**상태**:
```ts
const [resultFilter, setResultFilter] = useState<'all' | 'ok' | 'error' | 'denied'>('all');
const [actionSearch, setActionSearch] = useState('');
```

**필터 로직** — `useMemo` 로:
```ts
const filteredEntries = useMemo(() => {
  let result = entries;
  if (resultFilter !== 'all') {
    result = result.filter((e) => e.result === resultFilter);
  }
  const q = actionSearch.trim().toLowerCase();
  if (q) {
    result = result.filter((e) => e.action.toLowerCase().includes(q));
  }
  return result;
}, [entries, resultFilter, actionSearch]);
```

**표에 렌더할 때** `entries` 대신 `filteredEntries` 사용. 「더 보기」 는 서버 페이지네이션 그대로 (필터는 클라이언트).

**빈 상태 (필터 후 0)** — `data-testid="audit-log-filter-empty"`, 「필터에 매칭되는 로그가 없습니다.」

#### 2. `AuditLogTable.test.tsx` 신규 3

기존 유지, 다음 3 추가:
1. **결과 필터** — `resultFilter='denied'` 로 select 변경 → 표에 denied 항목만.
2. **액션 검색** — actionSearch 입력 → 표에 매칭 항목만.
3. **필터 조합** — result='denied' + action='users' → 두 조건 모두 만족만.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 361 + 신규 3 = 364 근처.
5. dev 서버 확인:
   - `/super_admin/audit` 상단에 결과 드롭다운 + 액션 검색 인풋
   - 「거부」 선택 → 표에 denied 만
   - 「users」 검색 → 표에 users.* 액션만
   - 「N건 표시됨 / 전체 M건」 카운트
   - 필터 후 0 이면 「필터에 매칭되는…」
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **서버 사이드 필터** — audit_log 가 커지면 필요, 별도 slice.
- **actor 필터** — 별도 slice.
- **URL 동기화** — 별도 slice.
- **CSV export** — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): AuditLogTable 상단에 결과·액션 필터 UI + useMemo 필터`
2. `test(web): AuditLogTable 필터 시나리오 3 추가`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-log-filter-v22`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
