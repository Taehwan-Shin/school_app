# DESIGN_v1 — 학교 워크스페이스 관리 웹앱

> 이 문서는 **무엇을 만들지**의 단일 원본. 「어떻게 굴릴지」는 `AGENTS.md`, 「지금 상태」는 `STATUS.md`. 규칙 본문 복사 금지 — 이 문서는 결정만 담는다.
>
> **범위** — v1.0 = 원본 두 Apps Script 파일(`계정관리.gs` · `클래스룸관리.gs`) 의 실제 사용 기능을 파이어베이스 기반 웹앱으로 옮기는 최소 완성체.

---

## 1. 왜 이걸 만드는가

**사용자 원문** (`project_notes.md` 2026-08-30 킥오프 참조):
> "이 두 파일에 있는 기능을 파이어베이스 기반으로 구축해서 직관적이고 편리한 웹앱으로 만들고 싶어"

- 지금은 관리자가 Google Sheets 를 열고 사용자 정의 메뉴를 눌러서 계정·그룹·챗방·클래스룸을 조작함.
- 시트가 UI 겸 데이터 저장소여서 **동시 편집이 위험**하고, **누가 언제 뭘 했는지 흔적이 시트 셀에만 남음**.
- 웹앱으로 옮기면 **역할별 첫 화면**, **입력 검증**, **작업 이력(audit_log)**, **일괄 작업 진행률** 이 확보됨.

## 2. 파이어베이스 배치

| 자리 | 담당 | 대체 불가한 부분 |
|---|---|---|
| Firebase Hosting | 웹 SPA 서빙 | — |
| Firebase Auth | Google 로그인 (도메인 제한) | — |
| Firestore | 앱 상태 (기초값·작업 큐·감사 로그) | — |
| Cloud Functions (2세대) | 워크스페이스 API 호출의 **유일한 통로** | 서비스 계정 자격증명은 여기서만 로드 |
| Google Admin SDK / Classroom / Chat / Gmail API | 실제 워크스페이스 조작 | **Firebase 로 대체 불가** — 함수 안에서 서비스 계정으로 호출 |

**원칙** — 클라이언트는 **Firestore 와 Callable Function 만** 부른다. Google API 는 절대 클라이언트에서 부르지 않는다.

## 3. 역할 · 권한 매트릭스

### 3.1 역할 셋

| 역할 | 누구 | 첫 화면 |
|---|---|---|
| `super_admin` | 시스템 관리자 (개발자) | 감사 로그 · 함수 상태 · 위험 조작 |
| `admin` | 정보부장 등 실제 운영자 | 계정·그룹·챗방·클래스룸 대시보드 |
| `teacher` | 교사 | 본인 담당 클래스룸 목록 (읽기 위주) |

### 3.2 「차등 부여」를 지탱하는 구조 `[사용자 결정 2026-08-30]`

**하드코딩 금지** — 코드 어디에도 `if (role === 'admin')` 을 쓰지 않는다. 대신:

1. **권한(capability) 카탈로그** — 한 파일 (`functions/src/authz/capabilities.ts`) 이 모든 권한 이름을 열거:
   ```
   users.read       users.write        users.delete       users.reset_password
   groups.read      groups.write       groups.delete
   chat.read        chat.write         chat.delete
   classroom.read   classroom.write    classroom.transfer_owner   classroom.archive
   basic_data.read  basic_data.write
   audit.read       system.manage_roles
   ```
2. **역할 → 권한 매핑** — 같은 파일이 매트릭스 하나를 노출:
   ```ts
   export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
     super_admin: new Set([...ALL]),
     admin: new Set([<위 목록에서 system.manage_roles 뺀 전부>]),
     teacher: new Set(['classroom.read']),
   };
   ```
3. **모든 검사부** — `if (userHasCap(user, 'users.write'))` 만 씀.
4. **나중에 「부장」 이 필요해지면** — `Role` 유니온에 `'dept_head'` 추가, `ROLE_CAPABILITIES` 에 원하는 권한 집합 추가. **검사부 코드는 안 바뀐다.**

### 3.3 Firestore Security Rules 반영

- Custom Claims 에 `role` 하나 넣는다 (역할 문자열).
- Rules 안에서 권한 이름을 참조하는 헬퍼는 **없다** — Rules 는 「이 컬렉션은 이 역할들만」 수준까지만. **세밀한 권한 검사는 Callable Function 이 담당** (함수 안에서 `assertHasCap(context, 'users.write')` 첫 줄).
- 근거 — Rules 는 정적 정책 언어라 매트릭스를 유연하게 표현하기 힘들다. 함수 안에서 하면 매트릭스 파일 하나로 관리 가능.

## 4. 데이터 모델 (Firestore)

