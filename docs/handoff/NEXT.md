# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **AutoCreateGroups + 학생 초대 통합 v0.59** — AutoCreateGroupsDialog 에 「생성 후 학생 자동 초대」 checkbox 추가. 반 그룹 생성 후 rosters 학생 자동 initialize.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-create-with-invite-v59`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `1f6fa7a` (학생 자동 초대 v0.58)

## 지금 할 것 — AutoCreateGroups 에 초대 병합

### 왜

v0.48 로 그룹 자동 생성, v0.58 로 학생 자동 초대. 두 개 별도 → 사용자는 두 다이얼로그 순차 실행. 통합 시 원클릭. 기존 별도 「학생 자동 초대」 다이얼로그 는 유지 (기존 그룹 대상 재초대 등 용도).

**하지 않는 것**:
- AutoInviteStudentsDialog 제거 (별도 사용 케이스 유지).
- 부서 그룹 통합 — 학생만.
- 스키마 저장 (checkbox 상태 persist) — 별도 slice.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx` — `rosters?` prop 추가 + 「생성 후 학생 자동 초대」 checkbox + 확장 iteration
- `packages/web/tests/AutoCreateGroupsDialog.test.tsx` — 시나리오 2 (checkbox 미체크 · 체크 시 iteration 확장)
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — AutoCreateGroupsDialog 에 rosters 전달

**손대지 마라**:
- 백엔드 · shared · Firestore.
- AutoInviteStudentsDialog · EditRostersDialog — 그대로.
- callGroupsCreate · callGroupsMembersInsert — 그대로.

### 세부 요구

#### 1. `AutoCreateGroupsDialog.tsx` — props 확장

기존:
```ts
export interface AutoCreateGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  grades: BasicDataGradeClass[];
  onDone?: () => void;
}
```

확장:
```ts
export interface AutoCreateGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  grades: BasicDataGradeClass[];
  rosters?: Record<string, Record<string, string[]>>;   // 신규 (optional, backward compat)
  onDone?: () => void;
}
```

#### 2. 신규 state · checkbox

```ts
const [inviteStudents, setInviteStudents] = useState(false);

// open 초기화 시 리셋
useEffect(() => {
  if (open) {
    // 기존 초기화 + 
    setInviteStudents(false);
  }
}, [open]);
```

**주의**:
- 기본값 false (opt-in) — 실수 방지.
- rosters undefined 또는 빈 객체 → checkbox disabled.

#### 3. 확장 iteration

기존 `handleConfirm` 은 targets (반 그룹) 반복. `inviteStudents === true` 시 각 그룹 성공 후 학생 iteration.

```ts
const handleConfirm = async () => {
  setPhase('running');
  const localResults: Result[] = [];
  // 총 오퍼레이션 = 그룹 수 + (checked 시 학생 수)
  const totalGroups = targets.length;
  const totalStudents = inviteStudents
    ? targets.reduce((sum, t) => sum + (rosters?.[String(t.grade)]?.[t.class]?.length ?? 0), 0)
    : 0;
  const totalOps = totalGroups + totalStudents;
  let opProgress = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    let groupOk = false;
    try {
      await callGroupsCreate({
        email: t.email,
        name: t.name,
        description: t.description,
      });
      localResults.push({ email: t.email, kind: 'ok' });
      groupOk = true;
    } catch (e) {
      const message = (e as Error).message;
      const kind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
      localResults.push({ email: t.email, kind, message });
      groupOk = kind === 'skipped';  // 이미 있는 그룹에도 학생 초대는 시도
    }
    opProgress++;
    setProgress(opProgress);

    // 학생 초대 (checkbox 체크 시 · 그룹 생성 성공 or 이미 존재 시만)
    if (inviteStudents && groupOk) {
      const students = rosters?.[String(t.grade)]?.[t.class] ?? [];
      for (const memberEmail of students) {
        try {
          await callGroupsMembersInsert({
            groupEmail: t.email,
            memberEmail,
            role: 'MEMBER',
          });
          localResults.push({ email: `${t.email} → ${memberEmail}`, kind: 'ok' });
        } catch (e) {
          const message = (e as Error).message;
          const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
          localResults.push({ email: `${t.email} → ${memberEmail}`, kind, message });
        }
        opProgress++;
        setProgress(opProgress);
      }
    }
  }

  setResults(localResults);
  setPhase('done');
  queryClient?.invalidateQueries({ queryKey: ['groups', 'list'] });
  if (inviteStudents) {
    queryClient?.invalidateQueries({ queryKey: ['groups', 'members'] });
  }
};
```

**주의**:
- 반복 progress = 그룹 + 학생 총합.
- 그룹 생성 실패 (skipped 아님) → 학생 초대 시도 안 함 (그룹 없음).
- `isAlreadyMemberError` 는 인라인 헬퍼 새로 추가 (AutoInviteStudentsDialog 와 동일 정의 · 복사, 추상화 금지).
- results 의 email 은 「그룹 → 학생」 결합 문자열로 학생 결과와 그룹 결과를 시각적으로 구분.

**totalOps 표기**: running phase 의 총합 텍스트 (`progress / total`) 는 targets.length 대신 `totalOps`.

기존:
```tsx
<div className="text-body text-fg-primary">
  진행 중: <strong className="font-mono">{progress}</strong> /{' '}
  <strong className="font-mono">{targets.length}</strong>
