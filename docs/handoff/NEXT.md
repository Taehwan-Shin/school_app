# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **감사 로그 actor 링크 v0.40** — 3 개 감사 로그 테이블 (AuditLogTable · UserAuditTrail · GroupAuditTrail) 에서 actor 필드가 `@cam.hs.kr` 이메일이면 사용자 상세 페이지 링크로 표시.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/audit-actor-link-v40`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `6cb3015` (super_admin KPI 클릭 nav v0.39)

## 지금 할 것 — 감사 로그 actor 를 사용자 상세 링크로

### 왜

감사 로그의 actor 필드는 관리자 이메일 (예: `admin@cam.hs.kr`) 이지만 지금은 plain text. 실 감사 시나리오에서 「이 액션을 누가 했지?」 → 그 사람의 상세 페이지로 바로 가고 싶은 요구가 강함. actor 가 도메인 이메일이면 `Link` 로 감싸서 클릭 시 사용자 상세 페이지로 nav.

**하지 않는 것**: target 링크 (user vs group email 판정 애매, false positive 발생 위험). 액션 코드 한글 라벨 (`users.write` → 「계정 수정」) — 검색·필터 손실. 링크 스타일 특별화 — 기존 「hover:underline」 재사용.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/super_admin/AuditLogTable.tsx` — actor cell 을 Link 로 (조건부)
- `packages/web/src/routes/admin/UserAuditTrail.tsx` — 동일
- `packages/web/src/routes/admin/GroupAuditTrail.tsx` — 동일
- `packages/web/tests/AuditLogTable.test.tsx` — actor 링크 렌더 시나리오 1
- `packages/web/tests/UserAuditTrail.test.tsx` — 동일
- `packages/web/tests/GroupAuditTrail.test.tsx` — 동일

**손대지 마라**:
- 백엔드 · Firestore · middleware — 그대로.
- target 필드 — 그대로 (plain text).
- 액션·결과·메시지 필드 — 그대로.
- 새 헬퍼 파일 만들지 마라 (한 줄 헬퍼 각 파일 인라인).

### 세부 요구

#### 1. 공통 로직 (인라인)

각 파일 안에 헬퍼 (혹은 render inline):
```ts
const ALLOWED_DOMAIN_SUFFIX = '@cam.hs.kr';
function renderActor(actor: string) {
  if (typeof actor === 'string' && actor.toLowerCase().endsWith(ALLOWED_DOMAIN_SUFFIX)) {
    return (
      <Link
        to={`/admin/users/${encodeURIComponent(actor)}`}
        className="text-fg-primary hover:underline"
        data-testid={`audit-actor-link-${actor}`}
      >
        {actor}
      </Link>
    );
  }
  return <span>{actor}</span>;
}
```

**주의**:
- 도메인 상수 (`@cam.hs.kr`) 하드코딩 허용 — 이미 여러 곳에 있음 (auth.tsx `hd: 'cam.hs.kr'` 등).
- 시스템 actor 값 (`unknown` 등) 은 plain span 으로.
- `Link` 는 이미 각 파일에서 import 가능 (`AuditLogTable` 은 super_admin/audit.tsx 를 통해; UserAuditTrail·GroupAuditTrail 은 `react-router-dom` 새로 import).

#### 2. `AuditLogTable.tsx` — actor cell 교체

기존:
```tsx
<TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
  {entry.actor}
</TableCell>
```

변경 후:
```tsx
<TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
  {renderActor(entry.actor)}
</TableCell>
```

`import { Link } from 'react-router-dom'` 이 이미 있으면 재활용, 없으면 추가.

**주의**:
- CSV export (`handleExportCsv`, `packages/web/src/routes/super_admin/AuditLogTable.tsx:36-60`) 는 그대로 (텍스트 그대로 export).

#### 3. `UserAuditTrail.tsx` · `GroupAuditTrail.tsx` — 동일

각 파일 상단에 `Link` import 추가 (없으면):
```ts
import { Link } from 'react-router-dom';
```

그리고 actor cell (`packages/web/src/routes/admin/UserAuditTrail.tsx:67`, `packages/web/src/routes/admin/GroupAuditTrail.tsx:67`) 교체.

#### 4. 테스트

각 테이블 파일마다 시나리오 1 추가 (총 3):

1. **AuditLogTable**: entry 하나 로드 (actor = `admin@cam.hs.kr`) → `audit-actor-link-admin@cam.hs.kr` 로 Link 렌더 + href `/admin/users/admin%40cam.hs.kr` 확인.
2. **UserAuditTrail**: 동일 패턴.
3. **GroupAuditTrail**: 동일 패턴.

시스템 actor (`unknown`) → Link 렌더 안 됨 (span 만) — 한 시나리오 안에 병행 검증 가능.

기존 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 479 + 신규 3 = 482 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/super_admin/audit` actor 컬럼 이메일 클릭 → 사용자 상세 페이지
   - `/admin/users/{email}` 감사 이력 actor 이메일 클릭 → 다른 사용자 상세로 nav
   - `/admin/groups/{email}` 감사 이력 동일
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **target 링크 (user vs group)** — 두 도메인 겹치므로 별도 slice (레지스트리 조회 필요).
- **actor === `unknown` 렌더** — 그대로 plain text.
- **삭제된 사용자의 actor 링크** — 상세 페이지에서 「사용자를 찾을 수 없습니다」 폴백 (기존 UX).

### 커밋 규칙

**1 커밋**:
- `feat(web): 감사 로그 actor 를 사용자 상세 페이지 링크로 (3 테이블)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/audit-actor-link-v40`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