| 컬렉션 | 용도 | 쓰기 주체 |
|---|---|---|
| `users/{uid}` | 로그인 사용자 프로필 (email · role · displayName · lastSeenAt) | 함수만 (Auth 트리거 · role 변경 함수) |
| `basic_data/{year}` | 원본 「기초값」 시트 대체 (학년·반·부서 구조) | 클라이언트 (`admin` 이상) |
| `initial_accounts/{docId}` | 초기 계정 부트스트랩 목록 | 클라이언트 (`admin` 이상) |
| `jobs/{jobId}` | 일괄 작업 상태 (kind · args · status · progress · createdBy · error) | 함수만 |
| `job_events/{jobId}/{eventId}` | 일괄 작업의 개별 스텝 결과 | 함수만 |
| `audit_log/{docId}` | 모든 쓰기·삭제 이력 (actor · action · target · before/after · at) | **함수만** (Rules 로 클라이언트 완전 차단) |

**시트 대응** — 「전체 계정 현황」·「그룹 배정 현황」·「구글챗 현황」은 **Firestore 에 저장하지 않는다** (원본이 API 결과의 표시일 뿐). 웹 화면이 함수를 호출해서 워크스페이스에서 실시간으로 읽어 표시.

## 5. audit_log 무결성 규율 `[사용자 결정 2026-08-30]`

**(a) 코드 규율 기반** 확정. 관문 넷:

1. **Firestore Rules** — `match /audit_log/{doc}` 에 `allow read: if hasCap('audit.read'); allow write: if false;` — 클라이언트 write 완전 차단.
2. **함수 코드 안의 헬퍼** — `functions/src/audit/writeAudit.ts` 하나만 admin SDK 로 `audit_log` 컬렉션에 쓴다. 인자 스키마 강제 (`actor`, `action`, `target`, `before?`, `after?`).
3. **AST 규칙** — `eslint` `no-restricted-syntax` 로 `admin.firestore().collection('audit_log')` 직접 호출 금지. `writeAudit` 만 통과.
4. **에뮬레이터 테스트** — (a) 클라이언트 write 시도가 Rules 에 의해 거부되는지, (b) `writeAudit` 호출 시 정확한 스키마로 저장되는지, (c) 헬퍼 우회 시도 (직접 `.collection('audit_log')`) 가 lint 에서 실패하는지.

**모든 상태 변경 함수** (`users.write` · `groups.delete` · `classroom.transfer_owner` 등) 는 마지막 단계에서 `writeAudit(...)` 를 호출해야 한다. 이 규칙은 코드 리뷰 (감사 Codex) 의 필수 확인 항목.

## 6. Cloud Functions 목록 (v1.0)

원본 두 파일의 함수를 **Callable Function** 으로 매핑. 각 함수는 (1) 권한 검사 → (2) 입력 검증 → (3) Google API 호출 → (4) `writeAudit` 순서.

### 6.1 계정관리 (원본: `계정관리.gs`)

| Callable | 권한 | 원본 함수 | 비고 |
|---|---|---|---|
| `users.list` | `users.read` | `fetchAllUsersToSheet` | 결과는 응답으로 반환, 시트에 안 씀 |
| `users.createBulk` | `users.write` | `initialAccountSetup` · `laterAccountSetup` | 큰 배치는 `jobs` 로 |
| `users.delete` | `users.delete` | `deleteUsers` | 확인 다이얼로그 필수 |
| `users.resetPasswords` | `users.reset_password` | `updateUserPasswords` | |
| `users.sendDeletionMail` | `users.delete` | `sendMailtoUsers` | Gmail API 사용 `[사용자 결정 2026-08-30: 활성화]` |
| `groups.list` | `groups.read` | `fetchAllGroupAssignments` | |
| `groups.create` | `groups.write` | `createGroups` | |
| `groups.delete` | `groups.delete` | `deleteGroups` | |
| `groups.assign` | `groups.write` | `assignGroups` | |
| `groups.removeMembers` | `groups.write` | `removeMembersFromGroups` | |
| `chat.list` | `chat.read` | `fetchAllChatSpaces` | |
| `chat.create` | `chat.write` | `createGoogleChatRooms` · `createChatSpacesFromBasicData` | |
| `chat.delete` | `chat.delete` | `deleteSelectedChatSpaces` | |
| `chat.assign` | `chat.write` | `assignMembersToChatRooms` | |
| `basic_data.get` | `basic_data.read` | `setupBasicData` (읽기 부분) | Firestore 에서 읽음 |
| `basic_data.import` | `basic_data.write` | `importInitialStudentData` | |

### 6.2 클래스룸관리 (원본: `클래스룸관리.gs`)

| Callable | 권한 | 원본 함수 |
|---|---|---|
| `classroom.listByOwner` | `classroom.read` | `listClassroomsByOwner` · `updateClassroomListIfNeeded` |
| `classroom.listAll` | `classroom.read` | `listAllClassrooms` |
| `classroom.addRoster` | `classroom.write` | `addRosterWithSuccessMessage` · `directlyAddMemberToClassroom` |
| `classroom.deleteRoster` | `classroom.write` | `deleteRoster` |
| `classroom.renameBulk` | `classroom.write` | `updateAndLogClassroomNames` |
| `classroom.transferOwner` | `classroom.transfer_owner` | `transferClassroomOwnershipAndUpdateSheet` |
| `classroom.archive` | `classroom.archive` | `archiveClassrooms` · `archiveAndManageClassrooms` |

