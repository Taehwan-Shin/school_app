# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **그룹 상세 페이지 v0.30** — GroupDetailPage 에 정보 카드 + 감사 이력 섹션 추가 (UserDetailPage v0.28 대칭).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/group-detail-v30`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `8b423da` (사용자 소속 그룹 v0.29)

## 지금 할 것 — GroupDetailPage 정보 카드 + 감사 이력

### 왜

v0.28 로 UserDetailPage 는 정보 카드 + 소속 그룹 + 감사 이력 3 섹션. 반면 GroupDetailPage 는 「멤버 관리」 하나뿐 (`packages/web/src/routes/admin/groupDetail.tsx:12-29`). 그룹 감사 (create/update/delete/members insert/delete) 는 이미 target = 그룹 이메일 로 audit_log 에 기록됨 (`packages/functions/src/callable/groups/*.ts`, `groups/members/*.ts`). filterTarget 만 걸면 그룹별 이력 그대로 나옴. 새 API 없음.

**하지 않는 것**: 그룹 편집 인라인 UI 추가 (이미 GroupsTable 편집 다이얼로그로 됨). 새 스코프. 새 callable.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/groupDetail.tsx` — 정보 카드 + 감사 이력 섹션 추가.
- `packages/web/tests/GroupDetailPage.test.tsx` (기존 파일이 있으면 확장, 없으면 신규) — 시나리오 3 추가.

**신규 파일**:
- `packages/web/src/routes/admin/GroupAuditTrail.tsx` — 그룹 감사 이력 컴포넌트 (UserAuditTrail 대칭, `filterTarget=groupEmail`).
- `packages/web/tests/GroupAuditTrail.test.tsx` — 시나리오 4.

**손대지 마라**:
- backend callable · middleware · audit — 그대로.
- UserAuditTrail · UserGroups · UserDetailPage — 그대로.
- MembersTable · GroupsTable · 편집 다이얼로그 · 다른 라우트.

### 세부 요구

#### 1. `GroupAuditTrail.tsx` — 그룹 감사 이력 컴포넌트

**Props**:
```ts
export interface GroupAuditTrailProps {
  groupEmail: string;
}
```

**구조** — `UserAuditTrail.tsx` (`packages/web/src/routes/admin/UserAuditTrail.tsx`) 완전 대칭:
```tsx
import { useAuditLogList } from '../../api/auditLogList';
import { Button } from '../../components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

export function GroupAuditTrail({ groupEmail }: GroupAuditTrailProps) {
  const { entries, loading, error, hasMore, loadMore } = useAuditLogList(25, {
    filterTarget: groupEmail,
  });

  // 로딩 · 오류 · 빈 상태 · 5 컬럼 표 · 「더 보기」 버튼 — UserAuditTrail 과 동일 레이아웃.
  // data-testid 접두사: `group-audit-*` (loading/error/empty/row-<id>/load-more).
}
```

**주의**:
- UserAuditTrail 을 재사용/추상화 하지 마라. 두 컴포넌트 병존 유지 (v0.30 범위 밖).
- `data-testid` 는 `group-audit-*` 로 (충돌 없이 UserDetail 페이지에서 두 트레일 렌더될 일 없음, 하지만 명확성).

#### 2. `groupDetail.tsx` — 정보 카드 + 감사 이력 섹션 추가

**변경 전** (30 줄):
```tsx
<AppShell role={role} pageTitle={`그룹: ${groupEmail}`}>
  <div className="space-y-6">
    <button ...>← 그룹 목록</button>
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <h2>멤버 관리</h2>
      <p className="text-small text-fg-secondary font-mono">{groupEmail}</p>
      <MembersTable groupEmail={groupEmail} />
    </section>
  </div>
</AppShell>
```

**변경 후**:
```tsx
const { data, isLoading, isError } = useGroupsList();
const group = data?.groups?.find((g) => g.email.toLowerCase() === groupEmail.toLowerCase());

