# firebase_layout.md — Firebase 프로젝트 구조 (초안 v0.3)

> **상태**: 초안. Codex 감사 2차 반영 완료 (커밋 `ab80bb8` 재감사 → 이 문서). 사용자 확인 전.
> 인증 모델 = ⓑ 로그인 사용자 OAuth. 서비스 계정·도메인 위임 없음. 자세한 이유는 `AGENTS.md` §1.
>
> **v0.3 변경점** (감사 2차): (1) §1·§2 리전 자기모순 정정 — `asia-northeast3` 로 일관. (2) §4 스코프에 `chat.admin.delete` 추가. (3) §4 인증 흐름에 **토큰 주체 대조** 절 신설 — Firebase ID 토큰 이메일 == Google 액세스 토큰 이메일 검증. (4) §4 세션 수명 절 재작성 — Cloud Tasks 로 큐잉하는 모델은 서버가 토큰을 못 가지므로 폐기, **브라우저 주도 청크 처리**로 확정. (5) §5 `basic_data/current` 를 두 갈래로 분리 — 공개 구조 vs 학생 명단(민감).
> **v0.2 변경점** (감사 1차): (1) §4 토큰 갱신 오해 정정. (2) §4 스코프에 Gmail·`chat.admin.*` 추가. (3) §5 컬렉션별 rules. (4) §6 미들웨어 3층. (5) §7 리전 확정. (6) §7 Chat 관리자 = 사용자 OAuth.

## 1. 큰 그림

```
┌─────────────────────────────────────────────────────────────────┐
│                        브라우저 (SPA)                             │
│  React + Vite + TypeScript                                       │
│  - 로그인: Firebase Auth (Google provider, 추가 스코프 요청)       │
│  - 상태: TanStack Query + 최소 Zustand                            │
│  - UI: Tailwind CSS + 최소 컴포넌트 (임의 UI 라이브러리 금지)      │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               │ (a) 가벼운 조회               │ (b) 무거운 작업·쓰기
               │     · 사용자 액세스 토큰      │     · 사용자 액세스 토큰을 함수로 넘김
               │     · 브라우저 → Google       │     · 함수가 검증·로깅·배치
               │       API 직접                │
               ▼                              ▼
┌──────────────────────┐        ┌──────────────────────────────────┐
│ Google Admin/Chat/   │        │  Cloud Functions (2세대, TS)      │
│ Classroom/Gmail API  │        │  asia-northeast3 (서울)          │
│ (사용자 권한으로)     │◀───────│  - google-api-nodejs-client       │
└──────────────────────┘        │  - 청크 작업 프록시 (브라우저 주도) │
                                │  - Firestore 트리거 (감사 로그)   │
                                └────────┬─────────────────────────┘
                                         │
                                         ▼
                                ┌────────────────────────┐
                                │  Firestore (앱 상태)    │
                                │  - role_assignments/    │
                                │  - basic_data/          │
                                │  - work_queues/         │
                                │  - audit_log/           │
                                │  - group_templates/     │
                                │  - chat_templates/      │
                                └────────────────────────┘
```

## 2. Firebase 프로젝트 하나

- **프로젝트 ID**: 사용자가 정함. 예: `school-app-hmh`
- **위치**: `asia-northeast3` (서울). Firestore·Storage 위치.
- **Cloud Functions**: 2세대 (`asia-northeast3` 서울 리전 — Firestore 와 같은 리전, 왕복 지연 최소화)
- **결제**: Blaze 필요 (Cloud Functions 외부 호출 = Google API 라 무료 tier 로 안 됨)

## 3. 저장소 폴더 구조

