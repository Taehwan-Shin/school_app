# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **사용자 상세 페이지 v0.28** — `/admin/users/:email` 라우트 신설. 사용자 정보 + 감사 이력 (v0.26 target 필터 활용) 통합 뷰. AccountsTable 이메일 셀 링크화.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/user-detail-v28`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

**Designer 몫**: `docs/design/UI_SYSTEM.md` 그대로. `groupDetail.tsx` 패턴 재사용.

## 기준 커밋

**Base**: `b551fba` (감사 로그 v4 UI v0.27)

## 지금 할 것 — /admin/users/:email 상세 페이지

### 왜

지금 사용자 정보는 AccountsTable 행에만 있음. 「이 사용자에 대한 이력」 을 보려면 super_admin/audit 로 가서 target 을 필터해야 함. 실 운영에서 특정 사용자 조사 시 자연스러운 UX 는 「사용자 클릭 → 상세 페이지」.

이 슬라이스가 그 UX 를 추가.

**하지 않는 것**: 사용자가 속한 그룹 목록 (별도 slice, groups.list 를 userKey 로 필터하는 백엔드 확장 필요). 사용자 편집·정지·삭제·재설정 (AccountsTable 에서 이미 됨, 여기서는 표시만). 감사 이력 CSV export (super_admin/audit 에서 가능).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/App.tsx` — 새 라우트 `/admin/users/:email` (super_admin + admin RoleGuard).
- `packages/web/src/routes/admin/AccountsTable.tsx` — 이메일 셀을 링크로 (사용자 상세로 이동).
- `packages/web/tests/AccountsTable.test.tsx` — 이메일 링크 회귀 테스트.

**신규 파일**:
- `packages/web/src/routes/admin/userDetail.tsx` — 상세 페이지 (AppShell + 정보 카드 + UserAuditTrail).
- `packages/web/src/routes/admin/UserAuditTrail.tsx` — 감사 이력 표 (useAuditLogList + filterTarget).
- `packages/web/tests/UserAuditTrail.test.tsx` — 시나리오 4.
- `packages/web/tests/UserDetailPage.test.tsx` — 시나리오 3.

**손대지 마라**:
- 백엔드 · KpiCard · AuditLogTable · 다른 라우트.

### 세부 요구

#### 1. `userDetail.tsx` 상세 페이지

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { useUsersList } from '../../api/usersList';
import { UserAuditTrail } from './UserAuditTrail';

export function UserDetailPage() {
  const { email = '' } = useParams<{ email: string }>();
  const userEmail = decodeURIComponent(email);
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data, isLoading, isError } = useUsersList();

  const user = data?.users?.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());

  return (
    <AppShell role={role} pageTitle={`사용자: ${userEmail}`}>
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin')}
          className="text-fg-secondary hover:text-fg-primary text-small"
        >
          ← 계정 목록
        </button>

        {/* 정보 카드 */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h2 font-semibold text-fg-primary">사용자 정보</h2>
          {isLoading && <p className="text-small text-fg-secondary">불러오는 중...</p>}
          {isError && <div className="border border-state-danger p-4 text-small text-state-danger">사용자 정보를 불러오지 못했습니다.</div>}
          {!isLoading && !isError && !user && (
            <p className="text-small text-fg-secondary" data-testid="user-detail-not-found">
              사용자를 찾을 수 없습니다: {userEmail}
            </p>
          )}
          {user && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3" data-testid="user-detail-info">
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이메일</dt>
                <dd className="text-body font-mono text-fg-primary">{user.email}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이름</dt>
                <dd className="text-body text-fg-primary">{`${user.lastName}${user.firstName}`.trim() || '-'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">조직 단위</dt>
                <dd className="text-body font-mono text-fg-secondary">{user.orgUnitPath || '/'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">권한</dt>
                <dd className="text-body">
                  {user.isAdmin ? (
                    <span className="text-fg-primary font-medium">관리자</span>
                  ) : (
                    <span className="text-fg-muted">일반</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">상태</dt>
                <dd className="text-body">
                  {user.isSuspended ? (
                    <span className="text-state-danger font-medium">정지됨</span>
                  ) : (
                    <span className="text-fg-muted">정상</span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </section>

        {/* 감사 이력 */}
        {user && (
          <section className="bg-elevated p-8 border border-border-subtle space-y-4">
            <h2 className="text-h2 font-semibold text-fg-primary">감사 이력</h2>
            <p className="text-small text-fg-secondary">
              이 사용자를 대상으로 발생한 모든 관리자 행위의 기록입니다.
            </p>
            <UserAuditTrail targetEmail={user.email} />
          </section>
        )}
      </div>
    </AppShell>
  );
}
```

- `useParams` 로 URL 이메일 (encoded) → decodeURIComponent
- `useUsersList` 로 전체 사용자 목록 로드 후 filter (accounts UX 재사용, 새 backend 호출 없음)
- 사용자 없으면 `user-detail-not-found` 안내

#### 2. `UserAuditTrail.tsx` — 감사 이력 표

