# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 뷰어 백엔드 v0.9** — `auditLog.list` callable 신설 (super_admin 전용). 지금까지 모든 slice 가 `writeAudit` 로 audit_log 에 쌓아온 기록을 조회할 수 있게 함.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-log-list-v9`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3 개로 분리.

**중요 (audit_log 접근 규율)**: 이번 슬라이스는 audit_log 를 **읽는** 첫 코드다. `no-restricted-syntax` ESLint 규칙이 `src/**/*.ts` 안의 `.collection('audit_log')` 를 전면 금지 중이라 (`writeAudit.ts` 만 예외), 새 헬퍼 `readAudit.ts` 를 만들고 ESLint 예외 목록에 추가해야 함.

## 기준 커밋

**Base**: `e65a5f7` (users.update UI v0.8 병합 커밋)

## 지금 할 것 — auditLog.list callable (super_admin 전용)

### 왜

지금까지 8 개 슬라이스 (users.list/create/delete/update + UI 4) 가 모두 `writeAudit` 를 통해 Firestore `audit_log` 컬렉션에 실패·성공 로그를 남겼다. 그런데 이 데이터를 조회할 UI 가 없어서:
1. 관리자가 「누가 언제 뭘 삭제했는지」 확인할 방법이 없음.
2. 보안 사건 조사 시 데이터베이스 콘솔에 직접 접근해야 함.
3. 지금까지 심혈을 기울인 audit 무결성 작업의 가치가 사용자에게 안 보임.

**이 슬라이스 (백엔드)**: `auditLog.list` callable — super_admin (audit.read cap) 만 호출 가능. 페이지네이션 지원. 프론트엔드 뷰어는 v0.10 에서.

