# roles.md — 역할·권한 매트릭스 (초안 v0.2)

> **상태**: 초안. Codex 감사 1차 반영 완료 (커밋 `7ab9c1a` 감사 → 이 문서). 사용자 확인 전.
> **왜 초안이라고 명시하는가**: 이 문서는 **결정**이 아니라 **제안**이다. 사용자가 문장을 바꾸기 전까지 확정된 것으로 다른 문서가 인용하지 않는다.
>
> **v0.2 변경점**: (1) §3-4 에 누락된 클래스룸 함수 4개(`listAllClassrooms`·`updateClassroomListIfNeeded`·`directlyAddMemberToClassroom`·`archiveClassrooms`) 추가. (2) §3-3 에 챗방 권한 설정 흐름(`configureChatSpacePermissions`) 추가. (3) §4 「자기 부서만」 강제 방법을 구체화 — 부서↔OU 매핑 · actor OU · target OU 대조를 명시. (4) §5-3 부트스트랩 위험 완화 명시.

## 1. 「역할」의 정의

**역할** = 로그인한 사람이 웹앱에서 **어떤 탭을 볼 수 있는가**, **어떤 API 호출을 서버가 대신 실행해 주는가** 를 정하는 라벨.

### 역할이 어디에서 왔는가

- **워크스페이스에는 「역할」 개념이 얇다** — 관리자 여부와 조직 단위(OU) 정도. 세분화된 「부장」·「담임」·「교사」·「조회자」는 워크스페이스가 몰라 준다.
- 그래서 이 앱이 **Firestore 에 역할 배정을 따로 저장**한다. 로그인한 이메일이 어느 역할인지 조회 → 화면·서버 API 게이팅.

### 판별 순서

1. 로그인 이메일 = 워크스페이스 슈퍼 관리자? (Google Directory API `isAdmin`)
2. Firestore `role_assignments/{email}` 조회 (있으면 그 역할)
3. 없으면 기본 = `viewer` (조회자, 최소 권한)

## 2. 역할 다섯 (초안)

| 역할 코드 | 라벨 | 누가 | 어떤 탭을 보나 |
|---|---|---|---|
| `super_admin` | 슈퍼 관리자 | 워크스페이스 관리자 권한자 | 모두 + 역할 배정 관리 |
| `admin` | 관리자 | 정보부장 · 담당 부장 | 계정·그룹·챗방·클래스룸 전체 관리 |
| `dept_head` | 부장 | 학년부장·교과부장 | 자기 부서 인원 조회 · 그룹 배정 · 클래스룸 조회 |
| `teacher` | 교사 | 담임·교과교사 | 자기 클래스룸 관리 · 자기 반 조회 |
| `viewer` | 조회자 | 기본값 | 자기 계정 정보만 |

> ⚠️ **이 다섯은 헤드의 짐작이다.** 학교 조직에서 실제로 필요한 분류를 모른다. 사용자에게 확인 필요 (아래 §5).

## 3. 탭·기능 매트릭스

원 스크립트의 27+15 개 함수를 탭 단위로 묶고 역할별 접근을 표기.

### 3-1. 「계정 관리」 탭

| 화면·동작 | 원 함수 | `super_admin` | `admin` | `dept_head` | `teacher` | `viewer` |
|---|---|---|---|---|---|---|
| 전체 계정 조회 | `fetchAllUsersToSheet` | ✅ | ✅ | 자기 부서만 | ❌ | ❌ |
| 계정 생성 (전입생) | `laterAccountSetup` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 초기 계정 일괄 세팅 | `initialAccountSetup` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 비밀번호 일괄 변경 | `updateUserPasswords` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 계정 삭제 | `deleteUsers` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 계정 삭제 안내 메일 | `sendMailtoUsers` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 자기 계정 정보 조회 | (신규) | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3-2. 「그룹 관리」 탭

