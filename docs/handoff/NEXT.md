# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data 학생 명단 스키마 v0.56** — `rosters?: Record<gradeStr, Record<class, string[]>>` 필드 추가. 백엔드만 (프론트 UI 는 v0.57).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-rosters-backend-v56`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `c233f99` (listYears 캐시 무효화 v0.55)

## 지금 할 것 — rosters 필드 (백엔드)

### 왜

basic_data 는 지금 학년/반 구조만. 「이 반에 누가 있는지」 는 별도 저장. 향후 자동 초대 (v0.58+ 후보) 를 위해 학생 명단 스키마 필요. **이번 슬라이스는 백엔드만** — 스키마 · validator · get/set 매핑 · 테스트. UI 는 v0.57.

**하지 않는 것**:
- 프론트 UI (rosters 편집 form) — v0.57 후보.
- 학생 자동 초대 (그룹 생성 시 rosters 자동 추가) — v0.58+ 후보.
- 학생 이메일 검증 (도메인 · 형식) — 기본 non-empty string 만.
- 학생 이동 (반 A → B) UI — 별도 slice.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/shared/src/basicData.ts` — `rosters?` 필드 + validator 확장
- `packages/shared/tests/basicData.test.ts` — 시나리오 3 (undefined · 유효 · 무효)
- `packages/functions/src/callable/basicData/get.ts` — 읽을 때 rosters 매핑
- `packages/functions/src/callable/basicData/set.ts` — 저장할 때 rosters 매핑
- `packages/functions/tests/basicDataSet.test.ts` — 시나리오 2 (rosters 저장 · 무효 값 reject)
- `packages/functions/tests/basicDataGet.test.ts` — 시나리오 1 (rosters 반환)
- `packages/web/src/api/basicDataSet.ts` — request 타입에 `rosters?`

**손대지 마라**:
- BasicDataPanel · EditBasicDataDialog · AutoCreate* — 그대로 (UI 는 v0.57).
- 다른 callable · 라우트.

### 세부 요구

#### 1. 스키마 (`shared/src/basicData.ts`)

```ts
export interface BasicDataYear {
  year: number;
  grades: BasicDataGradeClass[];
  departments?: string[];
  rosters?: Record<string, Record<string, string[]>>;   // rosters[gradeStr][class] = [studentEmail, ...]
  updatedAt?: number;
  updatedBy?: string;
}
```

**validator 확장** (기존 departments 검증 다음에):
```ts
if (obj.rosters !== undefined) {
  if (typeof obj.rosters !== 'object' || obj.rosters === null || Array.isArray(obj.rosters)) return false;
  for (const gradeKey of Object.keys(obj.rosters)) {
    // 학년 키는 숫자 문자열 ("1", "2", ...)
    if (!/^\d+$/.test(gradeKey)) return false;
    const gradeRoster = obj.rosters[gradeKey];
    if (typeof gradeRoster !== 'object' || gradeRoster === null || Array.isArray(gradeRoster)) return false;
    for (const classKey of Object.keys(gradeRoster)) {
      // 반 키는 non-empty string
      if (typeof classKey !== 'string' || classKey.length === 0) return false;
      const students = gradeRoster[classKey];
      if (!Array.isArray(students)) return false;
      if (!students.every((s: unknown) => typeof s === 'string' && s.trim().length > 0)) return false;
    }
  }
}
```

**주의**:
- optional — undefined 허용 (기존 backward compat).
- 빈 객체 (`{}`) 유효.
- 학년 키는 반드시 숫자 문자열 (편의).
- 학생 이메일 형식 검증 안 함 (도메인 강제는 별도 slice).

#### 2. shared 테스트 (3 신규)

1. rosters undefined → 유효 (backward compat).
2. rosters = `{"1": {"A": ["s1@cam.hs.kr", "s2@cam.hs.kr"]}, "2": {"B": []}}` → 유효.
3. rosters = `{"invalid_key": {}}` → 무효 (숫자 문자열 아님).
4. (bonus) rosters 안 학생에 빈 문자열 → 무효.

기존 회귀 유지.

#### 3. `get.ts` — 읽을 때 매핑

기존 (`packages/functions/src/callable/basicData/get.ts:110-116`):
```ts
const basicData: BasicDataYear = {
  year: ...,
  grades: ...,
  ...(Array.isArray(docData?.departments) ? { departments: docData.departments } : {}),
  ...(updatedAt !== undefined ? { updatedAt } : {}),
  ...(typeof docData?.updatedBy === 'string' ? { updatedBy: docData.updatedBy } : {}),
};
```

확장 (departments 다음 줄):
```ts
...(docData?.rosters && typeof docData.rosters === 'object' && !Array.isArray(docData.rosters)
  ? { rosters: docData.rosters }
  : {}),
```

**주의**:
- Firestore 저장 형식과 반환 형식 동일 (Record shape 유지).
- 배열/null 방어.

#### 4. `set.ts` — 저장할 때 매핑

기존 upsert (`packages/functions/src/callable/basicData/set.ts:86-97`):
```ts
await db
  .collection('basic_data')
  .doc(String(year))
  .set(
    {
      year,
      grades,
      ...(basicData.departments !== undefined ? { departments: basicData.departments } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.email,
    },
    { merge: false },
  );
```

*(현재 코드는 조금 다를 수 있음 — 실 파일에서 departments 매핑 부분 근처에 rosters 추가.)*

확장:
```ts
...(basicData.rosters !== undefined ? { rosters: basicData.rosters } : {}),
```

**주의**:
- validator 가 이미 통과했으므로 rosters shape 안전.
- undefined 는 저장 안 함 (backward compat — 기존 문서 편집 시 rosters 없어도 지워지지 않게).
- `merge: false` 이므로 rosters 없으면 완전 삭제 — 실은 이게 의도? admin 이 명시적으로 rosters 없이 저장 = rosters 삭제. 이 시맨틱 유지.

#### 5. `basicDataSet.test.ts` (2 신규)

1. request 에 `rosters: {"1": {"A": ["s@cam.hs.kr"]}}` → Firestore.set 호출 인자에 rosters 포함 확인.
2. `rosters: {"invalid_key": {}}` (숫자 문자열 아님) → invalid-argument, error audit.

#### 6. `basicDataGet.test.ts` (1 신규)

- Firestore mock 이 rosters 포함 문서 반환 → response `data.rosters` 로 그대로 전달됨.

#### 7. `basicDataSet.ts` — request 타입

```ts
export interface BasicDataSetRequest {
  year: number;
  grades: BasicDataGradeClass[];
  departments?: string[];
  rosters?: Record<string, Record<string, string[]>>;
}
```

기존 fetch body 로 자동 전달됨 (spread `...data`).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 568 + 신규 6~7 = 574~575 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인 (수동 · UI 는 v0.57):
   - Firestore 에뮬레이터에서 rosters 필드 있는 문서 저장 후 조회 시 그대로 반환.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **UI 편집 폼** — v0.57 후보 (반별 학생 이메일 목록 편집).
- **학생 자동 초대** — v0.58+ 후보.
- **이메일 도메인 검증 (`@cam.hs.kr` 강제)** — 별도 slice, 지금은 non-empty string.

### 커밋 규칙

**1 커밋**:
- `feat(shared,functions,web): basic_data 에 rosters 필드 추가 (백엔드 스키마)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-rosters-backend-v56`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
