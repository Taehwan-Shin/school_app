# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **부서 그룹 + 부서장 지정 v0.60** — AutoCreateDepartmentGroupsDialog 에 부서별 「부서장 이메일 (OWNER)」 optional input 추가.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/dept-groups-owner-v60`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `7526851` (AutoCreateGroups + 초대 통합 v0.59)

## 지금 할 것 — 부서장 (OWNER) 지정

### 왜

v0.51 로 부서 그룹 자동 생성 완비. 각 부서 그룹 생성 후 부서장 (교사) 을 OWNER 로 지정하는 일 반복. 그룹 생성 다이얼로그 안에서 부서별 owner 이메일 optional 입력 → 생성 성공 시 자동 OWNER 지정.

**하지 않는 것**:
- 스키마 저장 (departments 를 {name, slug, owner} 객체로) — 별도 slice.
- 여러 owner (co-chair 등) — 이번은 optional single owner.
- 부서장 자동 추천 (직급 기반) — 별도 slice.
- 부서장 role 변경 (OWNER → MANAGER) — 이번은 OWNER 로만.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AutoCreateDepartmentGroupsDialog.tsx` — 부서별 owner input + iteration 확장
- `packages/web/tests/AutoCreateDepartmentGroupsDialog.test.tsx` — 시나리오 2 (owner 없음 · 있음)

**손대지 마라**:
- 백엔드 · shared · basic_data 스키마.
- 다른 다이얼로그 · BasicDataPanel.
- callGroupsCreate · callGroupsMembersInsert.

### 세부 요구

#### 1. state · preview 확장

기존 slugs state 옆에:
```ts
const [owners, setOwners] = useState<string[]>([]);   // department index 와 동기화, 빈 문자열 허용
```

**open 초기화**:
```ts
useEffect(() => {
  if (open) {
    // 기존 초기화 +
    setOwners(departments.map(() => ''));   // 기본 빈 문자열
  }
}, [open, departments]);
```

**preview 확장** — 각 department 에 `owner?: string` (trim 후 빈 문자열이 아니면):
```ts
const preview = departments.map((dept, i) => {
  const slug = (slugs[i] ?? '').trim().toLowerCase();
  const validSlug = SLUG_REGEX.test(slug);
  const ownerRaw = (owners[i] ?? '').trim();
  const validOwner = ownerRaw === '' || /^[^\s@]+@cam\.hs\.kr$/i.test(ownerRaw);
  return {
    deptName: dept,
    slug,
    email: validSlug ? buildDeptGroupEmail(slug) : '',
    validSlug,
    owner: ownerRaw === '' ? undefined : ownerRaw,
    validOwner,
  };
});

const allValid = preview.every((p) => p.validSlug && p.validOwner);
const noDuplicates = new Set(preview.map((p) => p.slug)).size === preview.length;
const canConfirm = allValid && noDuplicates && preview.length > 0;
```

**주의**:
- owner 는 optional (빈 문자열 유효).
- owner 도메인 강제 (`@cam.hs.kr`) — 실 사용 시 owner 는 반드시 도메인 계정.
- validation 실패 시 confirm disabled + 문구.

#### 2. iteration 확장

기존 `handleConfirm` (그룹 생성만):
```ts
for (let i = 0; i < preview.length; i++) {
  const p = preview[i];
  try {
    await callGroupsCreate({ email: p.email, name: buildDeptGroupName(p.deptName), description: buildDeptGroupDescription(year, p.deptName) });
    localResults.push({ deptName: p.deptName, email: p.email, kind: 'ok' });
  } catch (e) { ... }
  setProgress(i + 1);
}
```

확장 (owner 있으면 추가로 insert 호출):
```ts
const isAlreadyMemberError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return lower.includes('already') || lower.includes('duplicate') || lower.includes('member exists') || lower.includes('http_409');
};

