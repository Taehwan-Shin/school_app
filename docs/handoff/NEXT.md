# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data 백엔드 v0.45** — Firestore `basic_data/{year}` 스키마 정의 + `basicData.get` / `basicData.set` callable. Google API 불필요, 새 스코프 없음. Cap 은 이미 shared 에 등록됨.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-backend-v45`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `26ac925` (일괄 조직 이동 v0.44)

## 지금 할 것 — basic_data 최소 스키마 + 2 callable

### 왜

DESIGN v1 (`docs/DESIGN_v1.md`) 은 `basic_data/{year}` 를 「원본 「기초값」 시트 대체 (학년·반·부서 구조)」 로 정의. 아직 미구현. 그룹 생성·사용자 OU 결정·클래스룸 이름 생성 등에서 참조할 중심 데이터. Google Directory API 불필요 — Firestore only, 이번 세션 릴레이의 유일한 「외부 API 활성화 필요 없음」 미개척 도메인.

**하지 않는 것**:
- 이번 슬라이스에서 프론트엔드 UI (v0.46 후보).
- 부서 (departments) · 학생 명단 — 최소 스키마 (grades + classes) 만.
- 다중 연도 동시 편집 · 히스토리 — 단일 연도 upsert 만.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/shared/src/basicData.ts` — `BasicDataYear` 인터페이스 + validator
- `packages/functions/src/callable/basicData/get.ts` — get callable
- `packages/functions/src/callable/basicData/set.ts` — set callable (upsert + audit)
- `packages/functions/tests/basicDataGet.test.ts` — 시나리오 4~5
- `packages/functions/tests/basicDataSet.test.ts` — 시나리오 6~8

**수정 대상**:
- `packages/shared/src/index.ts` — `export * from './basicData.js';`
- `packages/functions/src/index.ts` — `basicDataGet` · `basicDataSet` export
- `firebase.json` — hosting rewrite 2 개 (`/api/basicDataGet`, `/api/basicDataSet`)

**손대지 마라**:
- `roleCapabilities.ts` — 이미 `basic_data.read`·`basic_data.write` 등록됨 (`packages/shared/src/capabilities.ts:17-18`).
- 프론트엔드 (`packages/web/**`) — v0.46 후보.
- 다른 callable · middleware · audit helpers.

### 세부 요구

#### 1. `packages/shared/src/basicData.ts` — 스키마

```ts
export interface BasicDataGradeClass {
  grade: number;         // 1, 2, 3, ...
  classes: string[];     // ['A', 'B', 'C', ...]
}

export interface BasicDataYear {
  year: number;                        // 예: 2026
  grades: BasicDataGradeClass[];
  updatedAt?: number;                  // ms since epoch (서버 timestamp)
  updatedBy?: string;                  // actor email
}

export function isValidBasicDataYear(input: unknown): input is BasicDataYear {
  if (!input || typeof input !== 'object') return false;
  const obj = input as any;
  if (typeof obj.year !== 'number' || !Number.isFinite(obj.year) || obj.year < 1900 || obj.year > 2200) {
    return false;
  }
  if (!Array.isArray(obj.grades)) return false;
  for (const g of obj.grades) {
    if (!g || typeof g !== 'object') return false;
    if (typeof g.grade !== 'number' || !Number.isFinite(g.grade)) return false;
    if (!Array.isArray(g.classes)) return false;
    if (!g.classes.every((c: unknown) => typeof c === 'string' && c.length > 0)) return false;
  }
  return true;
}
```

`packages/shared/src/index.ts` 에 export 추가.

#### 2. `basicData/get.ts` — Firestore 조회

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';
import type { BasicDataYear } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';

export interface BasicDataGetRequest {
  year: number;
}

export interface BasicDataGetResponse {
  data: BasicDataYear | null;   // 없으면 null
}
```

**로직**:
- authenticate → assertHasCap('basic_data.read')
- `year` 파싱 (숫자, 1900~2200 범위)
- Firestore: `db.collection('basic_data').doc(String(year)).get()`
- 존재 → data 반환. 없음 → null.
- audit: action `'basic_data.read'`, target `basic_data/{year}`, message `read basic_data for year ${year} (${exists ? 'exists' : 'not found'})`.

**주의**:
- denied audit (auth 실패 / cap 실패) 는 기존 다른 callable 패턴 (`packages/functions/src/callable/audit/list.ts:40-72`) 그대로 복사.
- Google API 스코프 없음 → `assertHasScopes` 안 부름.
- 반환 시 `updatedAt` 은 Firestore Timestamp → ms 변환.

#### 3. `basicData/set.ts` — Firestore upsert

```ts
export interface BasicDataSetRequest {
  year: number;
  grades: BasicDataGradeClass[];
}

export interface BasicDataSetResponse {
  year: number;
  updatedAt: number;
}
```

**로직**:
- authenticate → assertHasCap('basic_data.write')
- `data` validate: `isValidBasicDataYear({ year, grades })` — invalid 이면 `HttpsError('invalid-argument', 'invalid_basic_data')`
- Firestore: `db.collection('basic_data').doc(String(year)).set({ year, grades, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.email }, { merge: false })`
  - `merge: false` — 전체 덮어쓰기 (upsert)
- 서버 timestamp 얻기 위해 다시 read 하거나 클라이언트가 신뢰: 이번은 `Date.now()` 를 응답 (Firestore serverTimestamp 는 실 저장 시각 반영 — 응답값과 미묘 차이 있을 수 있지만 이번 슬라이스 밖).
- audit: action `'basic_data.write'`, target `basic_data/{year}`, message `set basic_data for year ${year} with ${grades.length} grades`.

#### 4. `functions/src/index.ts` — export 추가

```ts
export { basicDataGet } from './callable/basicData/get.js';
export { basicDataSet } from './callable/basicData/set.js';
```

#### 5. `firebase.json` — hosting rewrite

기존 `/api/auditLogList` 다음에 (rewrites 배열, `**` fallback 앞에):
```json
{
  "source": "/api/basicDataGet",
  "function": { "functionId": "basicDataGet", "region": "asia-northeast3" }
},
{
  "source": "/api/basicDataSet",
  "function": { "functionId": "basicDataSet", "region": "asia-northeast3" }
}
```

#### 6. 테스트

**functions `basicDataGet.test.ts`** (4~5 시나리오):
1. 미인증 → `unauthenticated`, denied audit
2. 캡 부족 (teacher role) → `permission-denied`, denied audit
3. year 유효하지 않음 (문자열 등) → `invalid-argument`, error audit
4. 존재 문서 → data 반환, ok audit
5. 존재 안 함 → data null, ok audit

**functions `basicDataSet.test.ts`** (6~8 시나리오):
1. 미인증 → denied
2. 캡 부족 (teacher) → denied
3. year 없음/유효하지 않음 → invalid-argument
4. grades 배열 형식 오류 → invalid-argument
5. classes 안에 빈 문자열 → invalid-argument
6. 정상 (신규 문서 생성) → response ok, Firestore 에 저장 확인, ok audit
7. 정상 (기존 문서 덮어쓰기) → 이전 데이터 사라짐, 새 데이터 확인
8. admin role 성공 (super_admin 아니어도 basic_data.write 있음) → ok

Firestore mock 패턴 은 기존 `auditLogList.test.ts` (`packages/functions/tests/auditLogList.test.ts`) 참고.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과 (`packages/functions/dist/callable/basicData/get.js` · `set.js` 생성).
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 501 + 신규 10~13 = 511~514 근처.
5. `pnpm -r test:emu` — 이전 43 유지 (신규 emu 없음).
6. dev 서버 확인 (수동):
   - Firestore 에뮬레이터에서 `basic_data/2026` 문서 없음
   - basicDataGet 호출 → null 반환
   - basicDataSet 호출 → 문서 생성
   - basicDataGet 재호출 → 방금 저장한 데이터 반환
7. 프로덕션 번들 grep — 우리 emulator URL 0 건 (백엔드만이므로 web 번들 변경 없음).

### 판정 불가

- **프론트엔드 UI** — v0.46 후보 (edit form + admin 페이지 통합).
- **부서 · 학생 명단** — 최소 스키마 밖.
- **연도 삭제** — 별도 slice (필요 시).
- **다중 학교 지원** — 지금은 단일 도메인 (cam.hs.kr) 만.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(shared,functions): basicData.get callable + BasicDataYear 스키마 + hosting rewrite`
2. `feat(functions): basicData.set callable (upsert + audit) + hosting rewrite`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-backend-v45`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
