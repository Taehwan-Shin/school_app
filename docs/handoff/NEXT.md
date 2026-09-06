# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **rosters 무음 삭제 hotfix v0.67** — Codex 감사 P1 (데이터 손실). EditBasicDataDialog 저장 시 기존 rosters 보존.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/edit-basic-data-rosters-preserve-v67`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `f841ebd` (ImportBasicData saving close 차단 v0.66)

## 지금 할 것 — 🔴 데이터 손실 hotfix

### 왜

Codex 감사 P1 (실패 · HEAD 에 존재):

> `packages/web/src/routes/admin/EditBasicDataDialog.tsx:103` — grades/부서 편집 저장 payload 에 기존 `initialData.rosters` 가 없고 서버 line 102 가 `merge:false` 라, 학생 명단이 있는 연도에서 기초값 「편집」 을 한 번 저장하면 rosters 전체가 조용히 삭제된다.

**정확한 지적**. rosters 를 initialData 에서 그대로 payload 에 포함하면 됨 (EditRostersDialog 는 이미 이 패턴 · `packages/web/src/routes/admin/EditRostersDialog.tsx` 참고).

**하지 않는 것**: rosters 편집 UI 를 EditBasicDataDialog 에 추가 (분리 유지). 서버 merge:true 로 변경 (다른 슬라이스에 영향).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/EditBasicDataDialog.tsx` — handleSubmit 의 saveBasicData 호출에 initialData.rosters spread 추가
- `packages/web/tests/EditBasicDataDialog.test.tsx` — 시나리오 1 (rosters 있는 initialData → 저장 시 payload 에 포함)

**손대지 마라**:
- 백엔드 · shared · basicData.set (그대로).
- EditRostersDialog · 다른 다이얼로그.
- BasicDataPanel · AutoCreate.

### 세부 요구

#### 1. `handleSubmit` payload 확장

기존 (`packages/web/src/routes/admin/EditBasicDataDialog.tsx:103-108`):
```ts
try {
  await saveBasicData({
    year,
    grades,
    ...(departments !== undefined ? { departments } : {}),
  });
  onOpenChange(false);
} catch { ... }
```

변경:
```ts
try {
  await saveBasicData({
    year,
    grades,
    ...(departments !== undefined ? { departments } : {}),
    ...(initialData?.rosters !== undefined ? { rosters: initialData.rosters } : {}),
  });
  onOpenChange(false);
} catch { ... }
```

**주의**:
- `initialData` 는 이미 props 로 받고 있음 (BasicDataYear | null).
- rosters 는 편집 안 함 → initialData 값 그대로 pass-through.
- 명시적 rosters 편집은 EditRostersDialog 에서 (분리된 관심사).

#### 2. 테스트

**web `EditBasicDataDialog.test.tsx`** (1 신규 시나리오):
- initialData 에 `rosters: { "1": { "A": ["s1@cam.hs.kr"] } }` → 편집 저장 시 mock `saveBasicData` 호출 payload 에 정확히 그 rosters 포함.

기존 시나리오 회귀 유지 — 특히 rosters 없는 (기본) initialData 는 payload 에 rosters 키 없어야 함.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 603 + 신규 1 = 604 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 학생 명단이 있는 연도 편집 → 저장 → 학생 명단 유지됨
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **명시적 rosters 삭제 UX** — EditRostersDialog 에서 반별 지우기로 처리 (별도 slice).

### 커밋 규칙

**1 커밋**:
- `fix(web): EditBasicDataDialog 저장 시 기존 rosters 보존 (Codex 감사 · 데이터 손실)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/edit-basic-data-rosters-preserve-v67`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
