# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data JSON 내보내기 v0.61** — BasicDataPanel 헤더에 「JSON 내보내기」 버튼. 현재 연도 데이터를 JSON 파일로 다운로드.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-json-export-v61`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `369b25b` (부서 그룹 + 부서장 지정 v0.60)

## 지금 할 것 — basic_data JSON export

### 왜

basic_data 는 학년/반/부서/rosters/updatedAt 등 복합 구조. 외부 백업, 다른 연도 참고, 스프레드시트 편집 등을 위해 JSON 파일로 다운로드 필요. AccountsTable · GroupsTable · MembersTable · AuditLogTable 은 CSV 이미 있지만 basic_data 는 CSV 로 표현 어려운 nested 구조 → JSON 이 자연스러움.

**하지 않는 것**: JSON import (별도 slice — 검증·병합 UX 필요). CSV 대체 (basic_data 는 JSON 만).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 「JSON 내보내기」 버튼 + handler
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1

**손대지 마라**:
- 백엔드 · shared · basicData 스키마.
- 다른 다이얼로그 · Panel.

### 세부 요구

#### 1. `BasicDataPanel.tsx` — JSON export handler

기존 버튼 그룹 안에 (또는 헤더 오른쪽 별도 위치):
```tsx
<Button
  variant="secondary"
  onClick={handleJsonExport}
  data-testid="basic-data-json-export-btn"
  disabled={!data?.data}
  title={!data?.data ? '데이터 없음' : `${selectedYear}년 기초값 JSON 다운로드`}
>
  JSON 내보내기
</Button>
```

**handler** (기존 CSV export 패턴 참고 · AccountsTable · GroupsTable):
```ts
const handleJsonExport = () => {
  if (!data?.data) return;
  const json = JSON.stringify(data.data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `basic-data-${selectedYear}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

**주의**:
- `null, 2` — pretty-print (외부 편집 편의).
- 파일명 `basic-data-{year}.json` — 연도 명시.
- 데이터 없으면 버튼 disabled.
- BasicDataYear 전체 (updatedAt·updatedBy 포함) export.

#### 2. 테스트

**web `BasicDataPanel.test.tsx`** (1 신규 시나리오):
- data 렌더된 상태 → `basic-data-json-export-btn` 존재 + enabled.
- 빈 상태 (data.data null) → 버튼 disabled.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 594 + 신규 1 = 595 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 「JSON 내보내기」 버튼
   - 클릭 → `basic-data-{year}.json` 다운로드
   - 데이터 없으면 disabled
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **JSON import** — 별도 slice.
- **CSV 대체** — basic_data 는 nested 구조라 JSON 이 자연스러움.

### 커밋 규칙

**1 커밋**:
- `feat(web): BasicDataPanel JSON 내보내기 (백업 · 편집)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-json-export-v61`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
