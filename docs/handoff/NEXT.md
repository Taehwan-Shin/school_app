# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **학생 자동 초대 v0.58** — BasicDataPanel 「학생 자동 초대」 + AutoInviteStudentsDialog. rosters 를 순회해서 반 그룹에 학생 이메일 추가 (`callGroupsMembersInsert` 반복).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-invite-students-v58`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `d3f6ccb` (rosters 편집 UI v0.57)

## 지금 할 것 — 학생 → 반 그룹 자동 초대

### 왜

v0.48 로 반 그룹 자동 생성, v0.57 로 학생 명단 편집 완비. 이제 두 데이터를 연결 — 반별 학생 이메일 을 해당 반 그룹에 자동 초대. AutoCreateGroups 와 동일 접두사 규칙 (`class-{grade}{class-lower}@`), 반복 호출.

**하지 않는 것**:
- 그룹 생성 후 자동 초대 병합 (AutoCreateGroups + 초대 통합) — 별도 slice.
- 부서 그룹에 부서장 자동 지정 — 별도 slice.
- 학생 제거 (졸업생 정리) — v0.59+ 후보.
- 학생 역할 (OWNER/MANAGER) — MEMBER 로 고정.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/AutoInviteStudentsDialog.tsx` — preview + iteration
- `packages/web/tests/AutoInviteStudentsDialog.test.tsx` — 시나리오 4

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 「학생 자동 초대」 버튼 + Dialog state
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1

**손대지 마라**:
- 백엔드 · shared · Firestore.
- callGroupsMembersInsert 자체.
- AutoCreateGroupsDialog · EditRostersDialog — 그대로.

### 세부 요구

#### 1. `AutoInviteStudentsDialog.tsx`

**Props**:
```ts
export interface AutoInviteStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  data: BasicDataYear;   // grades + rosters
  onDone?: () => void;
}
```

**상수/헬퍼** (AutoCreateGroupsDialog 와 동일 규칙):
```ts
const ALLOWED_DOMAIN = 'cam.hs.kr';

function buildGroupEmail(grade: number, cls: string, prefix: string): string {
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${cleanPrefix}-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
}

function isAlreadyMemberError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('member exists') ||
    lower.includes('http_409')
  );
}
```

**state**:
```ts
type Phase = 'confirm' | 'running' | 'done';
type ResultKind = 'ok' | 'skipped' | 'failed';
type Result = {
  groupEmail: string;
  memberEmail: string;
  kind: ResultKind;
  message?: string;
};

const [phase, setPhase] = useState<Phase>('confirm');
const [prefix, setPrefix] = useState('class');
const [progress, setProgress] = useState(0);
const [results, setResults] = useState<Result[]>([]);
```

**targets 계산** (grades × rosters 조합):
```ts
const targets = useMemo(() => {
  const out: { groupEmail: string; memberEmail: string; grade: number; class: string }[] = [];
  for (const g of data.grades) {
    for (const c of g.classes) {
      const students = data.rosters?.[String(g.grade)]?.[c] ?? [];
      const groupEmail = buildGroupEmail(g.grade, c, prefix);
      for (const s of students) {
        out.push({ groupEmail, memberEmail: s, grade: g.grade, class: c });
      }
    }
  }
  return out;
}, [data, prefix]);
```

**iteration**:
```ts
const handleConfirm = async () => {
  setPhase('running');
  const localResults: Result[] = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      await callGroupsMembersInsert({
        groupEmail: t.groupEmail,
        memberEmail: t.memberEmail,
        role: 'MEMBER',
      });
      localResults.push({ groupEmail: t.groupEmail, memberEmail: t.memberEmail, kind: 'ok' });
    } catch (e) {
      const message = (e as Error).message;
      const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
      localResults.push({ groupEmail: t.groupEmail, memberEmail: t.memberEmail, kind, message });
    }
    setProgress(i + 1);
  }
  setResults(localResults);
  setPhase('done');
  queryClient?.invalidateQueries({ queryKey: ['groups', 'members'] });
};
```

**UI — confirm phase**:
```tsx
<DialogHeader>
  <DialogTitle>학생 자동 초대</DialogTitle>
  <DialogDescription>
    {year}년 rosters 기준 {targets.length}명 학생을 반 그룹에 초대합니다.
  </DialogDescription>
