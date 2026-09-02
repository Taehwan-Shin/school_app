# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **사용자 소속 그룹 v0.29** — `groups.list` callable 에 `userKey` 필터 추가 + UserDetailPage 에 「소속 그룹」 섹션. Directory API 는 `groups.list({userKey})` 지원.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/user-groups-v29`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `513beb5` (사용자 상세 페이지 v0.28)

## 지금 할 것 — groups.list userKey 필터 + UserDetailPage 소속 그룹

### 왜

v0.28 로 UserDetailPage 놓았지만 「이 사용자가 어떤 그룹에 속하는지」 정보 없음. 실 감사·관리 시 매우 유용. Directory API 는 `groups.list({userKey})` 로 즉시 지원 — 새 callable 필요 없이 기존 확장.

**하지 않는 것**: 그룹 클릭 → 그룹 상세로 이동 (기존 그룹 상세 라우트 사용). 소속 그룹 추가·제거 UI (그룹 상세 페이지에서 이미 됨). 새 스코프 (기존 `admin.directory.group.readonly` 재사용).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/functions/src/callable/groups/list.ts` — 입력 스키마에 `userKey?: string` 추가. 있으면 Directory API 에 전달.
- `packages/functions/tests/groupsList.test.ts` — userKey 시나리오 2 추가.
- `packages/web/src/api/groupsList.ts` — 인터페이스 + hook 확장 (userKey 옵션).
- `packages/web/src/routes/admin/userDetail.tsx` — 「소속 그룹」 섹션 추가.
- `packages/web/tests/groupsList.test.tsx` — userKey 시나리오 1 추가.
- `packages/web/tests/UserDetailPage.test.tsx` — 소속 그룹 시나리오 2 추가.

**신규 파일**:
- `packages/web/src/routes/admin/UserGroups.tsx` — 소속 그룹 표 컴포넌트.
- `packages/web/tests/UserGroups.test.tsx` — 시나리오 4.

**손대지 마라**:
- middleware · writeAudit · directoryClient — 헬퍼 그대로.
- GroupsPage · GroupsTable · 다른 라우트.

### 세부 요구

#### 1. `groups/list.ts` — userKey 파라미터

**입력 스키마**:
```ts
export interface GroupsListRequest {
  userKey?: string;   // 지정 시 이 사용자가 속한 그룹만 반환
}
export interface GroupsListResponse {
  groups: GroupItem[];
}
```

**구조**:
- request.data 에서 userKey 추출
- 유효성: userKey 있으면 도메인 매치 (users.update 등에서 재사용된 로직). 아니면 무시.
- Directory API 호출 시 userKey 있으면 그것만, 없으면 `customer: 'my_customer'` (기존):
  ```ts
  const params: any = userKey
    ? { userKey: userKey.trim(), maxResults: 200 }
    : { customer: 'my_customer', maxResults: 200 };
  const res = await directory.groups.list({ ...params, pageToken });
  ```

**성공 audit message**:
```ts
message: userKey
  ? `listed ${results.length} groups for user ${userKey}`
  : `listed ${results.length} groups`
```

#### 2. `groups.list` 테스트 (2 신규):

1. admin + userKey 지정 + 그룹 2 개 → ok audit, 「for user ...」 message
2. userKey 도메인 검증 실패 → error audit

#### 3. `packages/web/src/api/groupsList.ts` — hook 확장

**변경 전**:
```ts
export function useGroupsList(enabled = true, options?: { retry?: number | boolean }) { ... }
```

**변경 후**:
```ts
export interface UseGroupsListOptions {
  userKey?: string;   // 지정 시 이 사용자 그룹만
  retry?: number | boolean;
}

export function useGroupsList(enabled = true, options?: UseGroupsListOptions) {
  return useQuery<GroupsListResponse, Error>({
    queryKey: options?.userKey ? ['groups', 'list', 'byUser', options.userKey] : ['groups', 'list'],
    queryFn: () => callGroupsList({ userKey: options?.userKey }),
    enabled,
    staleTime: 60_000,
    retry: options?.retry ?? /* 기존 */,
  });
}

