# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **일괄 정지 v0.41** — AccountsTable 체크박스 컬럼 + 선택 상태 + 일괄 정지 다이얼로그 (기존 `callUsersUpdate` 클라이언트 반복 호출). 새 callable 없음.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/bulk-suspend-v41`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `dac16a2` (감사 로그 actor 링크 v0.40)

## 지금 할 것 — 일괄 정지 (bulk suspend) 최초 슬라이스

### 왜

Users 도메인의 개별 정지 · 삭제 · 편집 · 비밀번호 재설정 은 완비 (v0.32 인라인 액션까지). 그러나 「학기 종료 후 20 명 일괄 정지」 같은 실무 시나리오에서 개별 클릭 20 회는 비효율. 백엔드는 이미 `users.write` (suspend) 을 지원 — 클라이언트에서 선택된 이메일들에 대해 `callUsersUpdate` 를 반복 호출하는 것으로 시작. 배치 API 는 별도 slice.

**하지 않는 것**:
- 일괄 삭제 (v0.42 후보 — 위험도 높음, 별도 확인 UX 필요).
- 서버 사이드 batch endpoint (지금 규모 문제 없음, 100 명 정도까진 클라이언트 반복 충분).
- 일괄 복구 (unsuspend) — 이번은 suspend 만.
- MembersTable · GroupsTable 체크박스 — 별도 slice.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — 체크박스 컬럼 + selection state + 일괄 액션 바 (선택 시 표시)
- `packages/web/tests/AccountsTable.test.tsx` — 시나리오 3 (체크박스 렌더 · 헤더 체크박스 · 액션 바 표시)

**신규 파일**:
- `packages/web/src/routes/admin/BulkSuspendDialog.tsx` — 다이얼로그 + 반복 호출 + 진행/결과
- `packages/web/tests/BulkSuspendDialog.test.tsx` — 시나리오 3 (확인 요구, 성공 반복, 실패 반복)

**손대지 마라**:
- `callUsersUpdate` · `useUpdateUser` hook — 그대로 (다이얼로그가 `callUsersUpdate` 직접 사용).
- 백엔드 · middleware · audit — 그대로.
- GroupsTable · MembersTable — 그대로.

### 세부 요구

#### 1. `AccountsTable.tsx` — 체크박스 컬럼 + 선택 상태

**state 추가**:
```ts
const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
const [isBulkSuspendOpen, setIsBulkSuspendOpen] = useState(false);
```

**검색·필터 변경 시 선택 초기화**:
```ts
useEffect(() => {
  setSelectedEmails(new Set());
}, [searchQuery, kpiFilter, sortColumn, sortDirection]);
```
(기존 setPage useEffect 옆에 추가.)

**self 이메일 제외 헬퍼**:
```ts
const isSelf = (email: string) =>
  Boolean(currentUser?.email) && currentUser!.email!.toLowerCase() === email.toLowerCase();

const eligibleEmails = paginatedUsers
  .filter((u) => !isSelf(u.email))
  .map((u) => u.email);
```

**헤더 체크박스 (전체 선택)**:
- 현재 페이지 내 non-self 사용자만 선택 대상.
- state:
  - `checked = eligibleEmails.length > 0 && eligibleEmails.every((e) => selectedEmails.has(e))`
  - `indeterminate = eligibleEmails.some((e) => selectedEmails.has(e)) && !checked`

**액션 바 (선택 > 0)**:
```tsx
{selectedEmails.size > 0 && (
  <div
    className="flex items-center justify-between bg-surface border border-border-strong p-4"
    data-testid="bulk-action-bar"
  >
    <div className="text-small text-fg-primary">
      <strong className="font-mono">{selectedEmails.size}</strong>명 선택됨
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setSelectedEmails(new Set())}
        className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
        data-testid="bulk-clear-btn"
      >
        선택 해제
      </button>
      <Button
        variant="secondary"
        onClick={() => setIsBulkSuspendOpen(true)}
        data-testid="bulk-suspend-btn"
      >
        선택 정지
      </Button>
    </div>
  </div>
)}
```