</DialogHeader>
<div className="space-y-1">
  <label className="text-small text-fg-primary">그룹 이메일 접두사 (기본 <code className="font-mono">class</code>):</label>
  <input
    type="text"
    value={prefix}
    onChange={(e) => setPrefix(e.target.value)}
    data-testid="auto-invite-students-prefix-input"
    className={
      /^[a-z0-9-]+$/.test(prefix)
        ? 'w-40 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong'
        : 'w-40 border border-state-danger bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none'
    }
  />
  <p className="text-micro text-fg-muted">AutoCreateGroups 에서 사용한 접두사와 동일해야 실 그룹에 초대됩니다.</p>
</div>
<div className="max-h-48 overflow-y-auto border border-border-subtle" data-testid="auto-invite-students-targets">
  <table className="w-full text-small">
    <thead className="bg-canvas border-b border-border-subtle text-fg-secondary text-left sticky top-0">
      <tr>
        <th className="py-2 px-3 font-medium">그룹</th>
        <th className="py-2 px-3 font-medium">학생</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border-subtle">
      {targets.slice(0, 20).map((t, i) => (
        <tr key={`${t.groupEmail}-${t.memberEmail}-${i}`}>
          <td className="py-2 px-3 font-mono text-fg-primary">{t.groupEmail}</td>
          <td className="py-2 px-3 text-fg-secondary">{t.memberEmail}</td>
        </tr>
      ))}
      {targets.length > 20 && (
        <tr><td colSpan={2} className="py-2 px-3 text-fg-muted text-center">... 외 {targets.length - 20}건</td></tr>
      )}
    </tbody>
  </table>
</div>
<DialogFooter>
  <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
  <Button
    onClick={handleConfirm}
    disabled={targets.length === 0 || !/^[a-z0-9-]+$/.test(prefix)}
    data-testid="auto-invite-students-confirm-btn"
  >
    초대 실행
  </Button>
</DialogFooter>
```

**running · done phase**: AutoCreateGroupsDialog 와 동일 (3 카운트: 성공/이미 멤버/실패). data-testid 접두사 `auto-invite-students-*`.

**주의**:
- 개수 확인 입력 없음 (rosters 총 학생 수 그냥 실행). 큰 규모 실행 방지가 걱정이면 개수 입력 추가 여지 — 이번은 생략 (UX 단순).
- 그룹이 없으면 (미리 AutoCreateGroups 안 함) 실패 목록에 원문 오류.

#### 2. `BasicDataPanel.tsx` — 「학생 자동 초대」 버튼

기존 「학생 명단 편집」 옆:
```tsx
<Button
  variant="secondary"
  onClick={() => setIsAutoInviteOpen(true)}
  data-testid="basic-data-auto-invite-students-btn"
  disabled={!data?.data?.rosters || Object.keys(data.data.rosters).length === 0}
  title={
    !data?.data?.rosters || Object.keys(data.data.rosters).length === 0
      ? '학생 명단을 먼저 등록하세요'
      : 'rosters 학생을 반 그룹에 자동 초대'
  }
>
  학생 자동 초대
</Button>
```

**state**: `const [isAutoInviteOpen, setIsAutoInviteOpen] = useState(false);`

**다이얼로그 렌더**:
```tsx
{data?.data && (
  <AutoInviteStudentsDialog
    open={isAutoInviteOpen}
    onOpenChange={setIsAutoInviteOpen}
    year={selectedYear}
    data={data.data}
  />
)}
```

#### 3. 테스트

**web `AutoInviteStudentsDialog.test.tsx`** (4 시나리오):
1. `open=true` grades + rosters → targets 렌더링 (그룹 이메일 · 학생 이메일 조합).
2. prefix 편집 → preview 이메일 재계산.
3. 성공 반복: mock callGroupsMembersInsert all resolve → done, 3 카운트.
4. 하나 「Member already exists」 reject → skipped 카운트에 반영.

**web `BasicDataPanel.test.tsx`** (1 시나리오):
- rosters 없음/빈 객체 → `basic-data-auto-invite-students-btn` disabled.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 585 + 신규 5 = 590 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 「학생 자동 초대」 (rosters 있을 때만 enabled)
   - 다이얼로그: preview + prefix + 실행
   - 진행 바 → 결과 (성공/이미 멤버/실패)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **AutoCreateGroups + 초대 통합** — 별도 slice.
- **큰 규모 (수백 명) 시간** — 클라이언트 반복이라 몇 분 걸림. 서버 batch 는 별도 slice.
- **접두사 저장** — 별도 slice (basic_data 스키마 확장).
- **학생 제거** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoInviteStudentsDialog + BasicDataPanel 「학생 자동 초대」 버튼`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-invite-students-v58`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
