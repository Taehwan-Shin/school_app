# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **그룹 자동 생성 v0.48** — BasicDataPanel 에 「그룹 자동 생성」 버튼 + AutoCreateGroupsDialog. basic_data 각 (학년·반) 에서 `callGroupsCreate` 반복.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-create-groups-v48`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `bb13d51` (basic_data 편집 v0.47)

## 지금 할 것 — basic_data → 그룹 자동 생성

### 왜

basic_data 도메인 첫 실 활용. admin 이 학년/반 구조 (1-A, 1-B, 2-A ...) 를 basic_data 에 입력 → 각 반 학생 명단용 그룹 이메일 (`class-1a@`, `class-1b@` ...) 을 자동 생성. 현재 admin 은 그룹 하나씩 만드는 것만 가능 — 학년당 10~20 반이면 개별 생성 20 회 × 학년 3 = 60 회. 자동 생성으로 원클릭.

**하지 않는 것**:
- 사용자 정의 템플릿 (v0.49 후보 — 이번은 고정 템플릿 `class-{grade}{class-lower}@cam.hs.kr`).
- 그룹 멤버 자동 초대 (별도 slice · basic_data 에 학생 명단 스키마 확장 필요).
- 기존 그룹 자동 삭제 · 마이그레이션.
- 백엔드 batch endpoint (지금 규모는 클라이언트 반복 충분).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx` — preview + confirm + 반복 호출
- `packages/web/tests/AutoCreateGroupsDialog.test.tsx` — 시나리오 3

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 헤더에 「그룹 자동 생성」 버튼 + Dialog state
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1 (버튼 렌더 · disabled 조건)

**손대지 마라**:
- 백엔드 · shared · middleware · Firestore.
- callGroupsCreate · useCreateGroup — 그대로 (직접 호출).
- EditBasicDataDialog · basicDataSet — 그대로.

### 세부 요구

#### 1. 이메일·이름 생성 규칙

BasicDataPanel · AutoCreateGroupsDialog 안 inline 헬퍼:
```ts
const ALLOWED_DOMAIN = 'cam.hs.kr';

function buildGroupEmail(grade: number, cls: string): string {
  // 예: grade=1, cls='A' → 'class-1a@cam.hs.kr'
  //     grade=10, cls='B' → 'class-10b@cam.hs.kr'
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `class-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
}

function buildGroupName(grade: number, cls: string): string {
  return `${grade}학년 ${cls}반`;
}

function buildGroupDescription(year: number, grade: number, cls: string): string {
  return `${year}년 ${grade}학년 ${cls}반 자동 생성`;
}
```

**주의**:
- 도메인 상수 `cam.hs.kr` 하드코딩 (기존 여러 곳 관행 유지).
- `clsSlug` 는 소문자화 + 특수문자 제거 (`class-1A` 는 무효 — `class-1a`).

#### 2. `AutoCreateGroupsDialog.tsx`

**Props**:
```ts
export interface AutoCreateGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  grades: BasicDataGradeClass[];   // basic_data 에서 넘김
  onDone?: () => void;
}
```

**미리 계산**:
```ts
const targets = useMemo(() =>
  grades.flatMap((g) =>
    g.classes.map((c) => ({
      grade: g.grade,
      class: c,
      email: buildGroupEmail(g.grade, c),
      name: buildGroupName(g.grade, c),
      description: buildGroupDescription(year, g.grade, c),
    }))
  ),
  [grades, year]
);
```

**phase state**:
```ts
type Phase = 'confirm' | 'running' | 'done';
const [phase, setPhase] = useState<Phase>('confirm');
const [progress, setProgress] = useState(0);
const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
const [confirmText, setConfirmText] = useState('');
```

**open false → true 시 리셋** (기존 다이얼로그 패턴).

**iteration**:
```ts
const handleConfirm = async () => {
  setPhase('running');
  const localFailures: { email: string; message: string }[] = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      await callGroupsCreate({
        email: t.email,
        name: t.name,
        description: t.description,
      });
    } catch (e) {
      localFailures.push({ email: t.email, message: (e as Error).message });
    }
    setProgress(i + 1);
  }
  setFailures(localFailures);
  setPhase('done');
  queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
};
```

**UI phase 별** — BulkSuspendDialog 패턴:
- **confirm**: 헤더 「그룹 자동 생성 미리보기」 + 대상 목록 스크롤 (email·name 컬럼) + 개수 입력 확인 (`String(targets.length)`) + 실행 버튼
- **running**: 진행 바 (progress/total)
- **done**: 성공/실패 요약. 실패 목록 (실패 이메일 + 원본 오류 메시지).

data-testid 접두사: `auto-create-groups-*`.

#### 3. `BasicDataPanel.tsx` — 「그룹 자동 생성」 버튼

헤더 오른쪽에 (「편집」 옆에 추가):
```tsx
<Button
  variant="secondary"
  onClick={() => setIsAutoCreateOpen(true)}
  data-testid="basic-data-auto-create-groups-btn"
  disabled={!data?.data || (data.data.grades ?? []).length === 0}
  title={!data?.data ? '기초값 먼저 설정하세요' : '학년/반으로 그룹 자동 생성'}
>
  그룹 자동 생성
</Button>
```

**state**: `const [isAutoCreateOpen, setIsAutoCreateOpen] = useState(false);`

**다이얼로그 렌더**:
```tsx
{data?.data && (
  <AutoCreateGroupsDialog
    open={isAutoCreateOpen}
    onOpenChange={setIsAutoCreateOpen}
    year={currentYear}
    grades={data.data.grades}
  />
)}
```

**주의**:
- 데이터 없거나 grades 없으면 버튼 disabled.
- 「편집」 버튼 왼쪽에 위치 (덜 위험 · 더 자주 사용).

#### 4. 테스트

**web `AutoCreateGroupsDialog.test.tsx`** (3 시나리오):
1. `open=true` grades=[{grade:1, classes:['A','B']}] → targets 2 개 렌더, `class-1a@cam.hs.kr` · `class-1b@cam.hs.kr` 확인.
2. 성공 반복: mock `callGroupsCreate` all resolve → done phase, failures 0.
3. 실패 반복: 하나 reject (예: 「already exists」) → done phase, failures 배열에 원문.

**web `BasicDataPanel.test.tsx`** (1 신규 시나리오):
- data.data null → `basic-data-auto-create-groups-btn` disabled.
- data.data 있고 grades 존재 → enabled.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 536 + 신규 4 = 540 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` BasicDataPanel 헤더 「그룹 자동 생성」 버튼 (데이터 없으면 disabled)
   - 클릭 → 다이얼로그 preview → 개수 입력 → 실행 → 진행 바 → 결과
   - 이미 존재하는 그룹은 실패 목록에 「already exists」 원문 표시 (스킵 처리 개별 slice)
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **사용자 정의 템플릿** — v0.49 후보 (예: `students-{grade}-{class}@`, `homeroom-{grade}{class}@`).
- **기존 그룹 skip** — 「이미 존재」 는 오류로 표시 (스킵 처리 별도 slice).
- **멤버 자동 초대** — basic_data 에 학생 명단 스키마 확장 필요.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateGroupsDialog + BasicDataPanel 「그룹 자동 생성」 버튼`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-create-groups-v48`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
