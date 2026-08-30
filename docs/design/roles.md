# roles.md — 역할·권한 매트릭스 (v1.0)

> **상태**: 확정. 사용자 승인 2026-08-30 (`좋아 그대로 진행해줘`).
> **관계 문서**: 상세 구조·데이터 모델·함수 목록은 [DESIGN_v1.md](../DESIGN_v1.md). 강제 층 (Rules · 헬퍼 · AST · 에뮬레이터) 은 `firebase_layout.md` §5.
>
> **v1.0 변경점 (v0.3 대비)**: 역할 5개(`super_admin·admin·dept_head·teacher·viewer`) 매트릭스를 **역할 3개(`super_admin·admin·teacher`) + 권한 카탈로그 + 역할→권한 매핑** 구조로 재작성. **하드코딩 금지** 원칙 명시. 「부장」·「학년 담당」 등은 v1.0 밖 — 매트릭스에 한 줄 추가로 확장.

## 1. 역할 셋

| 역할 코드 | 라벨 | 누구 | 첫 화면 |
|---|---|---|---|
| `super_admin` | 슈퍼 관리자 | 시스템 관리자·개발자 | 감사 로그 · 함수 상태 · 위험 조작 |
| `admin` | 관리자 | 정보부장 등 실제 운영자 | 계정·그룹·챗방·클래스룸 대시보드 |
| `teacher` | 교사 | 담임·교과교사 | 본인 담당 클래스룸 목록 (읽기 위주) |

**첫 로그인** — Auth 트리거가 `teacher` 를 자동 부여. `super_admin` 만 다른 역할로 승격 가능 (감사 로그 기록).

**「차등적으로 기능 부여」 하는 방법** — 역할 이름을 새로 만들지 말고 **권한 매트릭스에서 한 줄만 바꾼다**. 새 역할이 필요해지면 (예: `dept_head`) 매트릭스에 그 역할의 권한 집합을 추가. 코드 안의 검사부는 안 바뀐다. 아래 §2 참조.

## 2. 권한 카탈로그 · 매트릭스

**하드코딩 금지 원칙** — 코드 어디에도 `if (role === 'admin')` 을 쓰지 않는다. 대신 `userHasCap(user, 'users.write')` 를 씀. 권한 이름은 아래 카탈로그에서만 옴.

### 2.1 권한 카탈로그 (v1.0)

`functions/src/authz/capabilities.ts` 가 소유하는 문자열 상수 집합:

```
users.read                 users.write             users.delete           users.reset_password
groups.read                groups.write            groups.delete
chat.read                  chat.write              chat.delete
classroom.read             classroom.write         classroom.transfer_owner  classroom.archive
basic_data.read            basic_data.write
audit.read                 system.manage_roles
```

### 2.2 역할 → 권한 매핑

`functions/src/authz/roleCapabilities.ts` 가 소유하는 유일한 매트릭스:

| 권한 | `super_admin` | `admin` | `teacher` |
|---|---|---|---|
| `users.read` | ✅ | ✅ | ❌ |
| `users.write` | ✅ | ✅ | ❌ |
| `users.delete` | ✅ | ✅ | ❌ |
| `users.reset_password` | ✅ | ✅ | ❌ |
| `groups.read` | ✅ | ✅ | ❌ |
| `groups.write` | ✅ | ✅ | ❌ |
| `groups.delete` | ✅ | ✅ | ❌ |
| `chat.read` | ✅ | ✅ | ❌ |
| `chat.write` | ✅ | ✅ | ❌ |
| `chat.delete` | ✅ | ✅ | ❌ |
| `classroom.read` | ✅ | ✅ | ✅ (본인 것) |
| `classroom.write` | ✅ | ✅ | ✅ (본인 것) |
| `classroom.transfer_owner` | ✅ | ✅ | ❌ |
| `classroom.archive` | ✅ | ✅ | ✅ (본인 것) |
| `basic_data.read` | ✅ | ✅ | ❌ |
| `basic_data.write` | ✅ | ✅ | ❌ |
| `audit.read` | ✅ | ❌ | ❌ |
| `system.manage_roles` | ✅ | ❌ | ❌ |