</div>
```

변경:
```tsx
const totalOpsDisplay = totalGroups + totalStudents;
<div className="text-body text-fg-primary">
  진행 중: <strong className="font-mono">{progress}</strong> /{' '}
  <strong className="font-mono">{totalOpsDisplay}</strong>
</div>
```

`totalOpsDisplay` 는 useMemo 또는 render 시점 계산. state 로 running 진입 시 스냅샷 고정 권장 (checkbox 나중에 바꿔도 진행 중 변수 안 바뀌게).

#### 4. UI — checkbox

기존 prefix input 아래에:
```tsx
<div>
  <label className="flex items-center gap-2 text-body text-fg-primary">
    <input
      type="checkbox"
      checked={inviteStudents}
      disabled={!rosters || Object.keys(rosters).length === 0}
      onChange={(e) => setInviteStudents(e.target.checked)}
      data-testid="auto-create-groups-invite-students"
    />
    생성 후 학생 자동 초대 (rosters 기준)
  </label>
  <p className="text-micro text-fg-muted mt-1 ml-6">
    {!rosters || Object.keys(rosters).length === 0
      ? '학생 명단이 없으면 사용 불가'
      : '각 반 그룹 생성/이미 존재 시 rosters 학생을 자동 초대'}
  </p>
</div>
```

#### 5. `BasicDataPanel.tsx` — rosters 전달

AutoCreateGroupsDialog 렌더:
```tsx
<AutoCreateGroupsDialog
  open={isAutoCreateOpen}
  onOpenChange={setIsAutoCreateOpen}
  year={selectedYear}
  grades={data.data.grades}
  rosters={data.data.rosters}   // 신규
/>
```

#### 6. 테스트

**web `AutoCreateGroupsDialog.test.tsx`** (2 신규):

1. **checkbox 미체크 (기본)** — rosters 있어도 학생 iteration 안 됨. 기존 시나리오 회귀 그대로 통과.
2. **checkbox 체크** — grades = 1 반, rosters = 학생 2 명 → 그룹 생성 1 회 + 학생 insert 2 회 총 3 오퍼레이션.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 590 + 신규 2 = 592 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - AutoCreateGroups 다이얼로그에 checkbox 표시
   - rosters 없으면 disabled + 안내 문구
   - 체크 → 실행 → 진행 바 (그룹 + 학생 합계)
   - 완료 후 결과 요약
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **AutoInviteStudentsDialog 제거** — 유지 (별도 사용 케이스 있음).
- **checkbox 상태 persist** — 별도 slice.
- **부서 그룹 + 부서장 자동 초대** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateGroupsDialog 에 「생성 후 학생 자동 초대」 checkbox 추가`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-create-with-invite-v59`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
