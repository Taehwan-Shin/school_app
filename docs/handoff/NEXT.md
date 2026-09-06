# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex 감사 hotfix v0.68** — P2 슬러그 충돌 (AutoCreate·AutoInvite) + P4 bulk done phase close race (4 다이얼로그). 2 commits.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/codex-audit-p2-p4-v68`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `57ea662` (CI lockfile fix) — v0.67 병합 후

## 지금 할 것 — P2 + P4 hotfix

### 왜

Codex 감사 (2026-09-06 basic_data + bulk 도메인) 실패 2건:

**P2 슬러그 충돌** (`packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx:27` · `packages/web/src/routes/admin/AutoInviteStudentsDialog.tsx:25`):
> 반 문자열을 영숫자 외 전부 제거한 뒤 생성 이메일의 유일성을 검증하지 않아 `A`/`A!`, 또는 서로 다른 한글 반 이름이 같은 그룹 주소로 충돌하며, 통합 초대는 서로 다른 반 학생을 같은 그룹에 넣을 수 있다.

**P4 bulk done close race** (`packages/web/src/routes/admin/BulkDeleteDialog.tsx:46` · BulkSuspendDialog · BulkMoveOuDialog · BulkRemoveMembersDialog):
> done 단계에서 X/Escape/바깥 클릭으로 닫으면 `onOpenChange` 만 호출되고 line 180 의 `onDone` 은 「확인」 버튼에서만 실행되어 AccountsTable:566 의 선택 Set 이 남는다.

**하지 않는 것**: shared validator 강화 (P3 는 v0.69). super_admin 24h KPI (P5·P6 는 v0.69). 공통 phase-dialog 헬퍼 추상화.

### 이 과제가 바꿀 경로

**Commit 1 (P4 bulk done close)**:
- `packages/web/src/routes/admin/BulkSuspendDialog.tsx` — handleOpenChange 확장
- `packages/web/src/routes/admin/BulkDeleteDialog.tsx` — 동일
- `packages/web/src/routes/admin/BulkMoveOuDialog.tsx` — 동일
- `packages/web/src/routes/admin/BulkRemoveMembersDialog.tsx` — 동일
- 각 다이얼로그 테스트 파일 — 시나리오 1 (done 단계 X/Escape → onDone 호출됨)

**Commit 2 (P2 슬러그 충돌 감지)**:
- `packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx` — preview 에 중복 감지 · confirm 차단 + 오류 메시지
- `packages/web/src/routes/admin/AutoInviteStudentsDialog.tsx` — 동일
- 각 다이얼로그 테스트 파일 — 시나리오 1 (충돌 발생 시 confirm disabled)

**손대지 마라**:
- shared basicData.ts validator (v0.69 별도).
- super_admin index.tsx · AuditLogTable.tsx preset (v0.69 별도).
- 다른 다이얼로그 · 백엔드 · Firestore.

### 세부 요구

#### Commit 1: P4 bulk done close race

**대상 4 다이얼로그 · 공통 패턴** (각 파일 handleOpenChange 확장):

기존 (`BulkSuspendDialog.tsx:44-47` 유사):
```ts
const handleOpenChange = (newOpen: boolean) => {
  if (phase === 'running') return;
  onOpenChange(newOpen);
};
```

변경:
```ts
const handleOpenChange = (newOpen: boolean) => {
  if (phase === 'running') return;
  if (!newOpen && phase === 'done') {
    onDone?.();
  }
  onOpenChange(newOpen);
};
```

**주의**:
- `onDone` prop 이 optional 인 다이얼로그 (BulkSuspendDialog · BulkDeleteDialog · BulkMoveOuDialog · BulkRemoveMembersDialog) 는 이미 존재.
- done 단계 「확인」 버튼 로직 은 그대로 (이미 `onOpenChange(false); onDone?.();` 순서).
- 이 wrapper 는 「확인」 버튼과 중복이 아님 — 「확인」 버튼은 `onOpenChange(false)` 를 직접 호출하는데, 그 값이 `handleOpenChange(false)` 로 들어와 done 검사 후 `onDone` 실행 → 그 후 최종 `onOpenChange(false)` — 결과적으로 onDone 두 번 호출될 수 있음!

**중복 호출 방지** 필요. 두 옵션:
- (A) 「확인」 버튼에서 `onDone?.()` 제거하고 `onOpenChange(false)` 만 호출 → wrapper 가 알아서 호출
- (B) wrapper 에서 이미 done phase 였고 「확인」 버튼 아니라면 만 호출 (판정 어려움)

**옵션 (A) 선택** — 각 다이얼로그의 done phase 「확인」 버튼 :