**체크박스 컬럼**:
- 표 헤더 맨 앞에 `<TableHead className="w-10"><input type="checkbox" .../></TableHead>` 추가.
- 각 행 맨 앞에 셀 (self 는 `disabled`).

```tsx
<TableCell className="w-10">
  <input
    type="checkbox"
    checked={selectedEmails.has(user.email)}
    disabled={isSelf(user.email)}
    onChange={(e) => {
      const next = new Set(selectedEmails);
      if (e.target.checked) next.add(user.email);
      else next.delete(user.email);
      setSelectedEmails(next);
    }}
    aria-label={`${user.email} 선택`}
    data-testid={`bulk-check-${user.email}`}
    className="cursor-pointer disabled:cursor-not-allowed"
  />
</TableCell>
```

**다이얼로그 렌더** (컴포넌트 맨 아래):
```tsx
<BulkSuspendDialog
  open={isBulkSuspendOpen}
  onOpenChange={setIsBulkSuspendOpen}
  emails={Array.from(selectedEmails)}
  onDone={() => setSelectedEmails(new Set())}
/>
```

**주의**:
- 페이지네이션·검색·필터 변경 시 선택 초기화 (혼란 방지).
- self 는 체크박스 disabled + 헤더 전체 선택에서 제외.
- 선택 상태는 페이지 이동 시 유지 안 함 (선택 후 다음 페이지 이동 → 선택 유지되면 UX 애매). 이번 슬라이스는 클리어.

#### 2. `BulkSuspendDialog.tsx` — 다이얼로그 + 반복 호출

**Props**:
```ts
export interface BulkSuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emails: string[];   // 정지 대상 이메일 배열
  onDone?: () => void; // 완료 후 선택 해제 콜백
}
```

**state**:
```ts
type Phase = 'confirm' | 'running' | 'done';
const [phase, setPhase] = useState<Phase>('confirm');
const [progress, setProgress] = useState(0);
const [failures, setFailures] = useState<{email: string; message: string}[]>([]);
const [confirmText, setConfirmText] = useState('');
```

`open` 이 false → true 로 변할 때 state 초기화:
```ts
useEffect(() => {
  if (open) {
    setPhase('confirm');
    setProgress(0);
    setFailures([]);
    setConfirmText('');
  }
}, [open]);
```