```
school_app/
├── AGENTS.md              # 규칙
├── OPERATIONS.md          # (예정) 손버릇
├── STATUS.md              # 열린 항목
├── project_notes.md       # 일지 (덧붙이기)
├── docs/
│   ├── design/            # 이 문서를 포함한 설계
│   │   ├── roles.md
│   │   └── firebase_layout.md
│   └── handoff/           # 일꾼 오더
│       └── NEXT.md
├── .githooks/
│   └── pre-commit
├── firebase.json          # Firebase 통합 설정
├── firestore.rules
├── firestore.indexes.json
├── functions/             # Cloud Functions
│   ├── src/
│   │   ├── index.ts           # 함수 엔트리
│   │   ├── auth/              # 토큰 검증
│   │   ├── admin/             # AdminDirectory 프록시
│   │   ├── classroom/         # Classroom 프록시
│   │   ├── chat/              # Chat REST 프록시
│   │   ├── batch/             # 대량 작업 (큐잉)
│   │   └── audit/             # 감사 로그 기록
│   ├── package.json
│   └── tsconfig.json
├── web/                   # React SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── auth/              # Firebase Auth 훅
│   │   ├── api/               # Cloud Functions 호출 · Google API 직접
│   │   ├── pages/
│   │   │   ├── login/
│   │   │   ├── accounts/      # 계정 관리 탭
│   │   │   ├── groups/        # 그룹 관리 탭
│   │   │   ├── chat/          # 챗방 관리 탭
│   │   │   ├── classroom/     # 클래스룸 탭
│   │   │   └── settings/      # 기초값·설정
│   │   └── components/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── scripts/               # 관리 스크립트 (부트스트랩 등)
```

## 4. 인증 흐름

```
1. 사용자 → Firebase Auth: Google 로그인 (도메인 제한)
2. Firebase Auth → 추가 스코프 요청 (계정+그룹+OU+메일+클래스룸+챗+관리자챗):
   · openid, email, profile (기본)
   · https://www.googleapis.com/auth/admin.directory.user
   · https://www.googleapis.com/auth/admin.directory.group
   · https://www.googleapis.com/auth/admin.directory.group.member
   · https://www.googleapis.com/auth/admin.directory.orgunit.readonly
   · https://www.googleapis.com/auth/classroom.rosters
   · https://www.googleapis.com/auth/classroom.courses
   · https://www.googleapis.com/auth/chat.spaces
   · https://www.googleapis.com/auth/chat.memberships
   · https://www.googleapis.com/auth/chat.admin.spaces          # useAdminAccess=true, 관리자 스페이스 조회·설정
   · https://www.googleapis.com/auth/chat.admin.memberships     # useAdminAccess=true, 관리자 멤버 조작
   · https://www.googleapis.com/auth/chat.admin.delete          # useAdminAccess=true, 관리자 스페이스 삭제
   · https://www.googleapis.com/auth/gmail.send                 # 계정 삭제 안내 메일 (sendMailtoUsers)
3. Firebase Auth → 사용자에게 동의 화면 → **Google OAuth 액세스 토큰 발급** (1시간 만료)
4. 로그인 후 클라이언트가 Firebase Functions 호출 시:
   · onAuthStateChanged → getIdToken() → Authorization: Bearer <Firebase ID 토큰>
   · Google 액세스 토큰은 별도로 함수에 넘김 (`X-Google-Access-Token` 헤더)
   · Cloud Function 은 다음 순서로 검증:
      (a) Firebase ID 토큰 검증 (`admin.auth().verifyIdToken`) → email E1
      (b) Google 액세스 토큰의 `tokeninfo` 조회 → email E2, scopes[]
      (c) **E1 == E2 인지 확인** — 두 토큰의 주체가 다르면 즉시 401 + 감사 로그 `result: "token_subject_mismatch"`. 이유: 이 검증이 없으면 사용자가 A 로 Firebase 로그인하고 B 의 액세스 토큰을 함수에 넘겨 **A 이름으로 감사 남기고 B 권한으로 API 를 태울 수 있다.**
      (d) 이 함수가 요구하는 스코프가 scopes[] 에 다 있는지 확인
5. Cloud Function 은 그 액세스 토큰으로 Admin/Classroom/Chat/Gmail API 호출
```

**두 토큰의 구분 — 이전 초안의 혼동을 정정**:

