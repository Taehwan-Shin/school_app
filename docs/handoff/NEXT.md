# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **users.create + users.delete 슬라이스** — 첫 쓰기 계열 관리 기능.
> `DESIGN_v1.md` §11 완료 조건 「계정 하나 만들고 삭제」의 서버·UI 절반.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/...`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest · emu 테스트

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 2~4개로 분리.

## 기준 커밋

**Base**: `4f4fc39` (accounts UI 병합 승인 반영)

## 지금 할 것 — users.create + users.delete (서버 + UI)

### 왜

세 번째 관리 기능. 원본 `계정관리.gs` 의 `laterAccountSetup` (전입생 계정 생성) 과 `deleteUsers` 대응. 「계정 하나 만들고 삭제」 는 사용자의 v1.0 완료 조건 (`DESIGN_v1.md` §11) 이므로 이 슬라이스가 그 서버·UI 층을 완성한다.

### 이 과제가 바꿀 경로

**신규 파일 (functions)**:
- `packages/functions/src/callable/users/create.ts` — `usersCreate` callable
- `packages/functions/src/callable/users/delete.ts` — `usersDelete` callable
- `packages/functions/tests/usersCreate.test.ts` — 단위
- `packages/functions/tests/usersDelete.test.ts` — 단위
- `packages/functions/tests/usersCreate.emu.test.ts` — 에뮬레이터 HTTP 종단 (stub 파일 활용)
- `packages/functions/tests/usersDelete.emu.test.ts` — 에뮬레이터 HTTP 종단

**신규 파일 (web)**:
- `packages/web/src/api/usersCreate.ts` — `useCreateUser` mutation 훅 (TanStack Query)
- `packages/web/src/api/usersDelete.ts` — `useDeleteUser` mutation 훅
- `packages/web/src/routes/admin/CreateUserDialog.tsx` — 계정 생성 다이얼로그
- `packages/web/src/routes/admin/DeleteUserDialog.tsx` — 삭제 확인 다이얼로그
- `packages/web/tests/usersCreate.test.tsx` — 훅 단위
- `packages/web/tests/usersDelete.test.tsx` — 훅 단위
- `packages/web/tests/CreateUserDialog.test.tsx` — 다이얼로그 단위
- `packages/web/tests/DeleteUserDialog.test.tsx` — 다이얼로그 단위

**기존 파일 수정**:
- `packages/functions/src/index.ts` — `usersCreate`, `usersDelete` export
- `packages/web/src/routes/admin/AccountsTable.tsx` — 「+ 계정 추가」 버튼 · 각 행에 「삭제」 버튼
- `packages/web/src/routes/admin/index.tsx` — 다이얼로그 상태 관리
- shadcn/ui Dialog 컴포넌트 추가 (`pnpm dlx shadcn@latest add dialog`)

### 세부 요구

#### 1. `usersCreate` callable

**입력** (요청 body `data`):
```ts
interface UsersCreateRequest {
  primaryEmail: string;         // 반드시 @cam.hs.kr
  givenName: string;
  familyName: string;
  password: string;             // 최소 8자
  orgUnitPath?: string;         // 기본 '/'
  changePasswordAtNextLogin?: boolean;  // 기본 true
}
```

**동작**:
- 미들웨어 통과 (`users.write` cap 필요)
- 입력 검증: 이메일 도메인 · 이름 필수 · 비번 길이
- Google Admin Directory `users.insert` 호출
- 성공 시 `writeAudit(action: 'users.write', target: primaryEmail, result: 'ok')`
- 실패 시 `result: 'error'` 감사 후 rethrow
- 반환: `{ primaryEmail, uid: 생성된 사용자 id }`

**스코프**: `https://www.googleapis.com/auth/admin.directory.user` (readonly 아님).

#### 2. `usersDelete` callable

**입력**:
```ts
interface UsersDeleteRequest {
  primaryEmail: string;         // 반드시 @cam.hs.kr
}
```

**동작**:
- 미들웨어 통과 (`users.delete` cap 필요)
- **본인 삭제 방지** — 로그인 사용자와 같은 이메일이면 `HttpsError('failed-precondition', 'cannot_delete_self')`
- **super_admin 삭제 방지** — `admin` 이 다른 `super_admin` 을 삭제 못 함. `super_admin` 은 다른 계정 삭제 가능
  - 대상 사용자 조회 → `isAdmin` 이면 actor 가 `super_admin` 인지 확인
