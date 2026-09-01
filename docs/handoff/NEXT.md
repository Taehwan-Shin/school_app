# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **그룹 멤버 관리 UI v0.17** — v0.16 백엔드 `groups.members.list/insert/delete` 를 UI 로 노출. 그룹 상세 페이지 (`/admin/groups/:email`) 신설 + 멤버 표 + 추가/제거 다이얼로그.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-members-ui-v17`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 5~6 개.

**Designer 몫**: 스타일 값은 UI_SYSTEM + accounts CRUD 다이얼로그 (특히 `DeleteUserDialog`) 패턴 그대로.

## 기준 커밋

**Base**: `bb08bb1` (그룹 멤버 백엔드 v0.16)

## 지금 할 것 — 그룹 상세 페이지 + 멤버 관리

### 왜

v0.16 로 백엔드 멤버 CRUD 가능하지만 UI 없음. 그룹의 실사용 (실제로 「누구를 이 그룹에 넣는가」) 에는 멤버 관리 UI 가 핵심.

**하지 않는 것**: 대량 멤버 추가/삭제 (bulk, 별도 slice). 멤버 역할 (OWNER/MANAGER/MEMBER) 수정 UI (`members.update` 백엔드 없음, 별도 slice). 검색·필터·페이지네이션 (기본 페이지네이션만 — 「더 보기」 버튼).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/App.tsx` — 새 라우트 `/admin/groups/:email`.
- `packages/web/src/routes/admin/GroupsTable.tsx` — 이메일 열을 링크로 (그룹 상세로 이동).
- `packages/web/tests/GroupsTable.test.tsx` — 이메일 링크 회귀 테스트 추가.

**신규 파일**:
- `packages/web/src/api/groupsMembersList.ts` — API 클라이언트 (query hook + loadMore 페이지네이션).
- `packages/web/src/api/groupsMembersInsert.ts` — mutation hook.
- `packages/web/src/api/groupsMembersDelete.ts` — mutation hook.
- `packages/web/src/routes/admin/groupDetail.tsx` — 상세 페이지 (AppShell + 그룹 정보 + MembersTable).
- `packages/web/src/routes/admin/MembersTable.tsx` — 멤버 표 컴포넌트.
- `packages/web/src/routes/admin/AddMemberDialog.tsx` — 추가 다이얼로그.
- `packages/web/src/routes/admin/RemoveMemberDialog.tsx` — 제거 확인 다이얼로그.
- `packages/web/tests/groupsMembersList.test.tsx` — API 시나리오 5.
- `packages/web/tests/groupsMembersInsert.test.tsx` — API 시나리오 5.
- `packages/web/tests/groupsMembersDelete.test.tsx` — API 시나리오 5.
- `packages/web/tests/MembersTable.test.tsx` — 표 시나리오 5.
- `packages/web/tests/AddMemberDialog.test.tsx` — 다이얼로그 시나리오 5.
- `packages/web/tests/RemoveMemberDialog.test.tsx` — 다이얼로그 시나리오 5.

**손대지 마라**:
- accounts 관련 파일, KpiCard 등.
- 백엔드.
- middleware.

### 세부 요구

#### 1. API 클라이언트 3 개

**`groupsMembersList.ts`** — v0.10 `auditLogList.ts` 패턴 (loadMore + useState + reload):
```ts
export interface GroupMemberItem {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
  type: 'USER' | 'GROUP' | 'CUSTOMER' | 'EXTERNAL';
  status: string;
}
export function useGroupMembersList(groupEmail: string, pageSize = 100): {
  members: GroupMemberItem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}
```

**`groupsMembersInsert.ts`** — `usersCreate.ts` 패턴, `useAddMember()` mutation, `onSuccess` invalidate `groups/members/{groupEmail}`.

**`groupsMembersDelete.ts`** — `usersDelete.ts` 패턴, `useRemoveMember()` mutation.

모두 `_googleAccessToken` in body (b976a87 규약) + Cloud Functions 직접 URL.

#### 2. `groupDetail.tsx` — 상세 페이지

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/shell/AppShell';
import { MembersTable } from './MembersTable';

export function GroupDetailPage() {
  const { email = '' } = useParams<{ email: string }>();
  const groupEmail = decodeURIComponent(email);
  const navigate = useNavigate();
  const { role } = useAuth();
  return (
    <AppShell role={role} pageTitle={`그룹: ${groupEmail}`}>
      <div className="space-y-6">
        <button onClick={() => navigate('/admin/groups')} className="text-fg-secondary hover:text-fg-primary text-small">
          ← 그룹 목록
        </button>
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h2 font-semibold text-fg-primary">멤버 관리</h2>
          <p className="text-small text-fg-secondary font-mono">{groupEmail}</p>
          <MembersTable groupEmail={groupEmail} />
        </section>
      </div>
    </AppShell>
  );
}
```