| 토큰 종류 | 발급자 | 만료 | 갱신 방법 | 용도 |
|---|---|---|---|---|
| **Firebase ID 토큰** | Firebase Auth | 1시간 | 클라이언트가 `getIdToken(true)` — **자동, 무제한** | Firebase Functions 인증. Firestore rules. |
| **Google OAuth 액세스 토큰** | Google OAuth | 1시간 | ⚠️ **Firebase Auth 는 리프레시 토큰을 노출하지 않음** — 만료되면 **재로그인 필요** (Google 팝업) 또는 서버 측 OAuth 재발급 흐름 별도 구축 | AdminDirectory·Classroom·Chat·Gmail API 호출 |

**세션 수명의 실전 의미 (v0.3 재작성 — Cloud Tasks 모델 폐기)**:

원 초안은 「Cloud Tasks 로 큐잉하고 브라우저가 다음 조각을 민다」였는데 **모순**이다. Cloud Tasks 는 서버가 큐에서 작업을 꺼내 실행하는 모델이라, **작업이 실행되는 순간 서버는 유효한 액세스 토큰을 갖고 있어야** 한다. 브라우저가 재인증해도 그 토큰이 큐에 있는 작업까지 전달되지 않는다.

**대신 확정한 모델 = 브라우저 주도 청크 처리**:

- 사용자가 로그인하고 1시간 안에 하는 작업은 문제없다.
- 1시간 뒤 다음 관리 동작을 시도하면 **Google API 가 401** → 클라이언트가 재인증 팝업(`signInWithPopup` with `prompt: 'none'` 시도 → 필요하면 `select_account`) 을 띄우고 새 액세스 토큰을 받아 재시도.
- **대용량 배치 (예: 1,000 계정 일괄 생성)** — 브라우저가 배치를 청크 (예: 20건씩) 로 잘라 순차 호출:
  · 각 청크는 별도 callable 함수 호출 → 함수는 한 청크만 처리 (수 초 이내)
  · 브라우저는 청크 사이에서 진행률 표시, 실패 청크는 재시도 큐에 저장 (`work_queues/{id}.errors[]`)
  · 청크 사이에서 액세스 토큰 만료 시 클라이언트가 조용히 갱신 후 다음 청크 진행
- **사용자가 브라우저를 닫으면 배치는 멈춘다** — 남은 청크는 `work_queues` 에 「일시중지」로 남고 다음 로그인 때 이어감. 사용자에게 「800/1000 완료, 나머지 200 은 다음 접속 때」로 안내.
- **정말 사람 없이 도는 배치가 필요해지면** 그때 별도 OAuth 흐름을 구축 (Firestore 암호화 저장한 리프레시 토큰 + 서버 측 갱신). **지금 이 프로젝트에는 필요 없음** — 원본 시트 스크립트도 사용자가 시트를 열어 실행하는 모델이었음.

**함수 배치는 짧게, 큐잉은 클라이언트에서** — 이 원칙을 §6 에 다시 반영.

## 5. Firestore 컬렉션

**v0.3 변경**: 원 초안의 `basic_data/current` 는 학교 구조·부서 매핑 뿐 아니라 `importInitialStudentData` 가 학생 명단(이름·소속·이메일) 을 채우도록 되어 있었다. 학생 명단은 **개인정보**이므로 별도 컬렉션으로 분리하고 접근을 좁힌다.

```
/role_assignments/{email}
  { role: "admin"|"dept_head"|"teacher"|"viewer",
    department?: string,      // dept_head 일 때
    assigned_by: string,
    assigned_at: Timestamp }

/basic_data/current           # 공개 구조만 — 학년/반 이름, 부서 이름, 부서↔OU 매핑
  { school_year: 2026,
    grades: [{ name, classes: [...] }],   # 반 목록 (이름만)
    departments: [{ name, ou_path }],     # 부서 이름·OU 매핑
    ...공개 설정 }

/student_roster/{class_id}    # 학생 명단 — 관리자·해당 반 담임만
  { grade: string, class: string,
    students: [{ name, email, ... }],
    updated_by: string, updated_at: Timestamp }

/work_queues/{queue_id}
  { type: "bulk_create_accounts" | "bulk_password_reset" | ...,
    initiated_by: string,
    initiated_at: Timestamp,
    total: number, done: number, errors: [...],
    status: "queued"|"running"|"done"|"failed",
    payload: {...} }

/audit_log/{log_id}
  { actor: string, action: string, target: string,
    at: Timestamp, request_id: string, result: "ok"|"error",
    diff?: {...} }

/group_templates/{template_id}
  { name: string, source: "basic_data"|"manual",
    membership_rule: {...} }

/chat_templates/{template_id}
  { name: string, space_type: "space"|"direct_message",
    permissions: {...} }
```

