# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex 재감사 hotfix v0.70** — P7 EditBasicData roster reconcile + P8 class 이름 whitespace 정규화.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/codex-audit-p7-p8-v70`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `f0bba95` (Codex hotfix v0.69)

## 지금 할 것 — P7 + P8 hotfix

### 왜

Codex 재감사 (2026-09-06 07:40 KST) 실패 3건 중 2건:

**P7 EditBasicData 편집 시 stale roster 거부** (`packages/web/src/routes/admin/EditBasicDataDialog.tsx:103`):
> 기존 rosters 를 그대로 보존한 채 학년·반을 삭제하거나 이름을 바꾸면 강화 validator (v0.69) 가 stale roster key 를 거부하므로 편집 저장 자체가 실패한다.

**정확한 지적**. v0.67 (rosters 보존) + v0.69 (validator 강화) 의 상호작용 결과. 해결: submit 시 rosters 를 현재 grades/classes 로 자동 reconcile + UI warning.

**P8 class 이름 whitespace mismatch** (`packages/shared/src/basicData.ts:44`):
> 반 이름은 `trim()` 값으로 유일성·참조를 검사하지만 원본 문자열을 저장해 `classes:[" A "]` 와 roster key `A` 가 validator 를 통과한다.

**해결**: validator 에서 leading/trailing whitespace 있으면 reject. 저장 전 정규화는 admin 이 명확 인식.

**하지 않는 것**: P9 (audit MAX_LIMIT 200 cap) — v0.71 별도 (백엔드 change 필요). 자동 로마자 · 사전 · 다른 폴리시.

### 이 과제가 바꿀 경로

**Commit 1 (P7 roster reconcile)**:
- `packages/web/src/routes/admin/EditBasicDataDialog.tsx` — submit 시 rosters reconcile + stale 감지 → UI warning + 추가 confirm
- `packages/web/tests/EditBasicDataDialog.test.tsx` — 시나리오 2 (stale 감지 · reconcile 저장)

**Commit 2 (P8 whitespace strict)**:
- `packages/shared/src/basicData.ts` — validator: `c !== c.trim()` reject
- `packages/shared/tests/basicData.test.ts` — 시나리오 2 (leading · trailing whitespace)
- `packages/functions/tests/basicDataSet.test.ts` — 시나리오 1 (whitespace 저장 rejection)

**손대지 마라**:
- audit MAX_LIMIT (P9 v0.71).
- 다른 다이얼로그 · 백엔드 callable · 라우트.

### 세부 요구

#### Commit 1: P7 roster reconcile

**EditBasicDataDialog handleSubmit 수정**:

기존 (v0.67 이후):
```ts
try {
  await saveBasicData({
    year,
    grades,
    ...(departments !== undefined ? { departments } : {}),
    ...(initialData?.rosters !== undefined ? { rosters: initialData.rosters } : {}),
  });
  ...
}
```

**변경 — grades 파싱 후, saveBasicData 호출 전**:

```ts
// 새 grades 구조 → gradeStr 별 반 이름 Set
const currentGradeClassMap = new Map<string, Set<string>>();
for (const g of grades) {
  currentGradeClassMap.set(String(g.grade), new Set(g.classes));
}

// stale roster 감지
const staleWarnings: { grade: string; class: string; count: number }[] = [];
if (initialData?.rosters) {
  for (const gradeKey of Object.keys(initialData.rosters)) {
    const validClasses = currentGradeClassMap.get(gradeKey);
    for (const classKey of Object.keys(initialData.rosters[gradeKey])) {
      const count = initialData.rosters[gradeKey][classKey].length;
      if (!validClasses || !validClasses.has(classKey)) {
        staleWarnings.push({ grade: gradeKey, class: classKey, count });
      }
    }
  }
}

// stale 있고 아직 확인 안 함 → 경고 표시, submit 중단
if (staleWarnings.length > 0 && !confirmedStaleReconcile) {
  setStaleWarnings(staleWarnings);
  return;   // UI 가 warning 표시 · 사용자가 다시 submit 클릭
}

// stale 없거나 확인 완료 → rosters reconcile
const reconciledRosters: Record<string, Record<string, string[]>> = {};
if (initialData?.rosters) {
  for (const gradeKey of Object.keys(initialData.rosters)) {
    const validClasses = currentGradeClassMap.get(gradeKey);
    if (!validClasses) continue;
    for (const classKey of Object.keys(initialData.rosters[gradeKey])) {
      if (validClasses.has(classKey)) {
        if (!reconciledRosters[gradeKey]) reconciledRosters[gradeKey] = {};
        reconciledRosters[gradeKey][classKey] = initialData.rosters[gradeKey][classKey];
      }
    }
  }
}

try {
  await saveBasicData({
    year,
    grades,
    ...(departments !== undefined ? { departments } : {}),
    ...(Object.keys(reconciledRosters).length > 0 ? { rosters: reconciledRosters } : {}),
  });
  ...
}
```

