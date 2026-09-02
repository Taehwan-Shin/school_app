# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 v4 (서버 사이드 필터) v0.26** — `readAudit` 헬퍼와 `auditLog.list` callable 을 확장해 서버 사이드 actor·target·result 필터 지원. 클라이언트는 request 에 filter 파라미터 전달. 프론트엔드 UI 는 v0.27 에서 확장.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-log-v4-v26`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

**writeAudit 규율**: audit_log 접근 헬퍼 확장. ESLint 예외 목록 (`readAudit.ts`) 그대로.

## 기준 커밋

**Base**: `65b0aa8` (super_admin 대시보드 v0.25)

## 지금 할 것 — 감사 로그 서버 사이드 필터

### 왜

v0.22/v0.24 로 클라이언트 사이드 필터를 놓았지만 audit_log 가 커지면 (수천~수만 건) 로드된 페이지에만 필터 적용됨. 실 감사 사용 시 「이 사용자에 대한 모든 이벤트」 를 정확히 보려면 서버가 미리 필터해서 페이지네이션 유지해야 함.

**하지 않는 것**: 프론트엔드 UI 갱신 (v0.27 로 미룸). 새 audit action 필터. 복합 필터 3 개 동시 (Firestore 인덱스 필요 — 별도 slice).

**허용하는 조합**: actor / target / result 중 최대 2 개 동시 필터. actor+result 조합은 이미 Firestore 단일 필드 인덱스로 처리 가능. target+at, actor+at 는 자동 복합 인덱스.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/audit/readAudit.ts` — `ReadAuditEntriesOptions` 에 filter 필드 추가. Firestore where 체인.
- `packages/functions/src/callable/audit/list.ts` — `AuditLogListRequest` 에 filter 추가, `readAuditEntries` 로 전달, audit message 에 필터 반영.
- `packages/functions/tests/readAudit.test.ts` — 필터 시나리오 3 추가.
- `packages/functions/tests/auditLogList.test.ts` — 필터 시나리오 3 추가.
- `packages/web/src/api/auditLogList.ts` — 인터페이스 확장 (backward compatible).
- `firestore.indexes.json` — 복합 인덱스 추가 (`target,at` + `actor,at` + `result,at`).

**신규 파일**: 없음.

**손대지 마라**:
- `AuditLogTable.tsx` · 프론트엔드 UI — v0.27.
- 다른 callable · middleware · writeAudit.

### 세부 요구

#### 1. `readAudit.ts` 확장

```ts
export interface ReadAuditEntriesOptions {
  limit: number;
  before?: number;
  // 신규 필터 (조합 허용, 하지만 클라이언트는 최대 2 개 조합만 보내는 것이 안전):
  filterActor?: string;    // 정확 매치
  filterTarget?: string;   // 정확 매치
  filterResult?: 'ok' | 'error' | 'denied';
}
```

**구현** — Firestore `.where()` 체인. 각 필터가 있으면 추가:
```ts
let query: FirebaseFirestore.Query = db.collection('audit_log').orderBy('at', 'desc');
if (before !== undefined) {
  query = query.where('at', '<', Timestamp.fromMillis(before));
}
if (filterActor) {
  query = query.where('actor', '==', filterActor);
}
if (filterTarget) {
  query = query.where('target', '==', filterTarget);
}
if (filterResult) {
  query = query.where('result', '==', filterResult);
}
query = query.limit(limit);
```

**주의 (Firestore 제약)**:
- `orderBy('at', 'desc')` + `where('at', '<', ...)` + `where('actor', '==', ...)` — 복합 인덱스 필요.
- `firestore.indexes.json` 에 명시적 등록 (다음 항목).

#### 2. `firestore.indexes.json` — 복합 인덱스 등록

기존 파일에 다음 인덱스 3 개 추가 (audit_log 컬렉션):
```json
{
  "collectionGroup": "audit_log",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "actor", "order": "ASCENDING" },
    { "fieldPath": "at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "audit_log",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "target", "order": "ASCENDING" },
    { "fieldPath": "at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "audit_log",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "result", "order": "ASCENDING" },
    { "fieldPath": "at", "order": "DESCENDING" }
  ]
}
```

**배포 시 참고**: `firebase deploy --only firestore:indexes` 필요 (헤드가 자동 배포 시 hosting,functions 만 이었음). 이번 슬라이스 배포 후 헤드가 별도로 실행.

#### 3. `auditLog.list` callable 확장

**입력 스키마**:
```ts
export interface AuditLogListRequest {
  limit?: number;
  before?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}
```

**readAuditEntries 호출**: 위 파라미터 그대로 전달.

**성공 audit message** (기존 message 확장):
```ts
const filters = [];
if (filterActor) filters.push(`actor=${filterActor}`);
if (filterTarget) filters.push(`target=${filterTarget}`);
if (filterResult) filters.push(`result=${filterResult}`);
const filterStr = filters.length > 0 ? ` [${filters.join(', ')}]` : '';
message: `read ${result.entries.length} entries (limit ${limit}${before ? `, before ${before}` : ''})${filterStr}`,
```

#### 4. `packages/web/src/api/auditLogList.ts` — 타입 확장

`AuditLogListRequest` 에 3 필드 추가 (optional). `useAuditLogList` hook 은 이번 슬라이스에서는 기존 시그니처 그대로 (v0.27 에서 필터 전달 추가 예정).

**변경**:
```ts
export interface AuditLogListRequest {
  limit?: number;
  before?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
}
```

#### 5. 테스트

**`readAudit.test.ts`** 신규 3:
1. `filterActor='super@cam.hs.kr'` → Firestore `where` 체인 확인 (mock spy on `.where`)
2. `filterTarget + filterResult` 조합 → 두 where 호출 확인
3. 필터 없음 → 기존 동작 그대로 (backward compat)

**`auditLogList.test.ts`** 신규 3:
1. `filterActor` 전달 시 `readAuditEntries` 에 그대로 전달 확인
2. 성공 audit message 에 필터 정보 포함 확인
3. 필터 없이 호출 시 기존 동작 그대로

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 393 + 신규 6 = 399 근처.
5. `pnpm -r test:emu` — 이전 43 유지 (신규 emu 없음, 기존 emu 는 필터 안 씀).
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **실 Firestore 복합 인덱스 활성화** — 헤드가 `firebase deploy --only firestore:indexes` 실행 후 자동 index 빌드. 실 사용 전 인덱스 활성 확인.
- **3-way 필터 조합** — 별도 인덱스 필요, 이번 슬라이스 밖.
- **필터 값 검증** — `filterActor` · `filterTarget` 에 특수 문자 · injection 있으면 Firestore 가 처리. 우리 코드 별도 sanitize 안 함.
- **프론트엔드 UI** — v0.27.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): readAudit 에 actor·target·result 필터 지원`
2. `feat(functions): auditLog.list callable 에 필터 파라미터 전달 + 감사 message 확장`
3. `chore(firestore): audit_log 복합 인덱스 3 개 (actor·target·result + at desc)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-log-v4-v26`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