- `directory.users.delete`
- writeAudit
- 반환: `{ primaryEmail, deleted: true }`

**스코프**: `admin.directory.user` (write 스코프 재사용).

#### 3. 미들웨어 · 스코프

- `lib/auth.tsx` `GOOGLE_LOGIN_SCOPES` 에 `admin.directory.user` (write) 추가
- 이 스코프는 users.write / users.delete 를 모두 커버
- 프론트 훅 헤더의 `X-Google-Scopes` 도 각 훅마다 필요한 것 명시

#### 4. UI — 다이얼로그 두 개

`CreateUserDialog.tsx`:
- shadcn/ui Dialog 사용
- 폼 필드: primaryEmail, givenName, familyName, password, orgUnitPath (선택)
- 검증: 클라이언트에서 최소 검증 (이메일 형식 · 필수 · 비번 길이)
- 「저장」 클릭 → `useCreateUser` mutation 호출 → 성공 시 다이얼로그 닫고 `queryClient.invalidateQueries({ queryKey: ['users', 'list'] })` 로 표 새로고침 → 성공 토스트
- 에러 표시 (permission-denied · scope 부족 · 이메일 중복 등)

`DeleteUserDialog.tsx`:
- **위험한 조작** — 명시적 확인
- 대상 이메일 · 이름 표시
- 「정말 삭제하려면 이메일을 다시 입력하세요」 확인 문구 (사고 방지)
- 입력이 대상 이메일과 정확히 일치할 때만 「삭제」 버튼 활성화
- 「삭제」 클릭 → `useDeleteUser` mutation → 성공 시 다이얼로그 닫고 표 새로고침
- 자기 계정·super_admin 등 서버 거부는 에러 메시지로 표시

#### 5. `AccountsTable` 수정

- 표 상단 오른쪽에 「+ 계정 추가」 버튼 (`super_admin`·`admin` 만 노출은 이미 `/admin` 라우트가 가드)
- 각 행 마지막 컬럼에 「삭제」 버튼 (자기 자신 행이면 `disabled` + 「자기 계정」 tooltip)

#### 6. 테스트

**단위 (functions)**:
- `usersCreate.test.ts` — mock googleapis. 케이스: 성공 · 이메일 도메인 잘못 · 이름 부재 · 비번 짧음 · googleapis 오류. 각 케이스 writeAudit 검증.
- `usersDelete.test.ts` — 성공 · self-delete 거부 · admin 이 super_admin 삭제 시도 거부 · googleapis 오류.

**단위 (web)**:
- `usersCreate.test.tsx`, `usersDelete.test.tsx` — 훅 mutation 성공·실패·로딩.
- `CreateUserDialog.test.tsx` — 폼 검증·제출·에러 표시.
- `DeleteUserDialog.test.tsx` — 이메일 재입력 검증 · disabled 상태 · 제출.

**에뮬레이터 통합 (functions)**:
- `usersCreate.emu.test.ts` — REST signUp → admin claim → HTTP POST 로 `usersCreate` 호출 → googleapis stub 이 성공 응답 → `audit_log` 에 ok · users write 라벨 확인
- `usersDelete.emu.test.ts` — 같은 방식으로 delete callable. self-delete 거부 시나리오 별도 케이스.

#### 7. Firestore rules

없음. audit_log 는 여전히 함수만 쓰기.

### 완료 확인 방법

1. `pnpm install` 통과 (shadcn dialog 종속 정합).
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 신규 단위 케이스 포함 총 80+ 통과.
5. `pnpm test:emu` — 신규 emu 케이스 포함 통과.
6. 프로덕션 번들 emulator grep 여전히 0 확인.

### 판정 불가로 두는 것

- **실 계정 생성·삭제** — 사용자 콘솔 (Identity Platform · OAuth 도메인) 완료 후 헤드가 실측.
- **CI 실행 결과** — 원격.

### 커밋 규칙

**최소 3~4 커밋 분리** (기능 크기 크므로 리뷰 편의):
1. `feat(functions): usersCreate callable + 단위 + emu 테스트`
2. `feat(functions): usersDelete callable + 안전장치 + 테스트`
3. `feat(web): create/delete mutation 훅 + 다이얼로그 컴포넌트`
4. `feat(web): AccountsTable 에 생성·삭제 버튼 통합`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/users-crud` (또는 유사).

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- prod 빌드 grep 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