| 화면·동작 | 원 함수 | `super_admin` | `admin` | `dept_head` | `teacher` | `viewer` |
|---|---|---|---|---|---|---|
| 그룹 목록·멤버 조회 | `fetchAllGroupAssignments` | ✅ | ✅ | ✅ | ❌ | ❌ |
| 그룹 생성 | `createGroups` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 그룹 삭제 | `deleteGroups` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 그룹 배정/제외 | `assignGroups` | ✅ | ✅ | 자기 부서 그룹 한정 | ❌ | ❌ |
| 그룹에서 멤버 삭제 | `removeMembersFromGroups` | ✅ | ✅ | 자기 부서 그룹 한정 | ❌ | ❌ |

### 3-3. 「구글챗 관리」 탭

| 화면·동작 | 원 함수 | `super_admin` | `admin` | `dept_head` | `teacher` | `viewer` |
|---|---|---|---|---|---|---|
| 챗방 목록 조회 | `fetchAllChatSpaces` | ✅ | ✅ | 자기 부서 챗방 | ❌ | ❌ |
| 챗방 생성 | `createGoogleChatRooms` · `createChatSpace` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 챗방 권한 설정 | `configureChatSpacePermissions` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 챗방 삭제 | `deleteSelectedChatSpaces` | ✅ (`useAdminAccess`) | ✅ (`useAdminAccess`) | ❌ | ❌ | ❌ |
| 챗방 멤버 배정 | `assignMembersToChatRooms` | ✅ | ✅ | 자기 부서 챗방 | ❌ | ❌ |
| 기초값에서 그룹/챗방 자동 생성 | `createChatSpacesFromBasicData` · `getAudienceId` | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3-4. 「클래스룸」 탭

| 화면·동작 | 원 함수 | `super_admin` | `admin` | `dept_head` | `teacher` | `viewer` |
|---|---|---|---|---|---|---|
| 전체 클래스룸 조회 | `listAllClassrooms` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 소유자별 클래스룸 조회 | `listClassroomsByOwner` | ✅ | ✅ | 자기 부서 교사 | 자기 것 | ❌ |
| 조회 시트 갱신 (증분) | `updateClassroomListIfNeeded` | ✅ | ✅ | ✅ | 자기 것 | ❌ |
| 클래스룸 생성·초대 | `createAndInviteClassrooms` · `createClassroom` | ✅ | ✅ | ❌ | 자기 것 | ❌ |
| 명단 추가 | `addRosterWithSuccessMessage` · `addMembersToClassroom` | ✅ | ✅ | ❌ | 자기 것 | ❌ |
| 명단 직접 배정 (단건) | `directlyAddMemberToClassroom` | ✅ | ✅ | ❌ | 자기 것 | ❌ |
| 명단 삭제 | `deleteRoster` | ✅ | ✅ | ❌ | 자기 것 | ❌ |
| 이름 변경 | `updateAndLogClassroomNames` | ✅ | ✅ | ❌ | 자기 것 | ❌ |
| 소유자 이관 | `transferClassroomOwnershipAndUpdateSheet` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 보관 (단순) | `archiveClassrooms` | ✅ | ✅ | ❌ | 자기 것 | ❌ |
| 보관·삭제 (조건부) | `archiveAndManageClassrooms` | ✅ | ✅ | ❌ | 자기 것 | ❌ |

### 3-5. 「기초값·설정」 탭

| 화면·동작 | 원 함수 | `super_admin` | `admin` | `dept_head` | `teacher` | `viewer` |
|---|---|---|---|---|---|---|
| 기초값 설정 (학년·반·부서 구조) | `setupBasicData` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 기초값에 학생 데이터 가져오기 | `importInitialStudentData` | ✅ | ✅ | ❌ | ❌ | ❌ |
| 역할 배정 관리 (신규) | (신규) | ✅ | ❌ | ❌ | ❌ | ❌ |

## 4. 서버 게이팅 원칙

**클라이언트에서 탭을 숨기는 것과 서버 함수에서 거부하는 것은 다른 층이다.** 둘 다 한다. 그리고 **서버는 두 단계로 검증**한다.

### 4-1. 역할 검증 (모든 요청)

- 클라이언트: 역할에 맞는 탭만 렌더 (UX 힌트일 뿐, 방어 아님).
- 서버 (Cloud Function 미들웨어): 요청 도착 시 **매번** Firestore `role_assignments/{email}` 조회. 없으면 `viewer`.
- 역할이 이 화면·동작을 열지 못하면 → 즉시 거부, 감사 로그 기록.

