# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **그룹 멤버 역할 변경 v0.31** — `groups.members.update` callable 신설 + EditMemberRoleDialog + MembersTable 「역할 변경」 버튼. Directory API `members.update({role})` 지원.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/members-update-v31`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 3 개.

## 기준 커밋

**Base**: `4cabb79` (그룹 상세 페이지 v0.30)

## 지금 할 것 — groups.members.update callable + 역할 변경 UI

### 왜

현재 그룹 멤버 관리는 insert + delete 만. 멤버의 역할 (OWNER/MANAGER/MEMBER) 을 바꾸려면 제거 후 재추가 필요 — 감사 로그도 2 건 (delete + insert), 잠깐 그룹에서 완전 이탈. Directory API `members.update({groupKey, memberKey, requestBody: {role}})` 는 in-place 변경 지원. insert 는 이미 role 파라미터 있음 (`packages/functions/src/callable/groups/members/insert.ts:82-119`), update 만 없음.

**하지 않는 것**: 역할별 권한 UI 재설계 (v0.31 밖). 새 스코프 (기존 `admin.directory.group.member` 재사용). Directory API `members.patch` (update 로 충분).

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/functions/src/callable/groups/members/update.ts` — 새 callable
- `packages/functions/tests/groupsMembersUpdate.test.ts` — 시나리오 6~8
- `packages/web/src/api/groupsMembersUpdate.ts` — hook + fetch
- `packages/web/src/routes/admin/EditMemberRoleDialog.tsx` — 역할 변경 다이얼로그
- `packages/web/tests/groupsMembersUpdate.test.ts` — hook 테스트 1
- `packages/web/tests/EditMemberRoleDialog.test.tsx` — 다이얼로그 시나리오 4

**수정 대상**:
- `packages/functions/src/index.ts` — export 추가
- `firebase.json` — hosting rewrite (`/api/groupsMembersUpdate`) 추가
- `packages/web/src/routes/admin/MembersTable.tsx` — 「역할 변경」 버튼 + 다이얼로그 통합
- `packages/web/tests/MembersTable.test.tsx` (기존 있으면) 또는 신규 회귀 — 「역할 변경」 버튼 렌더 시나리오 1

**손대지 마라**:
- middleware · writeAudit · directoryClient · onUserCreate — 그대로.
- insert/delete/list — 그대로.
- 다른 라우트 · 컴포넌트.

### 세부 요구

#### 1. `groups/members/update.ts` — 새 callable

`groups/members/insert.ts` (`packages/functions/src/callable/groups/members/insert.ts`) 를 그대로 참고. 다른 점:

**입력 스키마**:
```ts
export interface GroupsMembersUpdateRequest {
  groupEmail: string;
  memberEmail: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';   // insert 는 optional 이었지만 update 는 required
}
export interface GroupsMembersUpdateResponse {
  groupEmail: string;
  memberEmail: string;
  role: string;
}
```

**필수 스코프**: `admin.directory.group.member` (insert 와 동일).
**필수 캡**: `groups.write`.

**핵심 로직**:
```ts
const directory = getDirectoryClient(user.googleAccessToken);
await directory.members.update({
  groupKey: trimmedGroupEmail,
  memberKey: trimmedMemberEmail,
  requestBody: { role },
});
```

주의: Directory API 는 `directory.members.update` (top-level `members`), 아니라 `directory.groups.members.update` 아님. 라이브러리 표기 확인. insert 는 `directory.groups.members.insert` 로 되어 있음 (`packages/functions/src/callable/groups/members/insert.ts:113`) — googleapis v154 이후 두 표기 모두 지원. 기존 스타일 (`directory.groups.members.*`) 사용.

**audit**:
- action: `groups.write`
- target: `trimmedGroupEmail`
- 성공 message: `updated ${trimmedMemberEmail} role to ${role} in group ${trimmedGroupEmail}`

**검증**:
- `role` 필수. 없으면 `invalid-argument`, `role_required`.
- `role` 이 `OWNER`/`MANAGER`/`MEMBER` 아니면 `invalid-argument`, `invalid_role`.
- `groupEmail`·`memberEmail` 도메인 검증 (insert 와 동일).

#### 2. `functions/src/index.ts` — export 추가

기존 순서 유지. `groupsMembersDelete` 다음 줄에:
```ts
export { groupsMembersUpdate } from './callable/groups/members/update.js';
```

#### 3. `firebase.json` — hosting rewrite

기존 `/api/auditLogList` 항목 다음에 (rewrites 배열, `**` fallback 앞):
```json
{
  "source": "/api/groupsMembersUpdate",
  "function": { "functionId": "groupsMembersUpdate", "region": "asia-northeast3" }
}
```

#### 4. `groups.members.update` 테스트 (6~8 시나리오)

`packages/functions/tests/groupsMembersInsert.test.ts` 를 참고 (있으면). 없으면 insert 패턴 그대로.

시나리오:
1. 미인증 → `unauthenticated`, denied audit
2. 캡 부족 (teacher) → `permission-denied`, denied audit
3. 스코프 부족 → `permission-denied`, denied audit
4. `role` 누락 → `invalid-argument` `role_required`, error audit
5. `role` 유효하지 않음 (`ADMIN` 등) → `invalid-argument` `invalid_role`, error audit
6. `groupEmail` 도메인 불일치 → `invalid-argument`, error audit
7. `memberEmail` 도메인 불일치 → `invalid-argument`, error audit
8. 정상 (`MEMBER` → `MANAGER`) → Directory API 호출 params 확인, ok audit 메시지 포함

#### 5. `packages/web/src/api/groupsMembersUpdate.ts` — hook

`groupsMembersInsert.ts` (`packages/web/src/api/groupsMembersInsert.ts`) 대칭:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface GroupsMembersUpdateRequest {
  groupEmail: string;
  memberEmail: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
}
export interface GroupsMembersUpdateResponse {
  groupEmail: string;
  memberEmail: string;
  role: string;
}

export async function callGroupsMembersUpdate(
  data: GroupsMembersUpdateRequest,
): Promise<GroupsMembersUpdateResponse> {
  // insert 와 동일 패턴: DEV emulator URL vs 프로덕션 cloudfunctions.net,
  // body 에 _googleAccessToken 포함, X-Google-Access-Token / X-Request-Id 헤더.
  // function 이름: groupsMembersUpdate
}

export function useUpdateMemberRole(groupEmail?: string) {
  const queryClient = useQueryClient();
  return useMutation<GroupsMembersUpdateResponse, Error, GroupsMembersUpdateRequest>({
    mutationFn: (data) => callGroupsMembersUpdate(data),
    onSuccess: (_data, variables) => {
      const targetGroup = variables?.groupEmail || groupEmail;
      if (targetGroup) {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', targetGroup] });
        queryClient.invalidateQueries({ queryKey: [`groups/members/${targetGroup}`] });
      }
    },
  });
}
```

