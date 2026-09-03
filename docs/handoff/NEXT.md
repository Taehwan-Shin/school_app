# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **일괄 삭제 v0.42** — BulkSuspendDialog 대칭. AccountsTable 액션 바에 「선택 삭제」 버튼 + BulkDeleteDialog. `callUsersDelete` 반복 호출. 확인 강화 (`삭제 {count}` 문구 타이핑).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/bulk-delete-v42`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `596bd54` (일괄 정지 v0.41)

## 지금 할 것 — 일괄 삭제 (bulk delete)

### 왜

v0.41 로 일괄 정지 완비. 삭제는 정지보다 훨씬 위험 (되돌릴 수 없음, Google Workspace 실 삭제) — UX 확인 강화 필요. 백엔드는 이미 `users.delete` (`cannot_delete_self`, `admin_cannot_delete_admin` 방어) 완비. 클라이언트 반복 호출 패턴은 v0.41 그대로 재활용.

**하지 않는 것**: 백엔드 batch endpoint (지금 규모 충분). Undo (Google Workspace 20 일 복구 창이 있지만 그건 워크스페이스 관리자가 별도 처리). MembersTable / GroupsTable 일괄 삭제 — 별도 slice.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AccountsTable.tsx` — 액션 바에 「선택 삭제」 버튼 + BulkDeleteDialog 상태·렌더
- `packages/web/tests/AccountsTable.test.tsx` — 「선택 삭제」 버튼 렌더 시나리오 1

**신규 파일**:
- `packages/web/src/routes/admin/BulkDeleteDialog.tsx` — BulkSuspendDialog 패턴 그대로, callUsersDelete 사용, 확인 문구 강화
- `packages/web/tests/BulkDeleteDialog.test.tsx` — 시나리오 3 (확인 문구, 성공 반복, 실패 반복)

**손대지 마라**:
- `BulkSuspendDialog` — 그대로 (복제 대신 참고만).
- `callUsersDelete` · `useDeleteUser` — 그대로.
- 백엔드 · middleware · audit.
- 개별 DeleteUserDialog — 그대로.

### 세부 요구

#### 1. `BulkDeleteDialog.tsx` — BulkSuspendDialog 대칭

`BulkSuspendDialog.tsx` (`packages/web/src/routes/admin/BulkSuspendDialog.tsx`) 를 참고. 다른 점:

**API**: `callUsersDelete({ primaryEmail })` (아니라 update).

**확인 문구 강화**:
```ts
const requiredPhrase = `삭제 ${emails.length}`;
```
사용자 입력이 정확히 이 문구와 일치해야 「삭제 실행」 버튼 활성:
```tsx
<Button
  onClick={handleConfirm}
  disabled={confirmText.trim() !== requiredPhrase}
  variant="danger"   // BulkSuspendDialog 는 기본, 여기는 danger
  data-testid="bulk-delete-confirm-btn"
>
  삭제 실행
</Button>
```

*(만약 `variant="danger"` 가 Button 컴포넌트에 없으면 기본으로 유지 + className 으로 위험 색상 추가 — `packages/web/src/components/ui/button.tsx` 확인 후 실 지원 variant 사용.)*

**Title/Description**:
```tsx
<DialogTitle className="text-state-danger">일괄 삭제 확인</DialogTitle>
<DialogDescription>
  선택한 {emails.length}명 계정을 Google Workspace 에서 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.
</DialogDescription>
```

**확인 라벨**:
```tsx
<label className="text-small text-fg-primary">
  실행하려면 아래 문구를 정확히 입력하세요: <strong className="font-mono">{requiredPhrase}</strong>
</label>
```

**data-testid 접두사**: `bulk-delete-*` (bulk-suspend 와 구분).

**나머지 (phase state, running 진행 바, done 요약)**: BulkSuspendDialog 와 동일 패턴. queryClient key 도 `["users", "list"]` 그대로.

#### 2. `AccountsTable.tsx` — 「선택 삭제」 버튼

`selectedEmails.size > 0` 액션 바 (`bulk-action-bar`) 안에 기존 「선택 정지」 버튼 옆에:

```tsx
<Button
  variant="secondary"
  onClick={() => setIsBulkDeleteOpen(true)}
  data-testid="bulk-delete-btn"
  className="text-state-danger"   // 위험 표시 (또는 variant="danger" 있으면 그것)
>
  선택 삭제
</Button>
```

**state**: `const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);`

**다이얼로그 렌더**: BulkSuspendDialog 옆:
```tsx
<BulkDeleteDialog
  open={isBulkDeleteOpen}
  onOpenChange={setIsBulkDeleteOpen}
  emails={Array.from(selectedEmails)}
  onDone={() => setSelectedEmails(new Set())}
/>
```

**주의**:
- 「선택 삭제」 를 「선택 정지」 오른쪽에 배치 — 시각적 흐름 (덜 위험 → 더 위험).
- `variant="danger"` 지원 여부 확인 후 사용. 없으면 `className` 로 색상만.

#### 3. 테스트

**web `BulkDeleteDialog.test.tsx`** (3 신규 시나리오):

1. **확인 문구 요구**: emails=[a,b,c] → `bulk-delete-confirm-btn` disabled. `confirmText="삭제 3"` 입력 후 enabled.
2. **성공 반복**: mock `callUsersDelete` all resolve → done phase, `failures.length === 0`.
3. **실패 반복**: mock 하나만 reject (예: `admin_cannot_delete_admin`) → done phase, `failures` 배열에 그 이메일.

**web `AccountsTable.test.tsx`** (1 회귀 시나리오):
- 선택 > 0 → `bulk-delete-btn` 존재 확인 (기존 `bulk-suspend-btn` 옆).

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 488 + 신규 4 = 492 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` 선택 > 0 → 액션 바에 「선택 정지 · 선택 삭제」 두 버튼
   - 「선택 삭제」 → 다이얼로그 (빨간 헤더) → 「삭제 N」 문구 정확히 타이핑 → 실행
   - 진행 바 → 결과 요약 (성공/실패)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **일괄 복구 (unsuspend)** — 별도 slice.
- **일괄 편집 (orgUnitPath 변경 등)** — 별도 slice.
- **Google Workspace 20 일 삭제 복구창** — 워크스페이스 관리자 콘솔에서 별도 처리 (앱 범위 밖).

### 커밋 규칙

**1 커밋**:
- `feat(web): BulkDeleteDialog + AccountsTable 액션 바 「선택 삭제」 버튼`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/bulk-delete-v42`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
