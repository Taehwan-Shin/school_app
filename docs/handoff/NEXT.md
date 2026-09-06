# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **AutoCreateDepartmentGroups 개수 확인 v0.63** — v0.62 대칭. 실행 전 대상 부서 수 확인.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/dept-groups-confirm-count-v63`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `4d7f353` (AutoInviteStudents 개수 확인 v0.62)

## 지금 할 것 — AutoCreateDepartmentGroups confirm-count

### 왜

v0.62 로 AutoInviteStudents 에 confirm-count 완비. AutoCreateDepartmentGroupsDialog 는 아직 없음 (`packages/web/src/routes/admin/AutoCreateDepartmentGroupsDialog.tsx:250` 근처 confirm 버튼 · confirmText 없음). AutoCreateGroups · BulkSuspend · BulkDelete · AutoInviteStudents 모두 있음. 대칭 완성.

**하지 않는 것**: 다른 폴리시 (부서 순서 · 다중 선택 등).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AutoCreateDepartmentGroupsDialog.tsx` — confirmText state + input + disabled 조건 확장
- `packages/web/tests/AutoCreateDepartmentGroupsDialog.test.tsx` — 시나리오 1 (기존 성공/실패 회귀 조정 포함)

**손대지 마라**:
- 백엔드 · 다른 다이얼로그.

### 세부 요구

#### 1. state · UI · disabled 조건

**state 추가**:
```ts
const [confirmText, setConfirmText] = useState('');
```

**open 초기화** (기존 useEffect 안):
```ts
setConfirmText('');
```

**UI 추가** — preview 테이블 아래, DialogFooter 위:
```tsx
<div>
  <label className="text-small text-fg-primary">
    확인을 위해 대상 부서 수 (<strong>{departments.length}</strong>)를 입력하세요:
  </label>
  <input
    type="text"
    value={confirmText}
    onChange={(e) => setConfirmText(e.target.value)}
    data-testid="auto-create-dept-groups-confirm-input"
    className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
  />
</div>
```

**confirm 버튼 disabled 조건 확장** (기존 canConfirm 에 추가):
```tsx
disabled={!canConfirm || confirmText.trim() !== String(departments.length)}
```

또는 canConfirm 계산 자체에 포함:
```ts
const canConfirm =
  allValid &&
  noDuplicates &&
  preview.length > 0 &&
  confirmText.trim() === String(departments.length);
```

두 방법 중 하나 선택 — canConfirm 통합이 클린.

#### 2. 테스트

**web `AutoCreateDepartmentGroupsDialog.test.tsx`** (1 신규 시나리오):
- departments=['국어과','수학과'] 렌더 → confirm 버튼 disabled.
- confirmText = '2' 입력 후 enabled.

**기존 시나리오 조정** — 성공/skip/실패 시나리오 는 confirm 클릭 전에 confirmText 입력 필요 (신규 조건).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 596 + 신규 1 = 597 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 부서 그룹 자동 생성 다이얼로그에 confirm-count input
   - 개수 불일치 → disabled
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **부서 순서 편집** — 별도 slice.
- **다중 부서 선택** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateDepartmentGroupsDialog 개수 확인 input (실수 방지 폴리시)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/dept-groups-confirm-count-v63`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
