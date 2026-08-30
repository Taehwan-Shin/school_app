# firebase_layout.md — Firebase 프로젝트 구조 (초안 v0.2)

> **상태**: 초안. Codex 감사 1차 반영 완료 (커밋 `7ab9c1a` 감사 → 이 문서). 사용자 확인 전.
> 인증 모델 = ⓑ 로그인 사용자 OAuth. 서비스 계정·도메인 위임 없음. 자세한 이유는 `AGENTS.md` §1.
>
> **v0.2 변경점**: (1) §4 액세스 토큰 갱신 오해 정정 (Firebase ID 토큰 ≠ Google 액세스 토큰). (2) §4 스코프 목록에 Gmail 발송·`chat.admin.*` 추가. (3) §5 Firestore rules — 「전면 함수 경유」 대신 컬렉션별 접근 정책. (4) §6 인증 미들웨어에 대상 자원 검증 층 추가. (5) §7-1 함수 리전 확정 `asia-northeast3`. (6) §7-3 Chat 관리자 삭제는 사용자 OAuth 로 가능 (`useAdminAccess=true`).

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
│ Classroom API        │        │  us-central1                      │
│ (사용자 권한으로)     │◀───────│  - google-api-nodejs-client       │
└──────────────────────┘        │  - 배치 작업 큐 (Cloud Tasks)     │
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
- **Cloud Functions**: 2세대 (`us-central1` 로 강제 → **한국에서 지연** — 아래 §7 참조)
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
   · https://www.googleapis.com/auth/chat.admin.spaces          # useAdminAccess=true
   · https://www.googleapis.com/auth/chat.admin.memberships     # useAdminAccess=true
   · https://www.googleapis.com/auth/gmail.send                 # 계정 삭제 안내 메일 (sendMailtoUsers)
3. Firebase Auth → 사용자에게 동의 화면 → **Google OAuth 액세스 토큰 발급** (1시간 만료)
4. 로그인 후 클라이언트가 Firebase Functions 호출 시:
   · onAuthStateChanged → getIdToken() → Authorization: Bearer <Firebase ID 토큰>
   · Google 액세스 토큰은 별도로 함수에 넘김 (`X-Google-Access-Token` 헤더 등)
   · Cloud Function 은 (a) Firebase ID 토큰 검증, (b) 액세스 토큰의 스코프 재확인
5. Cloud Function 은 그 액세스 토큰으로 Admin/Classroom/Chat/Gmail API 호출
```

**두 토큰의 구분 — 이전 초안의 혼동을 정정**:

| 토큰 종류 | 발급자 | 만료 | 갱신 방법 | 용도 |
|---|---|---|---|---|
| **Firebase ID 토큰** | Firebase Auth | 1시간 | 클라이언트가 `getIdToken(true)` — **자동, 무제한** | Firebase Functions 인증. Firestore rules. |
| **Google OAuth 액세스 토큰** | Google OAuth | 1시간 | ⚠️ **Firebase Auth 는 리프레시 토큰을 노출하지 않음** — 만료되면 **재로그인 필요** (Google 팝업) 또는 서버 측 OAuth 재발급 흐름 별도 구축 | AdminDirectory·Classroom·Chat·Gmail API 호출 |

**세션 수명의 실전 의미**:
- 사용자가 로그인하고 1시간 안에 하는 작업은 문제없다.
- 1시간 뒤 다음 관리 동작을 시도하면 **Google API 가 401** — 클라이언트가 재인증 팝업을 띄우고 새 액세스 토큰을 받아 재시도한다.
- **대용량 배치 (예: 1,000 계정 일괄 생성)** 는 1시간 안에 끝나지 않으면 중간에 401. **처리 절차**: (a) 배치를 Cloud Tasks 로 잘게 쪼개서 각 조각이 몇 초 이내에 끝나게 하고, (b) 큐가 소모하는 사이 사용자 세션이 살아 있어야 하며, (c) 만료 시 클라이언트가 조용히 토큰을 재발급받아 다음 조각을 밀어 넣는다. **사용자가 브라우저를 닫으면 배치는 멈춘다** — 남은 조각은 다음 로그인 때 이어감.
- **정말 사람 없이 도는 배치가 필요해지면** 그때 서버 측 OAuth 흐름을 별도 구축 (Firestore 에 리프레시 토큰 저장). 지금은 필요 없음.

## 5. Firestore 컬렉션

```
/role_assignments/{email}
  { role: "admin"|"dept_head"|"teacher"|"viewer",
    department?: string,      // dept_head 일 때
    assigned_by: string,
    assigned_at: Timestamp }

/basic_data/current
  { school_year: 2026,
    grades: [{ name, classes: [...] }],
    departments: [...],
    ...설정 }

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
| `basic_data/current` | ✅ (로그인 사용자 누구나) | ❌ | 쓰기는 함수로 (관리자만) |
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

1. **함수 리전 = `asia-northeast3`** (Firestore 와 같은 리전, Cloud Functions 2세대 지원 확인). 워크스페이스 API 왕복은 원거리라 지연이 있지만 Firestore 왕복이 훨씬 잦아 이쪽이 유리.
2. **Chat 관리자 동작 = 사용자 OAuth + `useAdminAccess=true` + `chat.admin.*` 스코프**. 서비스 계정 도메인 위임은 필요 없음. 「모든 챗방 삭제」·「관리자 스페이스 관리」 모두 이 경로.
3. **세션 수명** — Google 액세스 토큰 1시간, 리프레시는 클라이언트 재인증 팝업 또는 대량 배치는 Cloud Tasks 잘게 쪼개기 (§4).

**미결**:

1. ⚠️ **CSRF·XSS·비밀 관리** — Cloud Functions 는 Firebase Auth ID 토큰 검증으로 CSRF 자동 해결. 액세스 토큰은 브라우저 메모리에만 (`localStorage` 금지). Content-Security-Policy 헤더 설정 필요.
2. ⚠️ **비용** — Blaze 요금제 필수. 워크스페이스 API 요청 자체는 무료지만 함수 호출·Firestore·아웃바운드 대역폭에 요금. 대량 작업 큐잉으로 폭주 방지.
3. ⚠️ **Cloud Tasks 사용 여부 정식화** — §4 세션 수명 절이 Cloud Tasks 를 전제로 하는데, 그러면 배치 상태 추적을 위한 `work_queues` 스키마 (§5) 를 Cloud Tasks 라이프사이클과 맞춰야 함. 별도 문서로 정리 예정.

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