### 4-2. 대상 자원 검증 (`dept_head`·`teacher` 처럼 범위 제한 있는 역할)

**역할이 통과해도 대상 자원이 자기 범위 밖이면 거부**. 각 조건별 검증 방법:

| 조건 | 검증 데이터 원본 | 서버 절차 |
|---|---|---|
| **자기 부서 인원** (`dept_head`) | `basic_data/current` 의 부서↔OU 매핑 + AdminDirectory 의 대상 `orgUnitPath` | ① `role_assignments/{actor}.department` 조회 → ② `basic_data` 에서 그 부서에 속한 OU 목록 → ③ 대상 사용자의 `orgUnitPath` 가 그 목록에 포함되는지 판정 |
| **자기 부서 그룹** (`dept_head`) | Firestore `group_templates` 의 `department` 필드 · 또는 그룹 이름 접두사 규칙 | 그룹 이름·`group_templates` 의 부서 태그로 판정. 매핑이 없는 그룹은 거부 (에러 아니라 「알 수 없음」으로 감사 로그) |
| **자기 부서 챗방** (`dept_head`) | 같은 원리로 `chat_templates` 의 부서 태그 · 또는 챗방 이름 접두사 규칙 | 매핑 없는 챗방은 거부 |
| **자기 것 (클래스룸)** (`teacher`) | Classroom API 의 `Courses.Teachers.list` | ① 대상 `courseId` 에 대해 `Teachers.list` 호출 → ② actor 의 이메일이 목록에 있는지 확인. **Classroom API 스스로도 강제하지만 서버가 재확인** (오탐 방지) |

### 4-3. 감사 로그 (모든 관리 동작)

역할 통과·대상 통과 후 실제 API 호출 전·후로 `audit_log/{id}` 에 append:
- `actor` (이메일), `role`, `action`, `target`, `at` (Timestamp), `request_id`, `result` (ok/error/denied), 관련 `diff` (선택)

**감사 로그는 append-only** — Firestore rules 로 update·delete 를 금지 (아래 firebase_layout §5 참조).

## 5. 알려진 미결

1. ⚠️ **다섯 역할이 실제 학교 조직과 맞는지 확인 필요.** 특히 `dept_head` 를 두는 게 실무에 도움이 되는지, 아니면 `admin`/`teacher` 둘로 충분한지.
2. ⚠️ **「자기 부서」 판별을 어디에서 하나?** — 워크스페이스 조직 단위(OU) 로 자동인가, Firestore 에 부서 매핑을 따로 두어야 하나. OU 가 학교마다 다르게 걸려 있을 수 있음.
3. ⚠️ **첫 관리자를 어떻게 심나?** 로그인만으로는 아무도 `super_admin` 이 아니다. 부트스트랩 절차 필요. **저장소에 시드 파일을 넣는 안은 채택하지 않는다** — 이유: (a) 공개 저장소라면 관리자 이메일이 노출됨, (b) 커밋 접근자가 자기 이메일을 추가해 권한 획득 가능, (c) 배포 자동화가 매번 덮어써 「관리자 제거」가 불가. **채택 안**: `scripts/bootstrap_admin.ts` — 로컬에서 Firebase Admin SDK 자격증명(서비스 계정 키를 **로컬에서만** 사용) 으로 Firestore 에 첫 `super_admin` 한 건을 씀. 스크립트는 실행 전 대화형으로 이메일을 물음. 이 스크립트는 저장소에 있어도 되지만 서비스 계정 키는 절대 커밋 안 됨(`.gitignore`). **첫 관리자가 앱에 로그인해 두 번째 관리자를 만든 뒤 스크립트는 다시 안 쓴다.**
4. ⚠️ **역할 승격·좌천의 감사 기록.** 누가 언제 누구를 승격했는가 — Firestore 에 append-only 로그 필요.

## 6. 참고

- 원본 함수 정의: `WORKSPACE/RESEARCH/school-webapp/FEATURES_CATALOG.md`
- Firestore 스키마·Cloud Functions 배치: `docs/design/firebase_layout.md`
- 이 문서를 인용할 때는 **버전 표기 필수** (v0.1). 확정본이 나오면 v1.0.