**iteration 로직**:
```ts
const handleConfirm = async () => {
  setPhase('running');
  const localFailures: { email: string; message: string }[] = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    try {
      await callUsersUpdate({ primaryEmail: email, suspended: true });
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

**UI (phase 별)**:

- `confirm`:
  ```tsx
  <DialogHeader>
    <DialogTitle>일괄 정지 확인</DialogTitle>
    <DialogDescription>
      선택한 {emails.length}명 계정을 정지합니다. 되돌리려면 개별 「복구」 필요.
    </DialogDescription>
  </DialogHeader>
  <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
    {emails.slice(0, 5).map((e) => <li key={e} className="font-mono">{e}</li>)}
    {emails.length > 5 && <li className="text-fg-muted">... 외 {emails.length - 5}명</li>}
  </ul>
  <div>
    <label className="text-small text-fg-primary">
      확인을 위해 대상 개수 (<strong>{emails.length}</strong>)를 입력하세요:
    </label>
    <input
      type="text"
      value={confirmText}
      onChange={(e) => setConfirmText(e.target.value)}
      data-testid="bulk-suspend-confirm-input"
    />
  </div>
  <DialogFooter>
    <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
    <Button
      onClick={handleConfirm}
      disabled={confirmText.trim() !== String(emails.length)}
      data-testid="bulk-suspend-confirm-btn"
    >정지 실행</Button>
  </DialogFooter>
  ```

- `running`:
  ```tsx
  <div className="py-8 text-center space-y-3" data-testid="bulk-suspend-running">
    <div className="text-body text-fg-primary">
      진행 중: <strong className="font-mono">{progress}</strong> / <strong className="font-mono">{emails.length}</strong>
    </div>
    <div className="w-full bg-canvas h-2 border border-border-subtle">
      <div
        className="bg-fg-primary h-full transition-all"
        style={{ width: `${(progress / emails.length) * 100}%` }}
      />
    </div>
  </div>
  ```

- `done`:
  ```tsx
  <div data-testid="bulk-suspend-done" className="space-y-3">
    <p className="text-body text-fg-primary">
      완료: <strong className="text-state-success font-mono">{emails.length - failures.length}</strong>명 성공
      {failures.length > 0 && (
        <> · <strong className="text-state-danger font-mono">{failures.length}</strong>명 실패</>
      )}
    </p>
    {failures.length > 0 && (
      <ul className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto" data-testid="bulk-suspend-failures">
        {failures.map((f) => (
          <li key={f.email}>
            <span className="font-mono">{f.email}</span>: {f.message}
          </li>
        ))}
      </ul>
    )}
    <DialogFooter>
      <Button onClick={() => { onOpenChange(false); onDone?.(); }}>확인</Button>
    </DialogFooter>
  </div>
  ```

**주의**:
- `callUsersUpdate` 는 이미 audit_log 를 서버 사이드에서 기록 → 별도 처리 불필요.
- `admin_cannot_edit_admin` 등 서버 오류는 실패 목록에 그대로 표시 (message 필드 사용). 사용자가 이해할 수 있는 원문 그대로.
- iteration 중 close 못 하게 (running phase 는 취소 버튼 없음).

#### 3. 테스트

**web `AccountsTable.test.tsx`** (3 신규):
1. **체크박스 렌더**: 3 명 로드 (1 명은 self) → 3 개 checkbox, self 는 disabled.
2. **헤더 전체 선택**: 헤더 checkbox 클릭 → 2 명 (non-self) 선택됨.
3. **액션 바 표시**: 선택 > 0 → `bulk-action-bar` 렌더, 선택 = 0 → 안 렌더.

**web `BulkSuspendDialog.test.tsx`** (3 신규):
1. **확인 요구**: emails=[a,b,c] → `bulk-suspend-confirm-btn` disabled, `confirmText="3"` 입력 후 enabled.
2. **성공 반복**: mock callUsersUpdate resolves all → `done` phase, `emails.length - failures.length = emails.length`.
3. **실패 반복**: mock 하나만 reject → `done` phase, `failures` 배열에 그 이메일 + message.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 482 + 신규 6 = 488 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` 표 최좌측 체크박스 컬럼, self 는 disabled
   - 헤더 checkbox → 현재 페이지 non-self 전체 토글
   - 선택 > 0 → 「N명 선택됨 · 선택 해제 · 선택 정지」 바 상단
   - 「선택 정지」 → 다이얼로그 → 개수 입력 → 실행 → 진행 바 → 결과 요약
   - 완료 후 목록 새로고침 (정지된 계정 「정지됨」 상태 변경)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **일괄 삭제** — v0.42 후보 (별도 확인 UX 필요).
- **일괄 복구 (unsuspend)** — 별도 slice.
- **서버 batch endpoint** — 지금 규모 (수십 명) 는 클라이언트 반복 충분.
- **iteration 중 dialog close 강제** — 이번 슬라이스는 취소 버튼 안 노출 (완료까지 대기 UX).
- **선택 상태 페이지네이션 유지** — 지금은 페이지·검색·필터 변경 시 초기화.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): AccountsTable 체크박스 컬럼 + 선택 상태 + 일괄 액션 바`
2. `feat(web): BulkSuspendDialog (선택 사용자 반복 정지 · 진행 · 결과 요약)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/bulk-suspend-v41`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