기존:
```tsx
<Button
  onClick={() => {
    onOpenChange(false);
    onDone?.();
  }}
>
```

변경:
```tsx
<Button
  onClick={() => onOpenChange(false)}
>
```

이제 「확인」 버튼도 handleOpenChange → wrapper → `if (!newOpen && phase === 'done') onDone?.()` 통해 onDone 호출됨. 일관성.

#### Commit 1 테스트

각 4 다이얼로그 테스트 (BulkSuspend · BulkDelete · BulkMoveOu · BulkRemoveMembers) 에 1 시나리오씩 신규:
- done phase 진입 → `handleOpenChange(false)` (Escape/X 시뮬레이션) → `onDone` mock 호출 확인.

기존 「확인」 버튼 클릭 시나리오도 여전히 통과 (같은 경로).

#### Commit 2: P2 슬러그 충돌 감지

**AutoCreateGroupsDialog** (`packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx`):

`targets` useMemo 결과 후 중복 감지:
```ts
const emailCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  for (const t of targets) {
    counts[t.email] = (counts[t.email] ?? 0) + 1;
  }
  return counts;
}, [targets]);

const duplicateEmails = useMemo(
  () => Object.entries(emailCounts).filter(([_, c]) => c > 1).map(([e]) => e),
  [emailCounts]
);
const hasDuplicates = duplicateEmails.length > 0;
```

**confirm 버튼 disabled 조건 확장**:
```tsx
disabled={
  confirmText.trim() !== String(targets.length) ||
  targets.length === 0 ||
  !/^[a-z0-9-]+$/.test(prefix) ||
  hasDuplicates
}
```

**UI 오류 표시** (preview 아래):
```tsx
{hasDuplicates && (
  <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="auto-create-groups-duplicate-error">
    다음 이메일이 중복됩니다 ({duplicateEmails.length}건): {duplicateEmails.slice(0, 3).join(', ')}
    {duplicateEmails.length > 3 && ` 외 ${duplicateEmails.length - 3}`}. 반 이름을 구분되게 조정하세요.
  </div>
)}
```

**AutoInviteStudentsDialog** (`packages/web/src/routes/admin/AutoInviteStudentsDialog.tsx`):

`targets` 에서 groupEmail 이 중복될 경우, **서로 다른 (grade, class) 조합이 같은 그룹으로 매핑됨** 을 의미. 별도로 감지:
```ts
const emailToClass = new Map<string, Set<string>>();
for (const t of targets) {
  const key = `${t.grade}-${t.class}`;
  if (!emailToClass.has(t.groupEmail)) emailToClass.set(t.groupEmail, new Set());
  emailToClass.get(t.groupEmail)!.add(key);
}
const ambiguousEmails = Array.from(emailToClass.entries())
  .filter(([_, keys]) => keys.size > 1)
  .map(([e]) => e);
const hasAmbiguity = ambiguousEmails.length > 0;
```

**confirm disabled + UI 오류** — AutoCreate 와 동일 패턴. testid: `auto-invite-students-ambiguous-error`.

#### Commit 2 테스트

**AutoCreateGroupsDialog** 시나리오 1:
- grades = `[{grade: 1, classes: ['A', 'A!']}]` → 두 반 email 모두 `class-1a@` → `auto-create-groups-duplicate-error` 렌더 + confirm disabled.

**AutoInviteStudentsDialog** 시나리오 1:
- grades = `[{grade: 1, classes: ['A', 'A!']}]` + rosters 로 두 반 각 학생 1 명 → 같은 groupEmail 로 매핑 → `auto-invite-students-ambiguous-error` 렌더 + confirm disabled.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install --no-frozen-lockfile` 필요 없음 (v0.67 이후 lockfile 정상). `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 604 + 신규 6 = 610 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 4 bulk 다이얼로그 done 단계 Escape → 선택 자동 해제
   - AutoCreateGroups 반 이름 'A' + 'A!' → 중복 오류 표시 + 실행 차단
   - AutoInviteStudents 동일
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **shared validator 강화 (P3)** — v0.69 별도.
- **super_admin 24h KPI · 감사 프리셋 (P5·P6)** — v0.69 별도.
- **onDone 두 번 호출 되지 않도록 보장** — 「확인」 버튼 로직 변경 (options A) 로 wrapper 로 일원화.

### 커밋 규칙

**2 커밋 분리**:
1. `fix(web): 4 bulk 다이얼로그 done phase close 시 onDone 호출 (Codex 감사 · 선택 잔류)`
2. `fix(web): AutoCreateGroups · AutoInviteStudents 반 이름 슬러그 충돌 감지 (Codex 감사)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/codex-audit-p2-p4-v68`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