for (let i = 0; i < preview.length; i++) {
  const p = preview[i];
  let groupOk = false;
  try {
    await callGroupsCreate({
      email: p.email,
      name: buildDeptGroupName(p.deptName),
      description: buildDeptGroupDescription(year, p.deptName),
    });
    localResults.push({ deptName: p.deptName, email: p.email, kind: 'ok' });
    groupOk = true;
  } catch (e) {
    const message = (e as Error).message;
    const kind = isAlreadyExistsError(message) ? 'skipped' : 'failed';
    localResults.push({ deptName: p.deptName, email: p.email, kind, message });
    groupOk = kind === 'skipped';   // 이미 존재하는 그룹에도 owner 초대 시도
  }
  setProgress((i + 1) * (p.owner ? 2 : 1));   // ← 대신 별도 counter 사용 권장

  // owner 지정 시도
  if (p.owner && groupOk) {
    try {
      await callGroupsMembersInsert({
        groupEmail: p.email,
        memberEmail: p.owner,
        role: 'OWNER',
      });
      localResults.push({ deptName: `${p.deptName} → owner`, email: p.owner, kind: 'ok' });
    } catch (e) {
      const message = (e as Error).message;
      const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
      localResults.push({ deptName: `${p.deptName} → owner`, email: p.owner, kind, message });
    }
  }
}
```

**주의**:
- `setProgress` 을 별도 counter 로 관리하는 게 명확 (아래 UI 참고).
- results 의 `deptName` 은 owner iteration 시 「부서명 → owner」 표기 (UX 명료).
- import `callGroupsMembersInsert` 추가.

**총 오퍼레이션 계산**:
```ts
const totalOps = preview.reduce((sum, p) => sum + 1 + (p.owner ? 1 : 0), 0);
```

running phase 진행 표시는 이 total 사용.

#### 3. UI — owner input

preview 테이블 확장 (기존: 부서 · Slug · 이메일 → 추가 부서장):
```tsx
<table>
  <thead>
    <tr>
      <th>부서</th>
      <th>Slug</th>
      <th>이메일</th>
      <th>부서장 (선택)</th>
    </tr>
  </thead>
  <tbody>
    {departments.map((dept, i) => (
      <tr key={`${dept}-${i}`}>
        <td>{dept}</td>
        <td>
          <input value={slugs[i] ?? ''} onChange={...} data-testid={`auto-create-dept-slug-${i}`} />
        </td>
        <td>{preview[i].validSlug ? preview[i].email : <span className="text-state-danger">invalid</span>}</td>
        <td>
          <input
            type="email"
            value={owners[i] ?? ''}
            onChange={(e) => {
              const next = [...owners];
              next[i] = e.target.value;
              setOwners(next);
            }}
            placeholder="teacher@cam.hs.kr"
            data-testid={`auto-create-dept-owner-${i}`}
            className={
              preview[i].validOwner
                ? 'w-48 border border-border-subtle bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none focus:border-border-strong'
                : 'w-48 border border-state-danger bg-canvas px-2 py-1 text-small font-mono text-fg-primary focus:outline-none'
            }
          />
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**검증 문구**:
```tsx
{!allValid && (
  <p className="text-small text-state-danger">일부 slug 또는 부서장 이메일이 유효하지 않습니다.</p>
)}
```

#### 4. 테스트

**web `AutoCreateDepartmentGroupsDialog.test.tsx`** (2 신규):
1. **owner 없이 실행**: departments=['국어과','수학과'], owners = ['', ''] → callGroupsCreate 2 회만 호출, callGroupsMembersInsert 안 호출.
2. **owner 있이 실행**: departments=['국어과'], owner=['teacher@cam.hs.kr'] → 그룹 생성 후 callGroupsMembersInsert(role='OWNER') 호출됨.

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 592 + 신규 2 = 594 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 부서 그룹 자동 생성 다이얼로그에 「부서장 (선택)」 컬럼
   - 부서장 이메일 입력 시 validation (`@cam.hs.kr`)
   - 실행 → 그룹 + owner iteration
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **owner 여러 명** — 별도 slice (`co-chair` 등).
- **owner 스키마 저장** — 별도 slice.
- **자동 추천 (직급 기반)** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateDepartmentGroupsDialog 에 부서장 (OWNER) 지정 필드 추가`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/dept-groups-owner-v60`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