## 7. 인증 흐름

1. 웹앱에서 「Google 로 로그인」 → Firebase Auth (Google Provider) → ID Token.
2. Auth 트리거 함수가 첫 로그인 시 `users/{uid}` 문서 생성 — 도메인 검증 (특정 워크스페이스 이메일만 허용), 초기 role 은 `teacher`.
3. **role 승격** — `super_admin` 만 `users.updateRole` 함수 호출 가능. 함수가 Custom Claims 를 갱신하고 `writeAudit`.
4. 클라이언트는 `onIdTokenChanged` 로 role 을 감지하고 첫 화면 라우팅.

## 8. 서비스 계정 스코프

**열린 결정** (`STATUS.md` 참조) — 사용자에게 서비스 계정 유무 확인 대기 중.

필요한 도메인 위임 스코프:
- `https://www.googleapis.com/auth/admin.directory.user` — 사용자 CRUD
- `https://www.googleapis.com/auth/admin.directory.group` — 그룹 CRUD
- `https://www.googleapis.com/auth/admin.directory.group.member` — 멤버 배정
- `https://www.googleapis.com/auth/admin.directory.orgunit` — 조직 단위
- `https://www.googleapis.com/auth/classroom.courses` — 클래스룸 CRUD
- `https://www.googleapis.com/auth/classroom.rosters` — 학생·교사 배정
- `https://www.googleapis.com/auth/chat.spaces` — 챗방 CRUD
- `https://www.googleapis.com/auth/chat.memberships` — 챗방 멤버
- `https://www.googleapis.com/auth/gmail.send` — 계정 삭제 안내 메일 `[사용자 결정 2026-08-30]`

## 9. 기술 스택

| 자리 | 선택 | 이유 |
|---|---|---|
| 프론트 프레임워크 | **Vite + React + TypeScript** | 원본 방법론 문서에서 사용자가 언급한 스택. 파이어베이스 SDK 와 정합. |
| UI 라이브러리 | **shadcn/ui + Tailwind** | 「직관적이고 편리한」 요구에 시각적 일관성 확보. 사용자 원문 참조. |
| 상태 관리 | **TanStack Query** (서버 상태) + React Context (앱 전역) | Callable Function 결과 캐시·재시도. |
| 함수 | **Firebase Functions 2세대 (Node 20)** | Callable 지원. |
| 언어 (함수) | **TypeScript** | 프론트와 타입 공유 (`shared/` 폴더). |
| 테스트 | **Vitest** (유닛) + **Firebase Emulator Suite** (통합) | Rules · Functions · Auth 통합 테스트. |
| 린트 | **ESLint** (`no-restricted-syntax` 로 audit_log 우회 차단) | §5 관문 ③ |
| 패키지 매니저 | **pnpm** | 워크스페이스 (프론트·함수·공유 타입) |

## 10. 저장소 구조 (예정)

```
school-webapp/
├── AGENTS.md                    (규칙, 이 저장소 안으로 옮김)
├── STATUS.md                    (진행 상황)
├── project_notes.md             (일지)
├── docs/
│   ├── DESIGN_v1.md            (이 파일)
│   └── handoff/NEXT.md         (일꾼 오더)
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/                  타입 · 상수 (프론트·함수 공유)
│   ├── web/                     Vite + React
│   │   └── src/routes/
│   │       ├── login.tsx
│   │       ├── super_admin/
│   │       ├── admin/
│   │       └── teacher/
│   └── functions/               Cloud Functions
│       └── src/
│           ├── authz/           역할·권한 매트릭스, assertHasCap
│           ├── audit/           writeAudit 헬퍼
│           ├── users/
│           ├── groups/
│           ├── chat/
│           ├── classroom/
│           └── basic_data/
└── emulator/
    └── tests/
```

**저장소 위치** — `STATUS.md` 의 열린 결정. Buzz `repos create` 또는 GitHub. 결정 나면 위 구조를 그 저장소로 옮김.

## 11. v1.0 완료 조건

- [ ] 세 역할이 각자 첫 화면에서 자기 권한 안의 조작이 가능하다.
- [ ] 원본 두 파일의 모든 함수(§6 표) 가 대응 Callable 로 존재하고, 각각 최소 1 개의 에뮬레이터 테스트가 통과한다.
- [ ] `audit_log` §5 관문 넷이 모두 켜져 있고, 우회 시도 테스트가 실패로 확인된다.
- [ ] 「Antigravity 가 만든 커밋을 Codex 가 검토」 사이클이 최소 3 회 돌았다.
- [ ] 첫 번째 실 사용자(bliss00) 가 관리자 자격으로 실제 워크스페이스에서 계정 하나 만들고 삭제하는 데 성공한다.

## 12. v1.0 밖 (나중)

- 부장 역할 · 학년별 관리자 등 세분화 → §3.2 구조로 커버 (역할 추가만 하면 됨)
- 일괄 작업 진행률 UI 고도화 (지금은 최소 표시)
- 이메일 템플릿 편집기 (지금은 하드코딩)
- 시트 백업/내보내기 (지금 원본 시트는 참고용으로만 남김)
