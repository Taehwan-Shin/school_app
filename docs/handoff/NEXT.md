# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Groups CRUD 프론트엔드 v0.15** — v0.13/v0.14 의 groups.create/update/delete callable 을 UI 로 노출. 「+ 그룹 추가」 버튼 + 행별 「편집 · 삭제」 링크 + 3 다이얼로그.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/groups-ui-crud-v15`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 4~5 개.

**Designer 몫**: 스타일 값은 `docs/design/UI_SYSTEM.md` §4.5·§4.6·§4.7 + accounts CRUD 다이얼로그 (CreateUserDialog · EditUserDialog · DeleteUserDialog) 패턴 그대로. 새 값 발명 금지.

## 기준 커밋

**Base**: `e9d1968` (Groups CRUD 완결 v0.14)

## 지금 할 것 — Groups CRUD UI

### 왜

v0.13/v0.14 로 백엔드 CRUD 완결됐지만 UI 는 v0.12 목록 뷰만 있고 조작 없음. 이 슬라이스가 조작을 붙여 그룹을 브라우저에서 관리 가능하게.

**하지 않는 것**: 그룹 멤버 관리 (다음 슬라이스, `groups.members`). 그룹 정책·별칭 편집 (별도 slice). 검색·정렬·페이지네이션 (accounts v0.4-v0.6 패턴, 다음 슬라이스). KPI 카드 (별도).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/GroupsTable.tsx` — 「+ 그룹 추가」 버튼 + 행별 「편집 · 삭제」 + 3 다이얼로그 렌더.
- `packages/web/tests/GroupsTable.test.tsx` — 신규 UX 시나리오 3 추가.

**신규 파일**:
- `packages/web/src/api/groupsCreate.ts` — API 클라이언트 (`usersCreate.ts` 미러).
- `packages/web/src/api/groupsUpdate.ts` — (`usersUpdate.ts` 미러).
- `packages/web/src/api/groupsDelete.ts` — (`usersDelete.ts` 미러).
- `packages/web/src/routes/admin/CreateGroupDialog.tsx` — (`CreateUserDialog` 미러).
- `packages/web/src/routes/admin/EditGroupDialog.tsx` — (`EditUserDialog` 미러).
- `packages/web/src/routes/admin/DeleteGroupDialog.tsx` — (`DeleteUserDialog` 미러).
- `packages/web/tests/groupsCreate.test.tsx` — API 시나리오 5.
- `packages/web/tests/groupsUpdate.test.tsx` — API 시나리오 5.
- `packages/web/tests/groupsDelete.test.tsx` — API 시나리오 5.
- `packages/web/tests/CreateGroupDialog.test.tsx` — 다이얼로그 시나리오 5.
- `packages/web/tests/EditGroupDialog.test.tsx` — 다이얼로그 시나리오 5.
- `packages/web/tests/DeleteGroupDialog.test.tsx` — 다이얼로그 시나리오 5.

**손대지 마라**:
- 계정 관련 파일 (`AccountsTable` · `KpiCard` 등) — 이 슬라이스 밖.
- 백엔드 (`packages/functions/*`) — v0.14 완료.

### 세부 요구

#### 1. API 클라이언트 3 개 (`groupsCreate.ts` · `groupsUpdate.ts` · `groupsDelete.ts`)

`usersCreate.ts` · `usersUpdate.ts` · `usersDelete.ts` 패턴 그대로. 각 파일:
- 인터페이스 (Request/Response) 백엔드와 일치
- `callGroupsXxx()` async 함수 — fetch 기반
- `useCreateGroup()`/`useUpdateGroup()`/`useDeleteGroup()` mutation hook — `onSuccess` 시 `queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })`
- URL: 프로덕션 `https://asia-northeast3-${projectId}.cloudfunctions.net/${fn}`, 개발 emulator
- 헤더 + body 규칙: `_googleAccessToken` in body, Authorization Bearer idToken, X-Request-Id
- 인터페이스는 백엔드 `groups/create.ts`·`update.ts`·`delete.ts` 의 것과 정확히 일치

**groupsCreate**:
```ts
export interface GroupsCreateRequest {
  email: string;
  name: string;
  description?: string;
}
export interface GroupsCreateResponse {
  email: string;
  id: string;
}
```

**groupsUpdate**:
```ts
export interface GroupsUpdateRequest {
  email: string;
  name?: string;
  description?: string;
}
export interface GroupsUpdateResponse {
  email: string;
  updatedFields: string[];
}
```

**groupsDelete**:
```ts
export interface GroupsDeleteRequest {
  email: string;
}
export interface GroupsDeleteResponse {
  email: string;
  deleted: true;
}
```

#### 2. `CreateGroupDialog.tsx` (신규)

`CreateUserDialog.tsx` 마크업·패턴 그대로. 다른 점:
- 필드: **이메일** (예: `team-a@cam.hs.kr`) · **이름** · **설명** (옵션)
- 이메일 도메인 검증 (`endsWith('@cam.hs.kr')`)
- 이름 검증 (trim 후 비어있으면 안 됨)
- 설명은 옵션, 빈 문자열 허용 (백엔드도 옵션)
- 성공 시 다이얼로그 닫힘 + `useUpdateGroup` mutation 이 `groups/list` invalidate → 표 자동 새로고침
- 오류 매핑: `permission-denied` → 「그룹 생성 권한이 없거나 스코프가 부족합니다.」, `invalid_email_domain` → 「허용되지 않는 이메일 도메인입니다.」

#### 3. `EditGroupDialog.tsx` (신규)

`EditUserDialog.tsx` 패턴. 다른 점:
- 필드: **이메일** (읽기 전용 · `bg-surface` 박스) · **이름** · **설명**
- pre-fill `useEffect` 로 `group` prop 감지 시 초기값 세팅
- 부분 편집: 변경된 필드만 payload
- 변경 없음 검증 (「변경된 내용이 없습니다.」)
- 오류: `permission-denied` → 「그룹 편집 권한이 없습니다.」

**Props**:
```ts
export interface EditGroupTarget {
  email: string;    // 읽기 전용
  name: string;
  description: string;
}
export interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: EditGroupTarget | null;
}
```

#### 4. `DeleteGroupDialog.tsx` (신규)

`DeleteUserDialog.tsx` 패턴. 다른 점:
- 대상 표시: `text-body font-mono` 그룹 이메일 + 「이름」 (별도 줄)
- 확인 입력: 「삭제하려면 그룹 이메일을 다시 입력하세요」
- 하단 버튼: Secondary 취소 + Danger Primary 삭제
- **주의 메시지**: 「이 작업은 되돌릴 수 없습니다. 그룹의 모든 멤버십이 자동 해제됩니다.」

**Props**:
```ts
export interface DeleteGroupTarget {
  email: string;
  name: string;
}
```

#### 5. `GroupsTable.tsx` 개편

**현재** — 상단에 「+ 그룹 추가」 버튼 없음, 각 행 액션 열 없음.

**변경 후**:
- 상단 로우 (표 위): 왼쪽 설명 + 오른쪽 「+ 그룹 추가」 버튼
- 6 컬럼 표 (기존 5 개 + 관리 열):
  - 이메일 · 이름 · 설명 · 별칭 · 멤버 수 · **관리** (기존 5 + 관리)
- 관리 열: 「편집 · 삭제」 (`AccountsTable` 패턴)
- 편집 클릭 → `EditGroupDialog` 열림 (해당 그룹 pre-fill)
- 삭제 클릭 → `DeleteGroupDialog` 열림
- 상태 state 추가: `isCreateOpen`, `editTarget`, `deleteTarget`
- 표 최하단에 3 다이얼로그 렌더

**참고**: 그룹의 「자기 그룹 삭제 금지」 같은 규칙 없음. Delete 는 자유롭게 (백엔드 admin 은 언제나 가능).

#### 6. 테스트

**각 API 클라이언트 (3 파일 × 5 시나리오)**:
1. `not_authenticated` → throw
2. 성공 — 200 응답 파싱
3. 4xx (permission-denied) → throw
4. `_googleAccessToken` 포함 여부 body 검증
5. hook onSuccess — invalidate `groups/list`

**각 다이얼로그 (3 파일 × 5 시나리오)** — `MemoryRouter` 래퍼:
- `Create`: 렌더 · 검증 (이메일 도메인 · 이름 필수) · 성공 · permission-denied 매핑 · 취소 리셋
- `Edit`: user 없음 · pre-fill · 변경 없음 검증 · 성공 (부분 편집 payload) · permission-denied 매핑
- `Delete`: 렌더 · 이메일 재입력 검증 · 성공 · 오류 매핑 · 취소

**`GroupsTable.test.tsx`** — 신규 3:
- 「+ 그룹 추가」 버튼 렌더 + 클릭 시 CreateGroupDialog 열림
- 편집 링크 클릭 시 EditGroupDialog 가 해당 그룹으로 pre-fill 되어 열림
- 삭제 링크 클릭 시 DeleteGroupDialog 열림

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 246 + 신규 30~33 = 276 근처.
5. dev 서버 로컬 눈 확인:
   - `/admin/groups` 상단 「+ 그룹 추가」 버튼
   - 각 행 관리 열 「편집 · 삭제」
   - 다이얼로그 3 개 정상 열림/닫힘
   - 다크 모드 자연 전환
6. 프로덕션 번들 grep — emulator 코드 0 건.

### 판정 불가

- **실 워크스페이스 그룹 CRUD 실측** — 배포 후 사용자님이 실행 테스트 예정.
- **검색·정렬·페이지네이션** — 다음 슬라이스 (accounts v0.4-v0.6 패턴 재사용).
- **KPI 카드** — 다음 slice.
- **멤버 관리** — 별도 slice.

### 커밋 규칙

**4~5 커밋 분리**:
1. `feat(web): groupsCreate·Update·Delete API 클라이언트 + hook`
2. `feat(web): CreateGroupDialog 컴포넌트`
3. `feat(web): EditGroupDialog 컴포넌트`
4. `feat(web): DeleteGroupDialog 컴포넌트`
5. `feat(web): GroupsTable 에 CRUD 통합 (버튼 · 링크 · 다이얼로그)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/groups-ui-crud-v15`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 결과
- 오더 대비 차이
