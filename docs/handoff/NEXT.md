# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **AutoInviteStudents 개수 확인 v0.62** — 초대 실행 전 총 학생 수 입력 확인 (실수 방지 폴리시).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-invite-confirm-count-v62`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `6268134` (basic_data JSON 내보내기 v0.61)

## 지금 할 것 — AutoInviteStudents confirm-count

### 왜

v0.58 로 학생 자동 초대 완비. 실행 시 개수 확인 없음 → admin 실수 방지 미흡. AutoCreateGroups · BulkSuspend · BulkDelete 는 이미 count 입력 확인 있음 (동일 패턴). 대칭 완성.

**하지 않는 것**: 다른 폴리시 (개별 학생 선택 · 프리뷰 편집).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AutoInviteStudentsDialog.tsx` — confirm-count input + confirm disabled 조건 확장
- `packages/web/tests/AutoInviteStudentsDialog.test.tsx` — 시나리오 1

**손대지 마라**:
- 백엔드 · 다른 다이얼로그.

### 세부 요구

#### 1. state 확장

```ts
const [confirmText, setConfirmText] = useState('');
```

**open 초기화**:
```ts
useEffect(() => {
  if (open) {
    // 기존 초기화 +
    setConfirmText('');
  }
}, [open]);
```

#### 2. UI 확장

기존 targets 미리보기 아래, DialogFooter 위에 추가:
```tsx
<div>
  <label className="text-small text-fg-primary">
    확인을 위해 대상 학생 수 (<strong>{targets.length}</strong>)를 입력하세요:
  </label>
  <input
    type="text"
    value={confirmText}
    onChange={(e) => setConfirmText(e.target.value)}
    data-testid="auto-invite-students-confirm-input"
    className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong mt-2"
  />
</div>
```

#### 3. confirm 버튼 disabled 조건

기존 조건에 추가:
```tsx
disabled={
  targets.length === 0 ||
  !/^[a-z0-9-]+$/.test(prefix) ||
  confirmText.trim() !== String(targets.length)
}
```

#### 4. 테스트

**web `AutoInviteStudentsDialog.test.tsx`** (1 신규):
- targets 렌더된 상태 → confirm-btn disabled.
- `confirmText = String(targets.length)` 입력 후 enabled.

기존 시나리오 회귀 유지 — 특히 성공/skip 시나리오 (기존 테스트에 confirmText 입력 필요).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 595 + 신규 1 = 596 근처 (또는 기존 테스트 조정 반영).
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - AutoInviteStudents 다이얼로그에 confirm-count input
   - 개수 불일치 → confirm 버튼 disabled
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **개별 학생 선택** — 별도 slice.
- **프리뷰 편집** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoInviteStudentsDialog 개수 확인 input (실수 방지 폴리시)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-invite-confirm-count-v62`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