**state 추가**:
```ts
const [staleWarnings, setStaleWarnings] = useState<{ grade: string; class: string; count: number }[]>([]);
const [confirmedStaleReconcile, setConfirmedStaleReconcile] = useState(false);
```

**open 초기화**:
```ts
setStaleWarnings([]);
setConfirmedStaleReconcile(false);
```

**UI — warning 표시** (validation 오류 위):
```tsx
{staleWarnings.length > 0 && (
  <div className="border border-state-warning p-4 space-y-2" data-testid="edit-basic-data-stale-warning">
    <div className="text-small text-state-warning">
      이 저장으로 아래 반의 학생 명단 ({staleWarnings.reduce((s, w) => s + w.count, 0)}명) 이 함께 제거됩니다:
    </div>
    <ul className="text-small text-fg-secondary font-mono max-h-24 overflow-y-auto">
      {staleWarnings.map((w) => (
        <li key={`${w.grade}-${w.class}`}>
          {w.grade}학년 {w.class}반: {w.count}명
        </li>
      ))}
    </ul>
    <label className="flex items-center gap-2 text-small text-fg-primary">
      <input
        type="checkbox"
        checked={confirmedStaleReconcile}
        onChange={(e) => setConfirmedStaleReconcile(e.target.checked)}
        data-testid="edit-basic-data-confirm-stale-reconcile"
      />
      위 학생 명단 제거를 확인합니다
    </label>
  </div>
)}
```

**submit 버튼 disabled 조건 확장**:
```tsx
disabled={isPending || (staleWarnings.length > 0 && !confirmedStaleReconcile)}
```

**주의**:
- 이전 확인 상태 유지 (grades 다시 편집 시 warning 재계산 필요) — grades 변경 시 `setStaleWarnings([])` + `setConfirmedStaleReconcile(false)` reset.

#### Commit 1 테스트

**web `EditBasicDataDialog.test.tsx`** (2 신규):
1. initialData rosters 에 반 X (grades 에 없음) → 첫 submit 클릭 → warning 표시, saveBasicData 미호출.
2. confirm 체크 → 재 submit → saveBasicData 호출, payload rosters 에 stale 제거된 상태.

#### Commit 2: P8 whitespace strict

**`shared/src/basicData.ts` validator 강화**:

기존 (v0.69):
```ts
for (const g of obj.grades) {
  if (g.grade <= 0) return false;
  const classSet = new Set<string>();
  for (const c of g.classes) {
    if (typeof c !== 'string' || c.length === 0) return false;
    const key = c.trim();
    if (classSet.has(key)) return false;
    classSet.add(key);
  }
}
```

**추가 규칙** — `c === c.trim()` 강제:
```ts
for (const c of g.classes) {
  if (typeof c !== 'string' || c.length === 0) return false;
  if (c !== c.trim()) return false;   // leading/trailing whitespace 금지
  if (classSet.has(c)) return false;   // 원본으로 uniqueness 검사 (trim 이후 = 원본)
  classSet.add(c);
}
```

**rosters 참조 일관성 검증** — `c.trim()` 대신 원본 그대로 사용 (whitespace 이미 rejected 이므로 안전):
```ts
gradeToClasses.set(String(g.grade), new Set(g.classes));
```

departments 도 동일 규칙:
```ts
if (obj.departments !== undefined) {
  if (!obj.departments.every((d) => typeof d === 'string' && d.length > 0 && d === d.trim())) return false;
}
```

#### Commit 2 테스트

**`shared/tests/basicData.test.ts`** (2 신규):
- classes = [' A '] → invalid.
- classes = ['A '] (trailing) → invalid.
- departments = [' 국어과'] → invalid.

**`functions/tests/basicDataSet.test.ts`** (1 신규):
- whitespace class 이름 요청 → invalid-argument, error audit.

기존 시나리오 회귀 유지 — 특히 basicData v0.56·v0.57 저장 시 반 이름에 space 있었으면 이제 실패 (실 데이터 확인 필요, 없을 것으로 예상).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 617 + 신규 5 = 622 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 학년 삭제 · 반 이름 변경 → warning 표시 + confirm 필요
   - confirm 후 저장 → 학생 명단 자동 제거 (해당 반)
   - 반 이름 앞뒤 공백 → 저장 실패 안내
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **audit MAX_LIMIT 200 cap (P9)** — v0.71 별도 (백엔드 change).
- **class 이름 정규화 자동** — 사용자에게 명확한 오류 표시 후 수동 fix (자동 trim 은 데이터 손실 UX).

### 커밋 규칙

**2 커밋 분리**:
1. `fix(web): EditBasicDataDialog stale roster reconcile + 삭제 경고 (Codex 재감사 P7)`
2. `fix(shared,functions): basic_data class/dept 이름 leading/trailing whitespace 금지 (Codex 재감사 P8)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/codex-audit-p7-p8-v70`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