- `App.tsx` 에 라우트 `/admin/groups/:email` → `GroupDetailPage` (super_admin + admin RoleGuard).
- URL 인코딩된 이메일 (예: `team-a%40cam.hs.kr`) → decodeURIComponent.

#### 3. `MembersTable.tsx` — 멤버 표

**Props**:
```ts
interface MembersTableProps {
  groupEmail: string;
}
```

**컬럼** (4):
- 이메일 (`font-mono text-small`)
- 역할 (`text-micro` — OWNER/MANAGER/MEMBER, OWNER 강조 `font-medium`)
- 타입 (`text-micro` — USER/GROUP/CUSTOMER/EXTERNAL)
- 관리 (「제거」 텍스트 링크, `state-danger`)

**상단 로우**: 왼쪽 「N 명 멤버」, 오른쪽 「+ 멤버 추가」 Primary Button.

**하단**: 「더 보기」 버튼 (hasMore 시).

**상태**:
- 로딩: `data-testid="members-loading"`
- 오류: `border border-state-danger p-4` 배너
- 빈 상태: 「멤버가 없습니다.」
- 각 행 `data-testid="member-row-{email}"`

**액션**:
- 「+ 멤버 추가」 → `AddMemberDialog` 열림 (`groupEmail` prop 전달)
- 각 행 「제거」 → `RemoveMemberDialog` 열림 (`groupEmail + memberEmail`)

#### 4. `AddMemberDialog.tsx`

**Props**:
```ts
interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupEmail: string;
}
```

**필드**:
- 멤버 이메일 (검증: `@cam.hs.kr` 도메인)
- 역할 (라디오 3 개: OWNER · MANAGER · MEMBER, default MEMBER)

**검증**: 이메일 필수 + 도메인 매치. 역할 유효 값.

**성공**: 다이얼로그 닫힘 + `useAddMember` mutation `onSuccess` → 표 자동 새로고침.

**오류 매핑**: `409` (이미 멤버) → 「이 사용자는 이미 그룹의 멤버입니다.」, `permission-denied` → 「멤버 추가 권한이 없거나 스코프가 부족합니다.」

#### 5. `RemoveMemberDialog.tsx`

**Props**:
```ts
interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupEmail: string;
  member: { email: string; role: string } | null;
}
```

**표시**: 「이 작업은 되돌릴 수 없습니다.」 + 대상 이메일 + 역할 + 그룹.

**확인 입력**: 멤버 이메일 재입력.

**하단 버튼**: Secondary 취소 + Danger 제거.

**주의**: 마지막 OWNER 제거 시도 → Directory API 오류 → 배너 「마지막 소유자는 제거할 수 없습니다.」

#### 6. `GroupsTable.tsx` — 이메일 열 링크화

각 행 이메일 셀을 `<Link to={`/admin/groups/${encodeURIComponent(email)}`} className="text-fg-primary hover:underline">{email}</Link>` 로.

#### 7. 테스트 (신규 30 = API 15 + Dialogs 10 + MembersTable 5)

각 파일 시나리오는 accounts 대응 파일 (`usersCreate.test.tsx` 등) 미러.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 307 + 신규 30 = 337 근처.
5. dev 서버 확인:
   - `/admin/groups` 에서 그룹 이메일 클릭 → `/admin/groups/{email}` 로 이동
   - 멤버 표 로드
   - 「+ 멤버 추가」 다이얼로그 열림 → 저장 → 표 새로고침
   - 각 행 「제거」 → 확인 다이얼로그 → 표 새로고침
6. 프로덕션 번들 grep — 0 건.

### 판정 불가

- **실 워크스페이스 멤버 관리 실측** — 사용자 배포 후 실행 테스트.
- **역할 수정 (`members.update`)** — 백엔드 없음, 별도 slice.
- **대량 처리 (bulk add/remove via CSV)** — 별도 slice.
- **멤버 검색·필터** — 다음 slice.
- **모니터링·감사** — audit_log 에 자동 기록 됨.

### 커밋 규칙

**5~6 커밋 분리**:
1. `feat(web): groupsMembersList API 클라이언트 + hook`
2. `feat(web): groupsMembersInsert·Delete API 클라이언트 + mutation`
3. `feat(web): MembersTable 컴포넌트`
4. `feat(web): AddMemberDialog · RemoveMemberDialog 컴포넌트`
5. `feat(web): /admin/groups/:email 라우트 + GroupDetailPage`
6. `feat(web): GroupsTable 이메일 열 링크화`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/groups-members-ui-v17`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