<AppShell role={role} pageTitle={`그룹: ${groupEmail}`}>
  <div className="space-y-6">
    <button ...>← 그룹 목록</button>

    {/* 정보 카드 */}
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <h2 className="text-h2 font-semibold text-fg-primary">그룹 정보</h2>
      {isLoading && <p className="text-small text-fg-secondary">불러오는 중...</p>}
      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger">
          그룹 정보를 불러오지 못했습니다.
        </div>
      )}
      {!isLoading && !isError && !group && (
        <p className="text-small text-fg-secondary" data-testid="group-detail-not-found">
          그룹을 찾을 수 없습니다: {groupEmail}
        </p>
      )}
      {group && (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3" data-testid="group-detail-info">
          <div>
            <dt className="text-micro uppercase tracking-wide text-fg-secondary">이메일</dt>
            <dd className="text-body font-mono text-fg-primary">{group.email}</dd>
          </div>
          <div>
            <dt className="text-micro uppercase tracking-wide text-fg-secondary">이름</dt>
            <dd className="text-body text-fg-primary">{group.name || '-'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-micro uppercase tracking-wide text-fg-secondary">설명</dt>
            <dd className="text-body text-fg-secondary">{group.description || '-'}</dd>
          </div>
          <div>
            <dt className="text-micro uppercase tracking-wide text-fg-secondary">멤버 수</dt>
            <dd className="text-body font-mono text-fg-primary">{group.directMembersCount}</dd>
          </div>
        </dl>
      )}
    </section>

    {/* 멤버 관리 (기존) */}
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <h2 className="text-h2 font-semibold text-fg-primary">멤버 관리</h2>
      <p className="text-small text-fg-secondary font-mono">{groupEmail}</p>
      <MembersTable groupEmail={groupEmail} />
    </section>

    {/* 감사 이력 */}
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <h2 className="text-h2 font-semibold text-fg-primary">감사 이력</h2>
      <p className="text-small text-fg-secondary">
        이 그룹을 대상으로 발생한 모든 관리자 행위의 기록입니다.
      </p>
      <GroupAuditTrail groupEmail={groupEmail} />
    </section>
  </div>
</AppShell>
```

**임포트 추가**: `useGroupsList` (from `../../api/groupsList`), `GroupAuditTrail` (from `./GroupAuditTrail`).

**주의**:
- `useGroupsList()` 는 인자 없이 호출 — 전체 목록에서 찾기. `{ userKey: ... }` 옵션은 사용자 소속 그룹용이니 여기선 사용 금지 (그러면 그룹 자신은 목록에 안 나옴).
- 그룹 없음 상태에서도 「멤버 관리」·「감사 이력」 섹션은 렌더 (그룹이 audit_log 에만 남고 실제로는 삭제된 경우 여전히 이력은 봐야 함).

#### 3. 테스트

**web `GroupAuditTrail.test.tsx`** (4 시나리오):
1. 로딩 상태 (`group-audit-loading` 표시)
2. 오류 상태 (`group-audit-error` 표시)
3. 빈 상태 (`group-audit-empty` 표시, 「기록 없음」 문구)
4. 정상 렌더 + 「더 보기」 클릭 → `loadMore` 호출

**web `GroupDetailPage.test.tsx`** (3 시나리오 — 기존 파일 있으면 확장):
1. `useGroupsList` 로딩 중 → 「불러오는 중」 렌더
2. group 존재 시 `group-detail-info` 렌더 (이메일·이름·설명·멤버 수)
3. group 없음 (`useGroupsList` 성공 but 매칭 없음) → `group-detail-not-found` 렌더

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 421 + 신규 7 = 428 근처.
5. `pnpm -r test:emu` — 이전 43 유지.
6. dev 서버 확인:
   - `/admin/groups/{email}` 상세에 정보 카드 · 멤버 관리 · 감사 이력 3 섹션
   - 존재 그룹: 4 정보 셀 · 감사 트레일 정상
   - 없는 그룹: `group-detail-not-found` + 멤버 관리 (직접 API 호출 결과) + 이력만
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- 실 Directory API 로 그룹 상세 페이지 감사 이력 실측 — 사용자 확인.
- 그룹 이름·설명 편집 인라인 UI — 별도 slice (v0.31?).
- 그룹 감사 CSV export — 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): GroupAuditTrail 컴포넌트 (target 필터 활용)`
2. `feat(web): GroupDetailPage 정보 카드 + 감사 이력 섹션`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/group-detail-v30`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
