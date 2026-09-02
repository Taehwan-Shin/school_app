# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 v4 프론트엔드 UI v0.27** — v0.26 백엔드 서버 사이드 필터를 UI 로. `useAuditLogList` hook 이 filter 파라미터 받도록. 결과 필터를 client → server 이관. 신규 「행위자」 인풋. URL 동기화 확장.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-log-v4-ui-v27`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `b359599` (감사 로그 v4 백엔드 v0.26)

## 지금 할 것 — AuditLogTable 서버 사이드 필터 활용

### 왜

v0.26 로 백엔드가 서버 사이드 필터 지원. 이제 프론트엔드가 그 능력을 활용해야 함:
- 결과 필터를 서버로 옮겨 audit_log 대량 시 정확한 필터
- 새 「행위자」 인풋 (서버 필터)
- 액션 검색은 여전히 client-side (Firestore 는 substring 검색 안 함)

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/api/auditLogList.ts` — `useAuditLogList` hook 이 filter 옵션 받도록 확장. 필터 변경 시 entries 리셋 + 페이지 0 재fetch.
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — resultFilter 를 server-side (hook 전달), 새 「행위자」 인풋 추가, URL 동기화 확장 (`?actor=`).
- `packages/web/tests/auditLogList.test.tsx` — 필터 옵션 시나리오 2 추가.
- `packages/web/tests/AuditLogTable.test.tsx` — 새 UI 시나리오 3 추가.

**신규 파일**: 없음.

**손대지 마라**:
- 백엔드.
- 다른 라우트.

### 세부 요구

#### 1. `useAuditLogList` 확장

**현재 시그니처**:
```ts
export function useAuditLogList(pageSize = 25): { entries, loading, error, hasMore, loadMore, reload }
```

**변경 후**:
```ts
export interface AuditLogFilters {
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}

export function useAuditLogList(pageSize = 25, filters?: AuditLogFilters): {
  entries: AuditLogEntryRead[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}
```

**구현 규칙**:
- `useEffect` 트리거에 `filters` 추가 (deps). 필터 변경 시 entries 리셋 + 페이지 0 재fetch.
- `fetchPage` 호출 시 filters 도 함께 전달 (`callAuditLogList({ limit, before, ...filters })`).
- loadMore 도 filters 유지.
- reload 도 filters 유지.

**주의 (안정 참조)** — filters 객체 참조 변경 시 useEffect 재실행. 각 필드를 개별 dep 로:
```ts
useEffect(() => {
  // ...
}, [pageSize, fetchTrigger, filters?.filterActor, filters?.filterTarget, filters?.filterResult]);
```

#### 2. `AuditLogTable.tsx` — UI 확장

**현재 필터 UI** (v0.24):
- Result 드롭다운 (client-side)
- Action 검색 (client-side)
- 새로 고침 · CSV 내보내기

**변경 후**:
- Result 드롭다운 → **서버 필터** (`useAuditLogList` filters.filterResult 전달)
- Action 검색 → **client-side 유지** (Firestore 는 contains 지원 안 함, 로드된 페이지 안에서만)
- **행위자 인풋 신규** → 서버 필터 (`filters.filterActor`)
- URL 파라미터: `?actor=` 추가

**상태 정의**:
```ts
const [searchParams, setSearchParams] = useSearchParams();
const resultFilter = ...;  // 기존, 서버 필터로 이관
const actionSearch = ...;  // 기존, 여전히 client
const actorFilter = searchParams.get('actor') ?? '';  // 신규
```

**hook 호출**:
```ts
const { entries, loading, error, hasMore, loadMore, reload } = useAuditLogList(25, {
  filterActor: actorFilter || undefined,
  filterResult: resultFilter !== 'all' ? resultFilter : undefined,
});
```

**필터 UI 로우** (기존 「N건 표시됨」 옆에):
```tsx
<div className="flex items-center gap-3">
  <input
    type="text"
    value={actorFilter}
    onChange={(e) => {
      const next = new URLSearchParams(searchParams);
      const v = e.target.value;
      if (v) next.set('actor', v); else next.delete('actor');
      setSearchParams(next, { replace: false });  // 서버 필터, 히스토리에 저장
    }}
    placeholder="행위자 이메일"
    aria-label="행위자 필터"
    data-testid="audit-log-filter-actor"
    className="w-56 border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong"
  />
  <select value={resultFilter} onChange={...}>...</select>
  <input type="text" value={actionSearch} onChange={...} placeholder="액션 검색" ... />
  <Button ...>새로 고침</Button>
  <Button ...>CSV 내보내기</Button>
</div>
```

**client-side 필터 후 remaining** — 이제는 actionSearch 만 client. `filteredEntries` useMemo 는 그것만 처리.

**빈 상태 문구 개선**:
- 서버가 0 반환 (result + actor 필터 매칭 없음) → 「해당 필터에 매칭되는 로그가 없습니다.」
- 서버는 반환했지만 client 액션 검색으로 0 → 기존 문구 유지

#### 3. 테스트

**`auditLogList.test.tsx`** 신규 2:
1. hook 이 filter 옵션 받으면 fetch body 에 그 필터 포함되어 전송
2. filter 변경 시 entries 리셋 + 페이지 0 재fetch (mock fetchMock 두 번 호출 확인)

**`AuditLogTable.test.tsx`** 신규 3:
1. URL `?actor=super@cam.hs.kr` 초기 로드 → 인풋 값 반영 + fetch body 에 filterActor
2. 「행위자」 인풋에 입력 → URL 갱신
3. 서버 필터 매칭 0 → 「해당 필터에 매칭되는 로그가 없습니다.」

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 399 + 신규 5 = 404 근처.
5. dev 서버 확인:
   - `/super_admin/audit?actor=admin2@cam.hs.kr` 로 초기 접근 → 인풋 값 채워지고 서버 필터 적용된 결과만 로드
   - 「행위자」 인풋 변경 → URL 갱신 + 자동 재fetch
   - 「결과」 드롭다운 「거부」 → 서버 필터로 denied 만 반환
   - 「액션 검색」 은 여전히 client-side (로드된 페이지에서만)
   - 세 필터 조합 시 정상 (server 는 actor+result, client 는 action)
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **target 필터 UI** — 사용자 상세 페이지에서 사용 예정 (별도 slice).
- **날짜 범위 필터** — 별도 slice (before/after 파라미터 UI).
- **actor 자동완성** — 별도 slice.
- **실 Firestore composite index 활성 확인** — v0.26 배포 시 인덱스 빌드 완료 필요. 미완이면 「인덱스 없음」 에러가 뜰 수 있음.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): useAuditLogList hook 에 서버 사이드 filter 옵션 전달`
2. `feat(web): AuditLogTable 행위자 필터 인풋 + result 서버 사이드 이관 + URL 동기화`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-log-v4-ui-v27`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