#### 6. `EditMemberRoleDialog.tsx` — 역할 변경 다이얼로그

`AddMemberDialog.tsx` (`packages/web/src/routes/admin/AddMemberDialog.tsx`) 를 참고. 다른 점:
- 이메일 입력 없음 (기존 멤버 대상). `memberEmail` prop 으로 받음.
- `currentRole` prop 표시 (현재 역할 강조).
- 「역할 변경」 버튼 텍스트.

**Props**:
```ts
export interface EditMemberRoleDialogProps {
  groupEmail: string;
  memberEmail: string;
  currentRole: 'OWNER' | 'MANAGER' | 'MEMBER' | string;   // string 은 예외 대비
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**구조**:
- 헤더: `그룹 멤버 역할 변경`
- 표시: `그룹 · 멤버 이메일 · 현재 역할`
- 라디오 3 개 (MEMBER · MANAGER · OWNER). 초기값 = currentRole 이면 그것, 아니면 MEMBER.
- 버튼: 취소 / 변경 (초기 role === currentRole 이면 disabled)
- 성공 시 다이얼로그 닫기 + 캐시 무효화 (hook 이 이미 처리).
- 오류 시 다이얼로그 안에서 표시.

data-testid: `edit-member-role-dialog`, `edit-member-role-{r}` (라디오), `edit-member-role-submit`, `edit-member-role-error`.

#### 7. `MembersTable.tsx` — 「역할 변경」 버튼

기존 「제거」 버튼 옆에 「역할 변경」 버튼 추가. 관리 컬럼이 이미 있음 (`packages/web/src/routes/admin/MembersTable.tsx:94-103`).

```tsx
<Button
  variant="secondary"
  onClick={() => setRoleEditTarget(member)}
  data-testid={`edit-role-btn-${member.email}`}
>
  역할 변경
</Button>
```

state 추가: `const [roleEditTarget, setRoleEditTarget] = useState<GroupMemberItem | null>(null);`

렌더: 다이얼로그를 컴포넌트 하단에 (RemoveMemberDialog 처럼).

#### 8. 테스트

**functions `groupsMembersUpdate.test.ts`** (6~8 시나리오 — 위 4번 항목).

**web `groupsMembersUpdate.test.ts`** (1 시나리오):
- `callGroupsMembersUpdate({groupEmail, memberEmail, role: 'MANAGER'})` → fetch body 에 세 필드 + `_googleAccessToken` 포함 확인.

**web `EditMemberRoleDialog.test.tsx`** (4 시나리오):
1. `open=false` → 컨텐츠 렌더되지 않음
2. `open=true` → 현재 역할 라디오 체크됨
3. 다른 역할 선택 → 「변경」 버튼 활성화
4. 「변경」 클릭 → mutation 호출 + 성공 시 `onOpenChange(false)`

**web `MembersTable.test.tsx`** (1 회귀 — 파일 있으면 확장):
- 각 행에 「역할 변경」 버튼 렌더 (`edit-role-btn-{email}` 존재).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과 (functions build 결과 `groupsMembersUpdate.js` 존재).
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 428 + 신규 12 근처 = 440 근처.
5. `pnpm -r test:emu` — 이전 43 유지 (신규 emu 없음).
6. dev 서버 확인:
   - 그룹 상세 → 멤버 각 행에 「역할 변경」 버튼
   - 클릭 → 다이얼로그 열림, 라디오 현재 값 선택
   - 다른 역할 선택 → 「변경」 활성화 → 클릭 → 다이얼로그 닫힘, 표 리로드
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Directory API `members.update` 응답** — 사용자 확인.
- **역할 변경 감사 로그 CSV 표시** — 감사 로그가 이미 자동으로 잡음, 별도 UI 불필요.
- **OWNER 마지막 1인 delete/downgrade 금지** — Directory API 가 자체 검증 (마지막 OWNER 는 못 지움/못 강등). 별도 방어 코드 불필요, error audit 로 기록됨.

### 커밋 규칙

**3 커밋 분리**:
1. `feat(functions): groups.members.update callable (역할 변경) + firebase.json rewrite`
2. `feat(web): useUpdateMemberRole hook + callGroupsMembersUpdate`
3. `feat(web): EditMemberRoleDialog + MembersTable 역할 변경 버튼`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/members-update-v31`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
