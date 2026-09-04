# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **AutoCreateGroups 사용자 정의 접두사 v0.52** — 반 그룹 이메일 접두사 (기본 `class`) 를 admin 이 다이얼로그에서 편집 가능. 학교마다 다른 명명 관행 대응.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-create-prefix-v52`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `66e2bfe` (부서별 그룹 자동 생성 v0.51)

## 지금 할 것 — AutoCreateGroups prefix 편집

### 왜

v0.48 로 자동 생성 완비, v0.50 로 skip 처리 완비. 그러나 이메일 접두사 는 하드코딩 (`class-`). 학교마다 명명 관행 다름:
- `class-1a@` (기본)
- `homeroom-1a@`
- `students-1a@`
- `2026-1a@`

admin 이 다이얼로그에서 접두사 편집 → preview 실시간 갱신.

**하지 않는 것**:
- basic_data 스키마에 prefix 저장 (별도 slice — 반복 사용 시).
- 클래스명 template 커스터마이즈 (예: `{grade}-{class}` vs `{grade}반-{class}조`) — 별도 slice.
- AutoCreateDepartmentGroups 병행 개선 (별도 slice — slug 입력이 이미 있음).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx` — prefix state + input + `buildGroupEmail` prefix 파라미터 추가
- `packages/web/tests/AutoCreateGroupsDialog.test.tsx` — 시나리오 2 (기본 prefix · 편집)

**손대지 마라**:
- 백엔드 · shared · Firestore.
- AutoCreateDepartmentGroupsDialog — 그대로 (별개).
- BasicDataPanel — 그대로.

### 세부 요구

#### 1. `buildGroupEmail` 파라미터 확장

기존:
```ts
export function buildGroupEmail(grade: number, cls: string): string {
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `class-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
}
```

변경:
```ts
export function buildGroupEmail(grade: number, cls: string, prefix: string = 'class'): string {
  const clsSlug = cls.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${cleanPrefix}-${grade}${clsSlug}@${ALLOWED_DOMAIN}`;
}
```

기본값 `'class'` 유지 → 기존 외부 사용자 (있으면) backward compat.

#### 2. state 추가

```ts
const [prefix, setPrefix] = useState('class');

useEffect(() => {
  if (open) {
    setPhase('confirm');
    setProgress(0);
    setResults([]);
    setConfirmText('');
    setPrefix('class');   // 초기화
  }
}, [open]);
```

**주의**: 기존 초기화 useEffect 에 prefix 추가.

#### 3. `targets` 계산 변경

기존 `useMemo` 에 prefix 반영:
```ts
const targets = useMemo(
  () =>
    (grades ?? []).flatMap((g) =>
      (g.classes ?? []).map((c) => ({
        grade: g.grade,
        class: c,
        email: buildGroupEmail(g.grade, c, prefix),
        name: buildGroupName(g.grade, c),
        description: buildGroupDescription(year, g.grade, c),
      }))
    ),
  [grades, year, prefix]
);
```

#### 4. UI — confirm phase prefix input

기존 `<DialogDescription>` 아래, `targets` 테이블 위에:
```tsx
<div className="space-y-1">
  <label className="text-small text-fg-primary">이메일 접두사 (기본 <code className="font-mono">class</code>):</label>
  <input
    type="text"
    value={prefix}
    onChange={(e) => setPrefix(e.target.value)}
    placeholder="class"
    data-testid="auto-create-groups-prefix-input"
    className={
      /^[a-z0-9-]+$/.test(prefix)
        ? 'w-40 border border-border-subtle bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong'
        : 'w-40 border border-state-danger bg-canvas px-3 py-2 text-body font-mono text-fg-primary focus:outline-none'
    }
  />
  <p className="text-micro text-fg-muted">소문자·숫자·하이픈만. 예: <code className="font-mono">homeroom</code>, <code className="font-mono">2026</code></p>
</div>
```

**confirm 버튼 disabled 조건 확장**:
```tsx
disabled={
  confirmText.trim() !== String(targets.length) ||
  targets.length === 0 ||
  !/^[a-z0-9-]+$/.test(prefix)
}
```

**주의**:
- prefix 유효성은 정규식 `/^[a-z0-9-]+$/`. `buildGroupEmail` 내부 클린업도 있으므로 이중 안전 (사용자에게 시각적 오류 표시 목적).
- 빈 prefix 도 invalid (정규식 매치 안 됨).

#### 5. 테스트

**web `AutoCreateGroupsDialog.test.tsx`** (2 신규 시나리오):

1. **기본 prefix**: `open=true` → `auto-create-groups-prefix-input` 값이 `'class'` + preview 이메일 `class-1a@cam.hs.kr` 형식.
2. **prefix 편집**: `homeroom` 입력 → preview 이메일 `homeroom-1a@cam.hs.kr` 형식으로 재계산.

기존 시나리오 회귀 유지 (특히 `class-1a@` 검증하던 시나리오는 그대로 통과해야 함 — 기본 prefix 는 여전히 `class`).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 554 + 신규 2 = 556 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 자동 생성 다이얼로그에 접두사 input
   - 편집 → preview 이메일 실시간 갱신
   - invalid prefix → 빨간 border + confirm disabled
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **basic_data 스키마에 prefix 저장** — 별도 slice.
- **name/description 템플릿 커스터마이즈** — 별도 slice.
- **AutoCreateDepartmentGroups 도 접두사 편집 추가** — slug 이미 있음, 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateGroupsDialog 이메일 접두사 편집 (기본 class)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-create-prefix-v52`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