**규칙 원칙 (컬렉션별 분리)** — 「전면 함수 경유」는 과했다. 컬렉션의 민감도에 맞춰 세 층:

| 컬렉션 | 클라이언트 직접 읽기 | 클라이언트 직접 쓰기 | 함수 경유 필요 |
|---|---|---|---|
| `basic_data/current` | ✅ (로그인 사용자 누구나 — 공개 구조만) | ❌ | 쓰기는 함수로 (관리자만) |
| `student_roster/{class_id}` | ⚠️ **함수 경유만** — 학생 개인정보 | ❌ | 읽기·쓰기 모두 함수 (역할·반 담당 여부 검증) |
| `role_assignments/{email}` | ✅ (본인 것만: `request.auth.token.email == email`) | ❌ | 쓰기는 함수로 (`super_admin` 만) |
| `work_queues/{id}` | ✅ (내가 초기화한 것만: `initiated_by == request.auth.token.email`) | ❌ | 쓰기는 함수만 |
| `audit_log/{id}` | ❌ | ❌ | 함수만. **rules 로 create-only, update·delete 금지** |
| `group_templates`, `chat_templates` | ✅ (관리자 역할 조회는 함수에서) | ❌ | 쓰기는 함수 |

**왜 완전 잠금이 과한가**: `basic_data/current` 같은 조회 무거운 자료를 함수로 감싸면 왕복 지연과 함수 호출 비용이 늘어난다. Firestore rules 가 접근을 제한할 수 있으면 그게 더 싸고 안전하다.
**왜 쓰기는 함수만인가**: 쓰기는 감사 로그·부수 효과(관련 컬렉션 갱신·역할 검증) 를 함수 한 곳에서 강제해야 두 곳이 어긋나지 않는다. 클라이언트 rules 로 쓰기를 여는 순간 검증 로직이 두 벌이 된다.
**감사 로그의 append-only**: rules 는 `allow create` 만 열고 `update`·`delete` 금지. Firestore 는 rule 로 delete 를 막을 수 있음.

## 6. Cloud Functions 배치

- **`callable` 함수** (프론트 → 함수): 각 관리 동작마다 하나. `admin.users.list`, `admin.users.create`, `classroom.courses.list`, ...
- **`scheduled` 함수**: 지금은 없음. 필요해지면 §4 세션 수명 절부터 해결.
- **`firestore` 트리거**: `work_queues` 상태 변경 감시 (진행률 통보 등).

### 6-1. 요청 처리의 세 층 (미들웨어)

모든 callable 함수는 아래 세 층을 **순서대로** 통과. 하나라도 실패하면 즉시 거부 + `audit_log/{id}` 에 `result: "denied"` 기록.

1. **인증 층** — Firebase ID 토큰 검증 (`admin.auth().verifyIdToken`). 사용자 이메일·도메인 확인.
2. **역할 층** — Firestore `role_assignments/{email}` 조회 (없으면 `viewer`). 이 함수가 요구하는 최소 역할과 대조.
3. **대상 자원 층** — 함수마다 다름. `roles.md` §4-2 의 검증 절차를 그대로 구현:
   - 「자기 부서만」: `basic_data` 의 부서↔OU 매핑 + 대상 사용자의 `orgUnitPath` 확인
   - 「자기 것만 (클래스룸)」: Classroom API 의 `Teachers.list` 로 actor 가 소유·교사인지 확인
   - 「자기 부서 그룹·챗방」: `group_templates`·`chat_templates` 의 부서 태그 확인

