# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex 감사 hotfix v0.69** — P3 validator 강화 + P5·P6 감사 24h rolling window (calendar-day 로 통일).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/codex-audit-p3-p5-p6-v69`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `c8448d9` (Codex hotfix v0.68)

## 지금 할 것 — P3 + P5 + P6 hotfix

### 왜

Codex 감사 실패 잔여 3건:

**P3 shared validator 부족** (`packages/shared/src/basicData.ts:27`):
> validator 가 shape 만 확인해 0/음수 학년, 중복 학년·반, grades 에 없는 rosters 학년/반 을 허용

**P5 super_admin 최근 24시간 이벤트 KPI 불일치** (`packages/web/src/routes/super_admin/index.tsx:14`):
> 최근 50 로그만 client 에서 카운트 → 50 초과 시 과소 집계 · drill-down 은 오늘 00:00 atMin 사용 → KPI 숫자와 결과 범위 불일치

**P6 AuditLogTable "지난 24시간" 프리셋 라벨 vs query 불일치** (`packages/web/src/routes/super_admin/AuditLogTable.tsx:94`):
> 어제 00:00 atMin 을 넣어 실제 24~48h 범위 · 라벨과 query 의미 불일치

**해결 방향**: URL 파라미터가 YYYY-MM-DD (date-string) 이라 정확한 rolling window 표현 불가. **calendar-day 시맨틱으로 통일** — 라벨을 실 query 에 맞춤:
- "최근 24시간 이벤트" → "오늘 이벤트" (atMin = 오늘 00:00)
- "지난 24시간" → "오늘" (atMin = 오늘 00:00)

또한 P5 count 정확성을 위해 KPI 는 자체 useAuditLogList 호출 (limit 500, atMin=todayStart) 로 분리.

**하지 않는 것**: 새 count callable (별도 slice). URL 파라미터 ms 확장 (별도 slice). 기존 데이터 마이그레이션 (validator 강화 후 admin 수동 fix).

### 이 과제가 바꿀 경로

**Commit 1 (P3 validator 강화)**:
- `packages/shared/src/basicData.ts` — validator: positive grade + unique grades + unique classes-per-grade + rosters keys in grades
- `packages/shared/tests/basicData.test.ts` — 시나리오 4~5 (각 제약 위반)
- `packages/functions/tests/basicDataSet.test.ts` — 시나리오 확장 (invalid case)

**Commit 2 (P5 · P6 calendar-day 통일)**:
- `packages/web/src/routes/super_admin/index.tsx` — KPI 라벨 "오늘 이벤트" + 별도 useAuditLogList(500, atMin=todayStart)
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — 프리셋 라벨 "지난 24시간" → "오늘", 정의도 today 00:00 로 통일
- `packages/web/tests/SuperAdminPage.test.tsx` — 시나리오 라벨 조정 + count fetch 확인
- `packages/web/tests/AuditLogTable.test.tsx` — 프리셋 라벨 조정 시나리오

**손대지 마라**:
- readAudit · audit/list callable (기존 그대로).
- EditBasicDataDialog · AutoCreate 등 (v0.68 fix 유지).
- 다른 라우트 · Firestore 인덱스.

### 세부 요구

#### Commit 1: shared validator 강화

기존 (`packages/shared/src/basicData.ts:13-35`):
```ts
export function isValidBasicDataYear(input: unknown): input is BasicDataYear {
  if (!input || typeof input !== 'object') return false;
  const obj = input as any;
  if (typeof obj.year !== 'number' || ... obj.year < 1900 || obj.year > 2200) return false;
  if (!Array.isArray(obj.grades)) return false;
  for (const g of obj.grades) {
    if (typeof g.grade !== 'number' || ...) return false;
    if (!Array.isArray(g.classes)) return false;
    if (!g.classes.every((c) => typeof c === 'string' && c.length > 0)) return false;
  }
  // departments · rosters 검증 있음
  return true;
}
```

**강화 규칙 추가** — grade 반복문 안:
```ts
// 학년 은 양의 정수
if (g.grade <= 0) return false;
// 반 이름 중복 금지 (한 학년 안)
const classSet = new Set<string>();
for (const c of g.classes) {
  if (typeof c !== 'string' || c.length === 0) return false;
  const key = c.trim();
  if (classSet.has(key)) return false;
  classSet.add(key);
}
```

**학년 중복 금지** — 반복문 밖:
```ts
const gradeSet = new Set<number>();
for (const g of obj.grades) {
  if (gradeSet.has(g.grade)) return false;
  gradeSet.add(g.grade);
}
```

*(위 두 for 문 통합 가능.)*

**rosters keys grades 참조 일관성** — rosters 검증 확장:
```ts
if (obj.rosters !== undefined) {
  // ... 기존 shape 검증 ...
  const validGradeKeys = new Set(obj.grades.map((g: any) => String(g.grade)));
  const gradeToClasses = new Map<string, Set<string>>();
  for (const g of obj.grades) {
    gradeToClasses.set(String(g.grade), new Set(g.classes.map((c: string) => c.trim())));
  }
  for (const gradeKey of Object.keys(obj.rosters)) {
    if (!validGradeKeys.has(gradeKey)) return false;   // 존재 안 하는 학년
    const gradeRoster = obj.rosters[gradeKey];
    const validClasses = gradeToClasses.get(gradeKey)!;
    for (const classKey of Object.keys(gradeRoster)) {
      if (!validClasses.has(classKey)) return false;   // 존재 안 하는 반
    }
  }
}
```