**「본인 것」 조건** (classroom) — 권한 통과 후 서버가 대상 자원 검증을 별도로 수행. §3-2 참조.

## 3. 서버 게이팅

### 3.1 매 요청 세 층 (기본)

모든 Callable 은 첫 세 줄:

```ts
const user = await authenticateContext(context);      // 인증 층 (§4)
assertHasCap(user, 'users.write');                    // 권한 층
await assertResourceScope(user, request.target);      // 대상 자원 층 (`teacher` 만)
```

한 층이라도 실패 → 즉시 거부 + `writeAudit({ result: 'denied' })`.

### 3.2 대상 자원 검증 (`teacher` 의 「본인 것」)

| 조건 | 검증 방법 |
|---|---|
| **본인 클래스룸** (`classroom.*` for `teacher`) | ① 대상 `courseId` 에 대해 Google Classroom API `Courses.Teachers.list` 호출 → ② actor 이메일이 목록에 있는지 확인. Classroom API 스스로도 강제하지만 서버가 재확인 |

「본인 것」이 아닌 요청은 즉시 거부. 재확인 실패 시 위조 시도로 간주하고 감사 로그.

### 3.3 감사 로그

`writeAudit(entry)` 를 호출하는 **모든 상태 변경 함수**. 스키마:

```
{ actor: email, role, action: capability_name, target,
  before?, after?, at: Timestamp, request_id, result: 'ok'|'error'|'denied' }
```

강제 방식 — `firebase_layout.md` §5 참조. 요약: (1) Rules 로 클라이언트 write 완전 차단, (2) `writeAudit()` 헬퍼 하나만 통과, (3) AST ESLint 규칙, (4) 에뮬레이터 테스트.

## 4. Firestore Rules

Custom Claims 에 `role` 하나만 넣는다 (예: `role: "admin"`). Rules 는 「이 컬렉션은 어느 역할이 접근 가능」 수준까지만:

```
match /audit_log/{doc} {
  allow read: if request.auth.token.role == "super_admin";
  allow write: if false;    // 함수만
}
match /users/{uid} {
  allow read: if request.auth != null;         // 로그인 누구나 (Firestore 저장 최소)
  allow write: if false;                       // 함수만
}
match /basic_data/{year} {
  allow read: if request.auth.token.role in ["super_admin","admin"];
  allow write: if request.auth.token.role in ["super_admin","admin"];
}
match /jobs/{jobId} {
  allow read: if request.auth != null && resource.data.createdBy == request.auth.token.email;
  allow write: if false;
}
```

**세밀한 권한 검사는 Callable 안에서**. Rules 로 매트릭스를 표현하려 하면 유지 비용이 폭발한다.

## 5. 첫 관리자 부트스트랩

`super_admin` 이 아무도 없는 상태에서 어떻게 첫 하나를 심는가.

**채택 안** — `scripts/bootstrap_admin.ts` 로컬 스크립트. Firebase Admin SDK 자격증명(로컬 서비스 계정 키) 으로 Firestore `users` 문서 하나 만들거나 갱신하고 Custom Claims 를 `super_admin` 으로 설정. 실행 전 대화형으로 이메일을 물음. 서비스 계정 키는 절대 커밋 안 됨 (`.gitignore`).

**폐기한 안** — 저장소에 `initial_admins.json` 시드. 이유: (a) 공개 저장소라면 관리자 이메일 노출, (b) 커밋 접근자가 자기 이메일 추가해 권한 획득, (c) 배포 자동화가 매번 덮어써서 「관리자 제거」가 불가.

## 6. v1.0 밖 (나중)

- **부장·학년별 관리자 등 세분화** — §2 구조로 커버 (역할 추가 + 매트릭스 한 줄).
- **「자기 부서」 조건부 접근** — v0.3 에 있던 `dept_head` 시나리오. `basic_data` 의 부서↔OU 매핑 + AdminDirectory `orgUnitPath` 확인 절차. 새 역할과 함께 반환할 때 재활성화.
- **역할 승격·좌천 UI** — 지금은 `super_admin` 이 Callable 호출로만 가능.