export async function callGroupsList(data: { userKey?: string } = {}): Promise<GroupsListResponse> {
  // fetch body 에 data 포함 (userKey 있으면 자동)
  ...
}
```

**주의**:
- queryKey 를 userKey 유무로 분리 → 캐시 격리 (전체 목록 캐시 안 오염)
- 기존 callers (`useGroupsList()` 호출) backward compatible

#### 4. `UserGroups.tsx` — 소속 그룹 표

**Props**:
```ts
interface UserGroupsProps {
  userEmail: string;
}
```

**구조**:
```tsx
import { Link } from 'react-router-dom';
import { useGroupsList } from '../../api/groupsList';

export function UserGroups({ userEmail }: UserGroupsProps) {
  const { data, isLoading, isError, error } = useGroupsList(true, { userKey: userEmail });

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-groups-loading">
          소속 그룹을 불러오는 중...
        </div>
      )}
      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="user-groups-error">
          소속 그룹을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}
      {!isLoading && !isError && (!data?.groups || data.groups.length === 0) && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="user-groups-empty">
          이 사용자는 어떤 그룹에도 속하지 않습니다.
        </div>
      )}
      {data?.groups && data.groups.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>설명</TableHead>
                <TableHead className="text-right">멤버 수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.groups.map((g) => (
                <TableRow key={g.email} data-testid={`user-group-row-${g.email}`}>
                  <TableCell className="font-mono text-small">
                    <Link
                      to={`/admin/groups/${encodeURIComponent(g.email)}`}
                      className="text-fg-primary hover:underline"
                    >
                      {g.email}
                    </Link>
                  </TableCell>
                  <TableCell className="text-fg-primary">{g.name}</TableCell>
                  <TableCell className="text-small text-fg-secondary max-w-xs truncate" title={g.description}>
                    {g.description || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-small text-fg-primary">
                    {g.directMembersCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- 4 컬럼 표 (이메일·이름·설명·멤버 수) — 그룹 상세 페이지로 링크
- Groups 페이지 GroupsTable 의 축소 버전

#### 5. `userDetail.tsx` — 「소속 그룹」 섹션 추가

기존 「감사 이력」 섹션 앞에 (또는 뒤에):
```tsx
{user && (
  <section className="bg-elevated p-8 border border-border-subtle space-y-4">
    <h2 className="text-h2 font-semibold text-fg-primary">소속 그룹</h2>
    <p className="text-small text-fg-secondary">
      이 사용자가 속한 Google Workspace 그룹 목록입니다.
    </p>
    <UserGroups userEmail={user.email} />
  </section>
)}
```

#### 6. 테스트

**functions `groupsList.test.ts`** (2 신규):
1. admin + userKey 지정 → Directory API 호출 시 params 에 userKey 포함 확인, message 확인
2. userKey 도메인 불일치 → error

**web `groupsList.test.tsx`** (1 신규):
- `useGroupsList(true, { userKey: 'admin@cam.hs.kr' })` → fetch body 에 userKey 포함

**web `UserGroups.test.tsx`** (4):
1. 로딩 상태
2. 오류 상태
3. 빈 상태 (사용자 그룹 0)
4. 정상 (그룹 2 개 렌더, 각 이메일 링크)

**web `UserDetailPage.test.tsx`** (2 신규):
1. 사용자 존재 시 「소속 그룹」 섹션 렌더
2. UserGroups 컴포넌트에 올바른 userEmail 전달

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 412 + 신규 9 = 421 근처.
5. `pnpm -r test:emu` — 이전 43 유지 (신규 emu 없음).
6. dev 서버 확인:
   - `/admin/users/{email}` 상세 페이지에 「소속 그룹」 섹션
   - 그룹 이메일 클릭 → `/admin/groups/{email}` 이동
   - 그룹 없는 사용자는 「어떤 그룹에도 속하지 않습니다」
7. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **실 Directory API `groups.list?userKey=X` 응답** — 사용자 확인.
- **소속 그룹의 역할 표시** (OWNER/MEMBER 등) — groups.list 결과에 포함 안 됨. members API 로 별도 조회 필요, 별도 slice.
- **소속 그룹 그래프 (누구가 누구랑 같은 그룹)** — 별도 slice.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): groups.list 에 userKey 필터 추가 + 감사 message 확장`
2. `feat(web): useGroupsList hook 에 userKey 옵션 추가 (queryKey 격리)`
3. `feat(web): UserDetailPage 에 소속 그룹 섹션 (UserGroups 컴포넌트)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/user-groups-v29`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