**감사 로그는 세 층 전후로 항상 기록** — 거부됐어도 `result: "denied"` 로 남긴다. 침입 흔적을 남기는 것이 목적.

## 7. 결정 사항 · 남은 미결

**확정**:

1. **함수 리전 = `asia-northeast3`** (Firestore 와 같은 리전, Cloud Functions 2세대 지원 확인). §1·§2·§6 배치도 모두 이 값.
2. **Chat 관리자 동작 = 사용자 OAuth + `useAdminAccess=true` + `chat.admin.spaces`·`chat.admin.memberships`·`chat.admin.delete` 스코프**. 서비스 계정 도메인 위임 필요 없음. 「모든 챗방 삭제」·「관리자 스페이스 관리」 모두 이 경로.
3. **세션 수명 / 배치 처리 = 브라우저 주도 청크** — Cloud Tasks 로 큐잉하지 않는다 (서버가 만료된 토큰을 못 가짐). 브라우저가 20건 단위 청크로 함수를 순차 호출, 청크 사이 토큰 만료 시 조용히 갱신. **사용자가 브라우저를 닫으면 배치 일시중지, 다음 로그인 때 이어감.** §4 참조.
4. **토큰 주체 대조** — 서버는 Firebase ID 토큰의 이메일과 Google 액세스 토큰의 `tokeninfo` 이메일이 **일치하는지 검증**한다. 불일치 시 즉시 거부. §4 참조.
5. **`basic_data/current` 은 공개 구조만** — 학생 명단은 `student_roster/{class_id}` 로 분리, 함수 경유 + 역할·반 담당 검증. §5 참조.

**미결**:

1. ⚠️ **CSRF·XSS·비밀 관리** — Cloud Functions 는 Firebase Auth ID 토큰 검증으로 CSRF 자동 해결. 액세스 토큰은 브라우저 메모리에만 (`localStorage` 금지). Content-Security-Policy 헤더 설정 필요.
2. ⚠️ **비용** — Blaze 요금제 필수. 워크스페이스 API 요청 자체는 무료지만 함수 호출·Firestore·아웃바운드 대역폭에 요금. 청크 처리로 함수 호출 수가 늘어남 (배치당 청크 수만큼) → 비용 모니터링 필요.
3. ⚠️ **`chat.admin.delete` 스코프 실존 검증** — Codex 감사에서 지적. Google Chat API 문서에서 이 스코프 이름 확인이 필요. 다르면 실제 스코프로 교체 (예: `chat.delete`).
4. ⚠️ **재인증 UX** — 청크 처리 중 만료 시 팝업이 뜨면 팝업 차단·사용자 이탈 위험. `prompt: 'none'` silent refresh 시도 → 실패 시만 팝업. 상세 흐름은 프론트 구현 시 정리.

## 8. 기술 선택 근거

- **React + Vite** (Not Next.js): Firebase Hosting 정적 배포로 충분. SSR 이득이 이 앱에는 얇음. Next.js 는 유지 비용이 커짐. 사용자 손이 적게 가는 최소 스택.
- **TypeScript** (전 스택): API 응답 타입이 복잡 (`googleapis` 타입 정의 존재). 런타임 검증은 `zod` 로.
- **Tailwind CSS**: 임의 컴포넌트 라이브러리 없이 필요한 만큼만.
- **TanStack Query**: Google API 캐싱·리페치가 이 앱의 핵심. Redux/Zustand 는 UI 상태 정도만.
- **`googleapis` 공식 SDK** (서버 측): 자체 fetch 대비 인증 갱신·재시도가 이미 됨.

## 9. 배포·CI (예정)

- **호스팅**: Firebase Hosting (SPA 정적)
- **함수**: `firebase deploy --only functions`
- **GitHub Actions**: PR 별 프리뷰 채널, `main` 자동 배포. 헤드 또는 사용자가 승인 후.
- **비밀**: `.env.local` (로컬), Firebase Functions config (서버). 이 저장소에는 절대 커밋 안 됨 (`.gitignore` 이미 반영).
