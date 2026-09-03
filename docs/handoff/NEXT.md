# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **멤버 일괄 제거 v0.43** — MembersTable 체크박스 컬럼 + 선택 상태 + BulkRemoveMembersDialog. `callGroupsMembersDelete` 반복 호출.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/bulk-remove-members-v43`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `18d98fd` (일괄 삭제 v0.42)

## 지금 할 것 — MembersTable 일괄 제거

### 왜

v0.41·v0.42 로 Users 도메인 일괄 정지·삭제 완비. Groups 도메인 멤버 관리에서도 유사 시나리오: 「졸업생 30 명을 all-students@ 그룹에서 일괄 제거」. MembersTable 은 이미 검색·역할 필터·CSV 있음. 체크박스 + 일괄 제거만 추가하면 대칭 완성.

**하지 않는 것**: 멤버 일괄 역할 변경 (별도 slice). 멤버 일괄 이동 (그룹 A → 그룹 B) — 복잡한 UX, 별도. GroupsTable 일괄 삭제 — v0.44 후보.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/MembersTable.tsx` — 체크박스 컬럼 + selection state + 액션 바
- `packages/web/tests/MembersTable.test.tsx` — 시나리오 2 (체크박스 렌더 + 액션 바 표시)

**신규 파일**:
- `packages/web/src/routes/admin/BulkRemoveMembersDialog.tsx` — BulkDeleteDialog 패턴, callGroupsMembersDelete 사용
- `packages/web/tests/BulkRemoveMembersDialog.test.tsx` — 시나리오 3

**손대지 마라**:
- `useGroupMembersList` · `callGroupsMembersDelete` · `useRemoveMember` — 그대로.
- `RemoveMemberDialog` (개별) — 그대로.
- 백엔드 · middleware · audit.
- `AccountsTable` · `BulkSuspendDialog` · `BulkDeleteDialog` — 그대로 (참고만).

### 세부 요구

#### 1. `MembersTable.tsx` — 체크박스 컬럼 + 선택 상태

**state**:
```ts
const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
const [isBulkRemoveOpen, setIsBulkRemoveOpen] = useState(false);
```

**필터 변경 시 선택 초기화**:
```ts
useEffect(() => {
  setSelectedEmails(new Set());
}, [searchQuery, roleFilter]);
```
(기존 useState 옆에 추가 — `packages/web/src/routes/admin/MembersTable.tsx:26-27` 근처.)

**헤더 체크박스**:
- `checked = filteredMembers.length > 0 && filteredMembers.every((m) => selectedEmails.has(m.email))`
- `indeterminate = filteredMembers.some((m) => selectedEmails.has(m.email)) && !checked`
- onChange: 전체 선택/해제.

**행 체크박스**: 각 행 맨 앞에.

**액션 바 (선택 > 0)** — 기존 「상단 요약 + 액션」 (`packages/web/src/routes/admin/MembersTable.tsx:43-53`) 바로 아래 조건부:
```tsx
{selectedEmails.size > 0 && (
  <div
    className="flex items-center justify-between bg-surface border border-border-strong p-4"
    data-testid="members-bulk-action-bar"
  >
    <div className="text-small text-fg-primary">
      <strong className="font-mono">{selectedEmails.size}</strong>명 선택됨
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setSelectedEmails(new Set())}
        className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
        data-testid="members-bulk-clear-btn"
      >
        선택 해제
      </button>
      <Button
        variant="secondary"
        onClick={() => setIsBulkRemoveOpen(true)}
        data-testid="members-bulk-remove-btn"
        className="text-state-danger"
      >
        선택 제거
      </Button>
    </div>
  </div>
)}
```

**표 헤더/행 수정**: 기존 4 컬럼 (이메일·역할·타입·관리) 앞에 체크박스 컬럼 추가 → 5 컬럼.

**다이얼로그 렌더** (컴포넌트 맨 아래):
```tsx
<BulkRemoveMembersDialog
  open={isBulkRemoveOpen}
  onOpenChange={setIsBulkRemoveOpen}
  groupEmail={groupEmail}
  memberEmails={Array.from(selectedEmails)}
  onDone={() => setSelectedEmails(new Set())}