**주의**:
- 기존 데이터 (validator 통과했던) 는 backward compat — 방금 강화된 규칙 위반 시 저장만 실패, read 는 여전히 가능 (get.ts 는 validator 안 씀).
- EditBasicDataDialog 는 서버 응답 오류 표시 (기존 mutationError 경로).

#### Commit 1 테스트

`packages/shared/tests/basicData.test.ts` 확장:
1. grade = 0 → invalid.
2. grade = -1 → invalid.
3. 중복 grade → invalid.
4. 반 이름 중복 (같은 학년 안) → invalid.
5. rosters grade key 가 grades 에 없음 → invalid.
6. rosters class key 가 해당 학년의 classes 에 없음 → invalid.

`packages/functions/tests/basicDataSet.test.ts` — 위 규칙 위반 시나리오 1개 (백엔드 rejection 확인).

기존 회귀 유지.

#### Commit 2: 감사 · 대시보드 calendar-day 통일

**`super_admin/index.tsx`**:

기존:
```ts
const audit = useAuditLogList(50);
const dayAgo = now - 24 * 60 * 60 * 1000;
const recentEvents = audit.entries.filter((e) => e.at >= dayAgo);
```

변경:
```ts
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayStartMs = todayStart.getTime();

// 오늘 이벤트 KPI 는 정확한 count 를 위해 별도 useAuditLogList
const todayAudit = useAuditLogList(500, { atMin: todayStartMs });
const todayCount = todayAudit.entries.length;
// 미리보기용 최근 5 개는 기존 audit.entries.slice(0, 5) 유지 (별도 hook)
const audit = useAuditLogList(50);
```

**KPI 라벨 · nav 변경**:
```tsx
<KpiCard
  label="오늘 이벤트"
  value={todayCount}
  loading={todayAudit.loading}
  href="nav"
  onClick={() => navigate(`/super_admin/audit?atMin=${todayIso}`)}
/>
```

*(기존 KPI 4개 중 「최근 24시간 이벤트」 를 「오늘 이벤트」 로 · value·loading·onClick 변경.)*

**`AuditLogTable.tsx`** — 프리셋 리스트 첫 항목 변경:
```ts
const presets = [
  { key: 0 as const, label: '오늘' },      // ← 기존 { key: 1, label: '지난 24시간' } 대체
  { key: 7 as const, label: '지난 7일' },
  { key: 30 as const, label: '지난 30일' },
  { key: 'all' as const, label: '전체' },
];
```

`handlePreset` 도 key=0 이면 오늘 00:00 (즉 `setDate(getDate() - 0)` = today) 로:
```ts
if (days === null) {
  next.delete('atMin');
  next.delete('atMax');
} else {
  const d = new Date();
  d.setDate(d.getDate() - days);   // days=0 → today, days=7 → 7 days ago, ...
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  next.set('atMin', `${yyyy}-${mm}-${dd}`);
  next.delete('atMax');
}
```

`activePreset` 계산도 `check(days)` 로:
```ts
if (check(0)) return 0;
if (check(7)) return 7;
if (check(30)) return 30;
```

**testid 유지**: `audit-log-preset-0` (기존 `audit-log-preset-1` 아니라 0). 기존 테스트 파일도 조정.

**주의**:
- 기존 URL 파라미터 `?atMin=YYYY-MM-DD` 그대로 (오늘 = 오늘 00:00 부터).
- 「오늘」 클릭 = 오늘 00:00 부터 지금까지. KPI 「오늘 이벤트」 와 정확히 일치.
- 「지난 7일」 = 7일 전 00:00 부터 오늘 23:59:59 (기존과 동일).

#### Commit 2 테스트

`packages/web/tests/SuperAdminPage.test.tsx`:
- KPI 라벨 「오늘 이벤트」 로 변경 반영.
- useAuditLogList mock 2 개 (todayAudit + audit) — todayAudit 이 atMin 파라미터 받아 호출됨.
- 4 KPI nav 시나리오 (v0.39) 는 「오늘 이벤트」 → `/super_admin/audit?atMin=YYYY-MM-DD` 오늘 iso.

`packages/web/tests/AuditLogTable.test.tsx`:
- 「지난 24시간」 → 「오늘」 라벨 변경.
- testid `audit-log-preset-1` → `audit-log-preset-0` 변경.
- 프리셋 클릭 시 atMin 이 오늘 iso 로 설정 확인.

기존 회귀 유지 — 「지난 7일」, 「지난 30일」, 「전체」 는 그대로.

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 610 + 신규 6~8 = 616~618 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - super_admin 대시보드 「오늘 이벤트」 KPI (정확한 count)
   - 클릭 → /super_admin/audit?atMin=오늘 이동 · 결과 개수 일치
   - AuditLogTable 「오늘」 프리셋 클릭 → 같은 결과
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **rolling 24h 정확도** — URL 은 date-string, 정확한 24h 단위는 URL 확장 필요 (별도 slice).
- **기존 데이터 마이그레이션** — validator 강화 후 admin 이 수동 fix 필요.
- **KPI 500 초과 count** — 별도 count callable (별도 slice).

### 커밋 규칙

**2 커밋 분리**:
1. `fix(shared,functions): basic_data validator 강화 (positive grade · unique · rosters 참조 · Codex 감사)`
2. `fix(web): super_admin KPI · AuditLogTable 프리셋 calendar-day 통일 (Codex 감사)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/codex-audit-p3-p5-p6-v69`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