**Props**:
```ts
interface UserAuditTrailProps {
  targetEmail: string;
}
```

**구조**:
```tsx
import { useAuditLogList } from '../../api/auditLogList';

export function UserAuditTrail({ targetEmail }: UserAuditTrailProps) {
  const { entries, loading, error, hasMore, loadMore } = useAuditLogList(25, {
    filterTarget: targetEmail,
  });

  return (
    <div className="space-y-4">
      {loading && entries.length === 0 && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-audit-loading">
          이력을 불러오는 중...
        </div>
      )}
      {error && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="user-audit-error">
          이력을 불러오지 못했습니다: {error.message}
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-audit-empty">
          이 사용자에 대한 감사 이력이 없습니다.
        </div>
      )}
      {entries.length > 0 && (
        <>
          <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시간</TableHead>
                  <TableHead>행위자</TableHead>
                  <TableHead>액션</TableHead>
                  <TableHead>결과</TableHead>
                  <TableHead>메시지</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} data-testid={`user-audit-row-${e.id}`}>
                    <TableCell className="font-mono text-small text-fg-primary whitespace-nowrap">
                      {new Date(e.at).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell className="font-mono text-small text-fg-primary">{e.actor}</TableCell>
                    <TableCell className="font-mono text-small text-fg-primary">{e.action}</TableCell>
                    <TableCell className={/* result 색상 */}>{e.result}</TableCell>
                    <TableCell className="text-small text-fg-secondary max-w-xs truncate" title={e.message}>
                      {e.message || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="secondary" onClick={loadMore} disabled={loading} data-testid="user-audit-load-more">
                {loading ? '불러오는 중...' : '더 보기 (25 건)'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- `AuditLogTable` 의 5 컬럼 축소 버전 (시간·행위자·액션·결과·메시지). 「행위자」 유지, 「대상」 은 이미 페이지 컨텍스트라 생략, 「역할」 · 「요청 ID」 도 생략 (공간).
- 「더 보기」 페이지네이션 유지.

#### 3. `App.tsx` — 라우트 추가

```tsx
<Route element={<RoleGuard expectedRoles={['super_admin', 'admin']} />}>
  <Route path="/admin" element={<AdminPage />} />
  <Route path="/admin/groups" element={<GroupsPage />} />
  <Route path="/admin/groups/:email" element={<GroupDetailPage />} />
  <Route path="/admin/users/:email" element={<UserDetailPage />} />  {/* 신규 */}
</Route>
```

#### 4. `AccountsTable.tsx` — 이메일 셀 링크화

**현재** 행:
```tsx
<TableCell className="font-mono text-small text-fg-primary">{user.email}</TableCell>
```

**변경 후**:
```tsx
<TableCell className="font-mono text-small">
  <Link to={`/admin/users/${encodeURIComponent(user.email)}`} className="text-fg-primary hover:underline">
    {user.email}
  </Link>
</TableCell>
```

`import { Link } from 'react-router-dom';` 추가.

#### 5. 테스트

**`UserAuditTrail.test.tsx`** (4 시나리오, `MemoryRouter`, useAuditLogList mock):
1. **로딩** → `user-audit-loading` 렌더
2. **오류** → `user-audit-error` 렌더
3. **빈 상태** → `user-audit-empty` 렌더
4. **정상 데이터 (3 entries)** → 각 행 렌더, hasMore=true 시 「더 보기」 렌더

**`UserDetailPage.test.tsx`** (3 시나리오, MemoryRouter 초기 경로 `/admin/users/${encodeURIComponent('admin2@cam.hs.kr')}`):
1. **사용자 존재** — useUsersList mock 데이터에 있음 → 정보 카드 렌더 + 감사 트레일 섹션 표시
2. **사용자 없음** — mock 에 없음 → `user-detail-not-found` 렌더
3. **로딩** — mock isLoading=true → 「불러오는 중...」

**`AccountsTable.test.tsx`** 신규 회귀:
- 이메일 셀이 `<a>` 태그로 렌더 (Link), `href` 가 `/admin/users/${encoded_email}` 로

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 404 + 신규 8 = 412 근처.
5. dev 서버 확인:
   - `/admin` 에서 사용자 이메일 클릭 → `/admin/users/{email}` 로 이동
   - 정보 카드 (이메일·이름·조직 단위·권한·상태) 렌더
   - 감사 이력 섹션에 해당 사용자 대상 이벤트만 표시
   - 존재 안 하는 이메일로 접근 시 「사용자를 찾을 수 없습니다」
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **사용자 소속 그룹 목록** — 별도 slice (groups.list userKey 필터 필요).
- **감사 이력 CSV export** — `/super_admin/audit` 에서 가능.
- **실 워크스페이스 실측** — 사용자 확인.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(web): UserAuditTrail 컴포넌트 (target 필터 활용)`
2. `feat(web): UserDetailPage 라우트 + AppShell 통합`
3. `feat(web): AccountsTable 이메일 셀 링크화 + /admin/users/:email 라우트 등록`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/user-detail-v28`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