/>
```

**주의**:
- Users 도메인은 `isSelf` 방어 필요했지만 멤버는 사용자 이메일이 그룹에 속하는 관계 — self 방어 불필요 (본인이 그룹에서 스스로 빠지는 것은 정상 오퍼레이션이라 서버에서 방어 안 함).
- 그룹 상세 페이지 이동 시 MembersTable 이 새로 mount → selectedEmails 자연 초기화.

#### 2. `BulkRemoveMembersDialog.tsx` — 다이얼로그

`BulkDeleteDialog.tsx` (`packages/web/src/routes/admin/BulkDeleteDialog.tsx`) 참고. 다른 점:

**Props**:
```ts
export interface BulkRemoveMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupEmail: string;         // 그룹 이메일 (신규)
  memberEmails: string[];     // 제거 대상 멤버 이메일 (이전 emails)
  onDone?: () => void;
}
```

**API**: `callGroupsMembersDelete({ groupEmail, memberEmail })` — 두 필드 다 필요.

**iteration**:
```ts
for (let i = 0; i < memberEmails.length; i++) {
  const memberEmail = memberEmails[i];
  try {
    await callGroupsMembersDelete({ groupEmail, memberEmail });
  } catch (e) {
    localFailures.push({ email: memberEmail, message: (e as Error).message });
  }
  setProgress(i + 1);
}
```

**queryClient invalidation**:
```ts
queryClient.invalidateQueries({ queryKey: ['groups', 'members', groupEmail] });
queryClient.invalidateQueries({ queryKey: [`groups/members/${groupEmail}`] });
```
(useRemoveMember 이 이미 두 키 형태 사용 — 같은 방식 유지, `packages/web/src/api/groupsMembersDelete.ts:67-68`.)

**확인 문구**: 「제거 {count}」 (예: 「제거 3」).

**Title**:
```tsx
<DialogTitle className="text-state-danger">일괄 멤버 제거 확인</DialogTitle>
<DialogDescription>
  <span className="font-mono">{groupEmail}</span> 에서 {memberEmails.length}명 멤버를 제거합니다. 그룹 자체는 유지됩니다.
</DialogDescription>
```

**data-testid 접두사**: `bulk-remove-*`.

**나머지 phase 구조**: BulkDeleteDialog · BulkSuspendDialog 와 동일.

#### 3. 테스트

**web `MembersTable.test.tsx`** (2 신규):
1. 3 명 로드 → 3 개 체크박스 존재, 헤더 checkbox 존재.
2. 체크박스 하나 클릭 → `members-bulk-action-bar` 렌더, 「1명 선택됨」.

**web `BulkRemoveMembersDialog.test.tsx`** (3 신규):
1. **확인 요구**: memberEmails=[a,b,c] → `bulk-remove-confirm-btn` disabled, `confirmText="제거 3"` 후 enabled.
2. **성공 반복**: mock callGroupsMembersDelete resolves → done phase, failures 0.
3. **실패 반복**: mock 하나 reject → done phase, failures 배열.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 492 + 신규 5 = 497 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/groups/{email}` 멤버 표 최좌측 체크박스 컬럼
   - 선택 > 0 → 「선택 제거」 액션 바
   - 「선택 제거」 → 다이얼로그 → 「제거 N」 타이핑 → 실행
   - 완료 후 멤버 표 새로고침
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **멤버 역할 일괄 변경** — 별도 slice.
- **멤버 그룹 이동 (A → B)** — 복잡한 UX, 별도.
- **GroupsTable 일괄 삭제** — v0.44 후보.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): MembersTable 체크박스 컬럼 + 선택 상태 + 일괄 액션 바`
2. `feat(web): BulkRemoveMembersDialog (선택 멤버 반복 제거)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/bulk-remove-members-v43`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
