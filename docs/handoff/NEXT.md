# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **v0.65 감사 결과 hotfix v0.66** — ImportBasicDataDialog 의 saving phase close 차단. Codex 감사 지적사항 (경쟁 조건) 수정.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/import-basic-data-saving-close-v66`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `d2c2546` (basic_data JSON import v0.65)

## 지금 할 것 — Codex 감사 hotfix

### 왜

v0.65 Codex 감사 결과 (2026-09-06 06:57 KST) 1 실패:

> `packages/web/src/routes/admin/ImportBasicDataDialog.tsx:88` — saving 중 닫기 버튼만 CSS 로 숨길 뿐 `onOpenChange` 를 그대로 열어 Escape/바깥 클릭으로 닫을 수 있고, 닫은 뒤 재오픈하면 line 36 초기화 이후 이전 요청의 line 80 완료 콜백이 새 세션을 `done` 으로 덮어써 연도 없는 성공 화면을 만들 수 있다; saving 동안 close 요청 차단 또는 요청 세대/마운트 가드가 필요하다.

**정확한 지적**. BulkSuspendDialog · BulkDeleteDialog · AutoCreateGroupsDialog 등은 이미 running phase close 차단 있음 (`if (phase === 'running') return;`). ImportBasicDataDialog 만 누락. 대칭 완성 + Codex 감사 반영.

**하지 않는 것**: mount guard / AbortController 등 방어층 추가 (지금은 close 차단만으로 충분). 다른 다이얼로그 관련 리팩터.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/ImportBasicDataDialog.tsx` — `handleOpenChange` wrapper 추가
- `packages/web/tests/ImportBasicDataDialog.test.tsx` — 시나리오 1 (saving 중 close 시도 → 차단)

**손대지 마라**:
- 다른 다이얼로그 · 백엔드 · shared.

### 세부 요구

#### 1. `handleOpenChange` wrapper

기존 (`packages/web/src/routes/admin/ImportBasicDataDialog.tsx:88`):
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
```

변경:
```tsx
const handleOpenChange = (newOpen: boolean) => {
  if (phase === 'saving') return;
  onOpenChange(newOpen);
};

// ...

<Dialog open={open} onOpenChange={handleOpenChange}>
```

**주의**:
- BulkSuspendDialog · BulkDeleteDialog · AutoCreateGroupsDialog · AutoInviteStudentsDialog 는 이미 이 패턴 (`if (phase === 'running') return;`) 사용. 여기선 'saving' phase.
- CSS 로 close 버튼 숨김 (`[&>button]:hidden`) 은 그대로 유지 (시각적 강조).

#### 2. 테스트

**web `ImportBasicDataDialog.test.tsx`** (1 신규 시나리오):
- `saveBasicData` mock 이 pending 상태 (resolve 지연) → dialog `saving` phase.
- `onOpenChange(false)` 강제 호출 시도 (Dialog radix 는 Escape 시 호출) → `onOpenChangeMock` 안 호출됨 (또는 false 전달 안 됨).

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 602 + 신규 1 = 603 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - JSON 파일 선택 → preview → 저장 실행 → saving 중 Escape 눌러도 닫히지 않음
   - 저장 완료 → done → 확인 → 닫힘
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **mount guard** — 추가 방어층, 별도 slice (지금은 close 차단만으로 충분).

### 커밋 규칙

**1 커밋**:
- `fix(web): ImportBasicDataDialog saving phase close 차단 (Codex 감사 반영)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/import-basic-data-saving-close-v66`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
