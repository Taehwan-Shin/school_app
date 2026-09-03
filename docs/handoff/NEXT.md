# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **일괄 조직 단위 이동 v0.44** — AccountsTable 액션 바에 「선택 조직 이동」 버튼 + BulkMoveOuDialog. `callUsersUpdate({orgUnitPath})` 반복 호출.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/bulk-move-ou-v44`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `353786e` (멤버 일괄 제거 v0.43)

## 지금 할 것 — 선택 사용자 조직 단위 일괄 이동

### 왜

v0.41·v0.42 로 Users 일괄 정지·삭제 완비. 학기말 실무에서 「졸업생 25 명을 `/12-A` 에서 `/graduated/2026` 로 일괄 이동」 시나리오 흔함. 개별 편집 25 회 vs 일괄 이동 1 회. `callUsersUpdate({primaryEmail, orgUnitPath})` 이 이미 orgUnitPath 만 부분 업데이트 지원 — 반복 호출로 시작.

**하지 않는 것**: OU tree picker (드롭다운·자동완성) — 별도 slice. 하위 그룹 자동 이동 (OU 만 옮기고 그룹 멤버십은 유지). GroupsTable 일괄 삭제 (위험도 재고 필요 · 별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — 액션 바에 「선택 조직 이동」 버튼 + BulkMoveOuDialog state·렌더
- `packages/web/tests/AccountsTable.test.tsx` — 「선택 조직 이동」 버튼 시나리오 1

**신규 파일**:
- `packages/web/src/routes/admin/BulkMoveOuDialog.tsx` — 확인 다이얼로그 + 대상 OU 입력 + 반복 호출
- `packages/web/tests/BulkMoveOuDialog.test.tsx` — 시나리오 3

**손대지 마라**:
- BulkSuspendDialog · BulkDeleteDialog — 그대로 (참고만).
- callUsersUpdate · useUpdateUser — 그대로.
- 백엔드 · middleware · audit.

### 세부 요구

#### 1. `BulkMoveOuDialog.tsx` — 다이얼로그

BulkSuspendDialog · BulkDeleteDialog 를 참고. 다른 점:

**Props**:
```ts
export interface BulkMoveOuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];
  onDone?: () => void;
}
```

**추가 state**:
```ts
const [targetOu, setTargetOu] = useState('');
```

`open` 이 false → true 시 리셋 (기존 useEffect):
```ts
useEffect(() => {
  if (open) {
    setPhase('confirm');
    setProgress(0);
    setFailures([]);
    setTargetOu('');
  }
}, [open]);
```

**iteration** (핵심):
```ts
const handleConfirm = async () => {
  const trimmed = targetOu.trim();
  if (!trimmed) return;
  setPhase('running');
  const localFailures: { email: string; message: string }[] = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    try {
      await callUsersUpdate({ primaryEmail: email, orgUnitPath: trimmed });
    } catch (e) {
      localFailures.push({ email, message: (e as Error).message });
    }
    setProgress(i + 1);
  }
  setFailures(localFailures);
  setPhase('done');
  queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
};
```

**UI — confirm phase**:
```tsx
<DialogHeader>
  <DialogTitle>일괄 조직 이동 확인</DialogTitle>
  <DialogDescription>
    선택한 {emails.length}명 계정의 조직 단위 (orgUnitPath) 를 아래 값으로 이동합니다.
  </DialogDescription>
</DialogHeader>
<ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
  {emails.slice(0, 5).map((e) => <li key={e} className="font-mono">{e}</li>)}
  {emails.length > 5 && <li className="text-fg-muted">... 외 {emails.length - 5}명</li>}
</ul>
<div>
  <label className="text-small text-fg-primary">
    대상 조직 단위 경로:
  </label>
  <input
    type="text"
    value={targetOu}
    onChange={(e) => setTargetOu(e.target.value)}
    placeholder="/graduated/2026"
    data-testid="bulk-move-ou-input"
    className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
  />
  <p className="text-micro text-fg-muted mt-1">예: /students/12, /graduated/2026, / (루트)</p>
</div>
<DialogFooter>
  <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
  <Button
    onClick={handleConfirm}
    disabled={targetOu.trim() === ''}
    data-testid="bulk-move-ou-confirm-btn"
  >
    이동 실행
  </Button>
</DialogFooter>
```

**주의**:
- 검증 최소 (trim 후 non-empty). 서버가 실 검증 (`admin.directory.user` 스코프, OU 존재 여부 등) — 실패 시 실패 목록에 표시.
- 「/」 로 시작 안 하는 값도 사용자 실수로 서버가 reject → 에러 표시로 학습.
- BulkSuspendDialog 처럼 확인 개수 입력 없음 (조작 대상 목록 미리보기 + 대상 OU 입력만으로 확인 충분).

**나머지 phase (running · done)**: BulkSuspendDialog 와 동일 (data-testid 접두사 `bulk-move-ou-*`).

#### 2. `AccountsTable.tsx` — 「선택 조직 이동」 버튼

액션 바 안에 기존 「선택 정지 · 선택 삭제」 옆:

```tsx
<Button
  variant="secondary"
  onClick={() => setIsBulkMoveOuOpen(true)}
  data-testid="bulk-move-ou-btn"
>
  선택 조직 이동
</Button>
```

**state**: `const [isBulkMoveOuOpen, setIsBulkMoveOuOpen] = useState(false);`

**다이얼로그 렌더**:
```tsx
<BulkMoveOuDialog
  open={isBulkMoveOuOpen}
  onOpenChange={setIsBulkMoveOuOpen}
  emails={Array.from(selectedEmails)}
  onDone={() => setSelectedEmails(new Set())}
/>
```

**위치**: 「선택 정지」 왼쪽 (덜 위험 → 더 위험 순: 「조직 이동 · 정지 · 삭제」).

#### 3. 테스트

**web `BulkMoveOuDialog.test.tsx`** (3 신규):
1. **입력 요구**: emails=[a,b] → `bulk-move-ou-confirm-btn` disabled, `targetOu="/graduated/2026"` 후 enabled.
2. **성공 반복**: mock callUsersUpdate resolves → done phase, failures 0. 각 호출에 `orgUnitPath='/graduated/2026'` 전달됨.
3. **실패 반복**: mock 하나 reject → done phase, failures 배열에 원문.

**web `AccountsTable.test.tsx`** (1 회귀):
- 선택 > 0 → `bulk-move-ou-btn` 존재 확인.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 497 + 신규 4 = 501 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` 선택 > 0 → 액션 바 「조직 이동 · 정지 · 삭제」 세 버튼
   - 「선택 조직 이동」 → 다이얼로그 → OU 경로 입력 → 실행
   - 완료 후 목록 새로고침 (orgUnitPath 반영)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **OU tree picker** — 별도 slice.
- **하위 그룹 자동 동기화** — 그룹 멤버십은 별도 관리, 이 슬라이스 밖.
- **GroupsTable 일괄 삭제** — 위험도 재고 필요 · 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): BulkMoveOuDialog + AccountsTable 「선택 조직 이동」 버튼`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/bulk-move-ou-v44`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
