# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **CSV 내보내기 v0.34** — AccountsTable · GroupsTable 에 「CSV 내보내기」 버튼 (AuditLogTable 패턴 그대로). UTF-8 BOM + 필터 반영 그대로.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/csv-export-v34`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `17d4d64` (삭제 성공 후 목록 이동 v0.33)

## 지금 할 것 — AccountsTable · GroupsTable CSV 내보내기

### 왜

`AuditLogTable` 은 이미 CSV 내보내기 지원 (`packages/web/src/routes/super_admin/AuditLogTable.tsx:36-60`) — UTF-8 BOM 으로 Excel 한글 지원, 필터 적용된 현재 뷰만 export. 관리자가 사용자·그룹 목록을 Excel 로 가져가야 하는 상황이 많음 (연말 정리, 감사, 마이그레이션). 같은 패턴을 두 표에 적용.

**하지 않는 것**: 백엔드 export API (client-side sortedFiltered 데이터로 충분). 전체 페이지 export (현재 필터·검색·KPI 필터 반영 상태 그대로 export). 커스텀 컬럼 선택 UI.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — 「CSV 내보내기」 버튼 + handler
- `packages/web/src/routes/admin/GroupsTable.tsx` — 동일
- `packages/web/tests/AccountsTable.test.tsx` (있으면) 또는 신규 회귀 파일 — CSV 버튼 렌더 시나리오 1
- `packages/web/tests/GroupsTable.test.tsx` (있으면) 또는 신규 회귀 파일 — CSV 버튼 렌더 시나리오 1

**손대지 마라**:
- 백엔드 · middleware · audit — 변경 없음.
- AuditLogTable · super_admin 라우트 — 그대로 (참고용).
- CSV util 을 별도 파일로 추출하지 마라 — 두 곳에 인라인 (기존 AuditLogTable 도 인라인, 리팩터 범위 밖).

### 세부 요구

#### 1. `AccountsTable.tsx` — CSV 버튼

**위치**: 「+ 계정 추가」 버튼 왼쪽 (`packages/web/src/routes/admin/AccountsTable.tsx:128-133`).

```tsx
<Button
  variant="secondary"
  onClick={handleExportCsv}
  data-testid="accounts-export-csv-btn"
  disabled={sortedFilteredUsers.length === 0}
>
  CSV 내보내기
</Button>
<Button
  onClick={() => setIsCreateOpen(true)}
  data-testid="add-account-btn"
>
  + 계정 추가
</Button>
```

**handler** (AuditLogTable 패턴 그대로):
```ts
const handleExportCsv = () => {
  const header = ['이메일', '이름', '조직 단위', '관리자', '상태'];
  const rows = sortedFilteredUsers.map((u) => [
    u.email,
    `${u.lastName ?? ''}${u.firstName ?? ''}`.trim() || '-',
    u.orgUnitPath || '/',
    u.isAdmin ? '관리자' : '일반',
    u.isSuspended ? '정지됨' : '정상',
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

**주의**:
- 컬럼 순서·라벨은 위 그대로.
- `sortedFilteredUsers` 사용 (검색·KPI 필터 반영, 정렬 반영, 페이지네이션 이전 전체).
- 빈 결과 시 버튼 disabled (사용자 혼란 방지).

#### 2. `GroupsTable.tsx` — CSV 버튼

**위치**: 「+ 그룹 추가」 버튼 왼쪽.

```tsx
<Button
  variant="secondary"
  onClick={handleExportCsv}
  data-testid="groups-export-csv-btn"
  disabled={sortedFilteredGroups.length === 0}
>
  CSV 내보내기
</Button>
<Button ...>+ 그룹 추가</Button>
```

*(정확한 변수명 `sortedFilteredGroups` 등은 GroupsTable 에서 실제 사용되는 이름 그대로 — 코드 확인.)*

**handler**:
```ts
const handleExportCsv = () => {
  const header = ['이메일', '이름', '설명', '멤버 수'];
  const rows = sortedFilteredGroups.map((g) => [
    g.email,
    g.name || '-',
    g.description || '-',
    String(g.directMembersCount ?? 0),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `groups-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

#### 3. 테스트

**web `AccountsTable.test.tsx`** (1 신규 시나리오):
- 데이터 렌더된 상태 → `accounts-export-csv-btn` 존재 + enabled
- 빈 결과 상태 (검색어 매치 없음) → 버튼 disabled
- (다운로드 자체는 jsdom 한계로 스킵 — mock 만 검증하면 값 없음)

**web `GroupsTable.test.tsx`** (1 신규 시나리오):
- 동일 패턴 (`groups-export-csv-btn`).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 456 + 신규 2 = 458 근처.
5. `pnpm -r test:emu` — 이전 43 유지.
6. dev 서버 확인:
   - `/admin` 「CSV 내보내기」 클릭 → `accounts-yyyy-mm-dd.csv` 다운로드, Excel 에서 한글 정상
   - 필터 (KPI · 검색) 적용 시 필터된 것만 export
   - `/admin/groups` 동일
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **Excel/Numbers 실측** — 사용자 확인.
- **컬럼 커스텀** — 이번 슬라이스 밖. 별도 slice.
- **비동기 CSV (10만 건+)** — 지금 데이터 규모 문제 없음. 필요 시 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): AccountsTable CSV 내보내기 버튼 (필터 반영)`
2. `feat(web): GroupsTable CSV 내보내기 버튼 (필터 반영)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/csv-export-v34`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
