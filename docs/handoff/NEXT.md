# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **CSV 확장 + 감사 프리셋 v0.37** — MembersTable CSV 내보내기 + AuditLogTable 날짜 프리셋 칩 (지난 24시간·7일·30일·전체). 프론트엔드 only.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/csv-preset-v37`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `fb2e7e7` (감사 로그 날짜 범위 필터 v0.36)

## 지금 할 것 — MembersTable CSV + AuditLogTable 프리셋 칩

### 왜

**CSV**: v0.34 로 AccountsTable · GroupsTable 에 CSV 내보내기. MembersTable 은 아직 없음. 큰 그룹 멤버 목록을 Excel 로 가져가야 하는 경우 자주 발생. 대칭 완성.

**프리셋**: v0.36 로 감사 로그 날짜 범위 필터. 실무에서는 「지난 24시간 · 7일 · 30일」 이 압도적으로 흔한 필터. 매번 date input 두 번 클릭 대신 원클릭 프리셋.

**하지 않는 것**: 사용자 정의 프리셋. atMax 자동 (프리셋은 atMin 만 설정, atMax 는 지우고 자동 = 지금까지). URL 파라미터 이름 재설계.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/MembersTable.tsx` — 「CSV 내보내기」 버튼 + handler
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — 프리셋 칩 4 개 로우 추가
- `packages/web/tests/MembersTable.test.tsx` — CSV 버튼 시나리오 1
- `packages/web/tests/AuditLogTable.test.tsx` — 프리셋 칩 시나리오 2

**손대지 마라**:
- 백엔드 · middleware · audit · Firestore 인덱스 — 전부 그대로.
- 다른 라우트 · 컴포넌트.
- CSV util 을 별도 파일로 추출 금지 (AccountsTable · GroupsTable · AuditLogTable 모두 인라인).

### 세부 요구

#### 1. `MembersTable.tsx` — CSV 버튼

**위치**: 상단 액션 로우 「+ 멤버 추가」 왼쪽 (`packages/web/src/routes/admin/MembersTable.tsx:50`).

```tsx
<Button
  variant="secondary"
  onClick={handleExportCsv}
  data-testid="members-export-csv-btn"
  disabled={filteredMembers.length === 0}
>
  CSV 내보내기
</Button>
<Button onClick={() => setIsAddOpen(true)} data-testid="add-member-btn">
  + 멤버 추가
</Button>
```

**handler** (AccountsTable/GroupsTable/AuditLogTable 패턴):
```ts
const handleExportCsv = () => {
  const header = ['이메일', '역할', '타입'];
  const rows = filteredMembers.map((m) => [
    m.email,
    m.role,
    m.type ?? '',
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeGroupSlug = groupEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `members-${safeGroupSlug}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

**주의**:
- `filteredMembers` 사용 (검색·역할 필터 반영). AuditLogTable 이 `filteredEntries` 쓰는 것과 동일 원칙.
- 그룹 이메일 앞 부분을 슬러그화해서 파일명에 포함 (여러 그룹 export 시 구분).
- `GroupMemberItem` 의 `type` 필드 이름은 hook (`useGroupMembersList`) 반환 shape 확인 후 사용. 없으면 컬럼 스킵.

#### 2. `AuditLogTable.tsx` — 프리셋 칩

**위치**: 기존 필터 로우 하단 (result select, date input 두 개 다음 새 줄).

**로직**:
```ts
const handlePreset = (days: number | null) => {
  const next = new URLSearchParams(searchParams);
  if (days === null) {
    // '전체' — 날짜 필터 지우기
    next.delete('atMin');
    next.delete('atMax');
  } else {
    const atMinDate = new Date();
    atMinDate.setDate(atMinDate.getDate() - days);
    const yyyy = atMinDate.getFullYear();
    const mm = String(atMinDate.getMonth() + 1).padStart(2, '0');
    const dd = String(atMinDate.getDate()).padStart(2, '0');
    next.set('atMin', `${yyyy}-${mm}-${dd}`);
    next.delete('atMax'); // 프리셋은 지금까지
  }
  setSearchParams(next, { replace: false });
};

const activePreset: number | 'all' | null = (() => {
  if (!searchParams.get('atMin') && !searchParams.get('atMax')) return 'all';
  // 정확히 오늘로부터 N일 전인 atMin 인지 체크 — atMax 없어야 함
  if (searchParams.get('atMax')) return null;
  const raw = searchParams.get('atMin');
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const now = new Date();
  const check = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}` === raw;
  };
  if (check(1)) return 1;
  if (check(7)) return 7;
  if (check(30)) return 30;
  return null;
})();
```

**UI**:
```tsx
<div className="flex items-center gap-2" role="group" aria-label="날짜 프리셋">
  <span className="text-small text-fg-secondary mr-1">프리셋:</span>
  {[
    { key: 1 as const, label: '지난 24시간' },
    { key: 7 as const, label: '지난 7일' },
    { key: 30 as const, label: '지난 30일' },
    { key: 'all' as const, label: '전체' },
  ].map(({ key, label }) => (
    <button
      key={String(key)}
      type="button"
      onClick={() => handlePreset(key === 'all' ? null : key)}
      data-testid={`audit-log-preset-${key}`}
      className={cn(
        'px-3 py-1 text-small border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
        activePreset === key
          ? 'bg-fg-primary text-canvas border-fg-primary'
          : 'bg-canvas text-fg-primary border-border-subtle hover:border-border-strong',
      )}
    >
      {label}
    </button>
  ))}
</div>
```

주의:
- `cn` 유틸은 이미 `packages/web/src/lib/utils.ts` 에서 사용 중 (MembersTable 이 이미 import).
- 프리셋과 커스텀 date input 은 병존. 프리셋 클릭 → atMax 지움 (프리셋 = 오늘까지). 커스텀 date input 사용 시 프리셋 활성 표시 없음 (activePreset === null).

#### 3. 테스트

**web `MembersTable.test.tsx`** (1 시나리오 신규):
- 3 명 로드 → `members-export-csv-btn` 존재 + enabled.
- 필터로 0 명 → 버튼 disabled.

**web `AuditLogTable.test.tsx`** (2 시나리오 신규):
1. 「지난 7일」 클릭 → URL 이 `?atMin=YYYY-MM-DD` 로 업데이트 (오늘로부터 7일 전).
2. 「전체」 클릭 → `atMin`·`atMax` 파라미터 제거.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 470 + 신규 3 = 473 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/groups/{email}` 멤버 관리 상단에 「CSV 내보내기」 버튼
   - `/super_admin/audit` 필터 로우 아래에 프리셋 칩 4 개
   - 「지난 24시간」 클릭 → URL 업데이트, 필터 결과 리로드
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **큰 그룹 (1000+ 멤버) CSV 성능** — 지금 데이터 규모 문제 없음.
- **timezone 경계 (자정 부근 클릭)** — 프리셋 클릭 시각 기준 하루 전 자정으로 계산됨 (로컬 시간대). 자정 넘어가는 정확한 timezone 처리 는 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): MembersTable CSV 내보내기 (검색·필터 반영)`
2. `feat(web): AuditLogTable 날짜 프리셋 칩 (지난 24시간·7일·30일·전체)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/csv-preset-v37`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