**하지 않는 것**: 감사 로그 필터링 (action·actor·target 별 검색) — 다음 슬라이스. 감사 로그 export — 다음 슬라이스. 프론트엔드 UI — v0.10.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/eslint.config.js` — `no-restricted-syntax` 예외 목록에 `src/audit/readAudit.ts` 추가.
- `packages/functions/src/index.ts` — `auditLogList` export 추가.

**신규 파일**:
- `packages/functions/src/audit/readAudit.ts` — audit_log 조회 헬퍼 (ESLint 예외 대상).
- `packages/functions/src/callable/audit/list.ts` — 새 callable.
- `packages/functions/tests/auditLogList.test.ts` — 단위 테스트 8~10 개.
- `packages/functions/tests/auditLogList.emu.test.ts` — emu HTTP 통합 테스트 3 개.

**손대지 마라**:
- `packages/functions/src/audit/writeAudit.ts` — 헬퍼 그대로.
- 다른 callable · directoryClient · authz — 이 슬라이스 밖.
- `packages/web/*` — v0.10 에서 (프론트엔드는 별도 슬라이스).

### 세부 요구

#### 1. `packages/functions/eslint.config.js` — 예외 추가

기존:
```js
{
  files: ['src/audit/writeAudit.ts'],
  rules: { 'no-restricted-syntax': 'off' },
},
```

변경:
```js
{
  files: ['src/audit/writeAudit.ts', 'src/audit/readAudit.ts'],
  rules: { 'no-restricted-syntax': 'off' },
},
```

#### 2. `packages/functions/src/audit/readAudit.ts` (신규)

`writeAudit.ts` 패턴 참고. 인터페이스:

```ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export interface AuditLogEntryRead {
  id: string;                  // Firestore doc ID
  actor: string;
  role: 'super_admin' | 'admin' | 'teacher' | 'unknown';
  action: string;
  target: string;
  request_id: string;
  result: 'ok' | 'error' | 'denied';
  at: number;                  // ms since epoch (Timestamp → ms 변환)
  before?: unknown;
  after?: unknown;
  message?: string;
}

export interface ReadAuditEntriesOptions {
  limit: number;               // 1..200
  before?: number;             // ms since epoch, exclusive
}

export interface ReadAuditEntriesResult {
  entries: AuditLogEntryRead[];
  nextCursor: number | null;   // 마지막 항목의 at (ms), 페이지가 꽉 찼을 때만. 아니면 null.
}

export async function readAuditEntries(
  options: ReadAuditEntriesOptions,
): Promise<ReadAuditEntriesResult> {
  const db = getFirestore();
  const { limit, before } = options;

  let query = db.collection('audit_log').orderBy('at', 'desc').limit(limit);
  if (before !== undefined) {
    query = query.where('at', '<', Timestamp.fromMillis(before));
  }

  const snap = await query.get();
  const entries: AuditLogEntryRead[] = snap.docs.map((doc) => {
    const data = doc.data();
    const at =
      data.at && typeof data.at.toMillis === 'function' ? data.at.toMillis() : Date.now();
    return {
      id: doc.id,
      actor: data.actor,
      role: data.role,
      action: data.action,
      target: data.target,
      request_id: data.request_id,
      result: data.result,
      at,
      before: data.before,
      after: data.after,
      message: data.message,
    };
  });

  const nextCursor =
    entries.length === limit ? entries[entries.length - 1].at : null;

  return { entries, nextCursor };
}
```

#### 3. `packages/functions/src/callable/audit/list.ts` (신규)

`users/list.ts` 패턴 따라:

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { readAuditEntries, type AuditLogEntryRead } from '../../audit/readAudit.js';

export interface AuditLogListRequest {
  limit?: number;
  before?: number;
}

export interface AuditLogListResponse {
  entries: AuditLogEntryRead[];
  nextCursor: number | null;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const auditLogList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<AuditLogListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<AuditLogListRequest> | undefined;

    let user;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      const actorEmail = (request.auth?.token?.email as string | undefined) ?? 'unknown';
      const claimRole = request.auth?.token?.role;
      const actorRole: Role | 'unknown' =
        claimRole === 'super_admin' || claimRole === 'admin' || claimRole === 'teacher'
          ? (claimRole as Role)
          : 'unknown';
      await writeAudit({
        actor: actorEmail,
        role: actorRole,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'audit.read');
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const rawLimit = typeof data?.limit === 'number' ? data.limit : DEFAULT_LIMIT;
      const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)));
      const before = typeof data?.before === 'number' && data.before > 0 ? data.before : undefined;

      const result = await readAuditEntries({ limit, before });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'ok',
        message: `read ${result.entries.length} entries (limit ${limit}${before ? `, before ${before}` : ''})`,
      });

      return result;
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'audit.read',
        target: '*',
        request_id: requestId,
        result: 'error',
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
```

**주의**: `assertHasScopes` 안 부름 — audit 조회는 Google OAuth 스코프 무관 (Firestore 만 사용). Google API 안 부르니 accessToken 도 필요 없음.

#### 4. `packages/functions/src/index.ts`

기존 export 옆에 `export { auditLogList } from './callable/audit/list.js';` 추가.

#### 5. `packages/functions/tests/auditLogList.test.ts` (신규)

`usersList.test.ts` 패턴 따라 8~10 케이스. Firestore mock 은 `writeAudit.ts` 위한 것 + `readAudit.ts` 위한 것 (`collection('audit_log').orderBy('at','desc').limit(N).get()`):

1. **인증 실패** → denied audit (role='unknown') + throw
2. **cap 없음 (admin)** → denied audit (admin 은 audit.read 없음) + throw
3. **cap 없음 (teacher)** → denied audit + throw
4. **super_admin 성공 + 기본 limit (50)** → ok audit + 결과 반환
5. **super_admin + limit=100** → ok audit + limit 반영
6. **super_admin + limit=999** → 200 으로 clamp
7. **super_admin + limit=0 or -5** → 1 로 clamp
8. **super_admin + before=timestamp** → 그 이전 항목만
9. **entries.length === limit → nextCursor 세팅**, `< limit → nextCursor null`
10. **Firestore 오류 → error audit + throw**

각 케이스에서 `writeAudit` 호출 검증 (횟수·인자).

#### 6. `packages/functions/tests/auditLogList.emu.test.ts` (신규)

`usersList.emu.test.ts` 패턴 따라 3 케이스:
1. **allow (super_admin)** — REST signUp → promote to super_admin → signIn → seed 3 audit entries via writeAudit → call auditLogList → 200 + entries 3 개 반환 + audit_log 에 ok 새 항목 추가 확인 (자기 자신의 read 도 감사됨).
2. **denied non-super (admin)** — admin 계정 → 403 + audit_log 에 denied 항목.
3. **denied unauthenticated** — auth 헤더 없이 → 401 + audit_log 에 denied 항목 (role='unknown').

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과 — 특히 새 `readAudit.ts` 예외 등록.
4. `pnpm -r test` — 이전 154 + 신규 8~10 = 162~164 근처.
5. `pnpm -r test:emu` — 이전 emu 유지 + 신규 3 통과.
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 Firestore 정렬 성능** — 인덱스 필요할 수 있음. `audit_log.at desc` 는 단일 필드라 자동 인덱스 지원. 프로덕션 실측 후 필요 시 별도 slice.
- **cursor 안정성** — 같은 timestamp 두 항목이 있으면 페이지 경계에서 하나가 누락될 수 있음. 실사용 데이터로 확인 후 별도 판단.
- **filter (action·actor·target 별)** — 다음 슬라이스.
- **export** — 다음 슬라이스.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): readAudit 헬퍼 + ESLint 예외 등록`
2. `feat(functions): auditLog.list callable (super_admin 전용, 페이지네이션)`
3. `test(functions): auditLog.list 단위 + emu 통합 테스트`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/audit-log-list-v9`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
