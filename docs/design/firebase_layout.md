# firebase_layout.md — Firebase 프로젝트 구조 (초안 v0.1)

> **상태**: 초안. 감사(Codex) 통과 전. 사용자 확인 전.
> 인증 모델 = ⓑ 로그인 사용자 OAuth. 서비스 계정·도메인 위임 없음. 자세한 이유는 `AGENTS.md` §1.

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
2. Firebase Auth → 추가 스코프 요청:
   · openid, email, profile (기본)
   · admin.directory.user
   · admin.directory.group
   · admin.directory.group.member
   · admin.directory.orgunit.readonly
   · classroom.rosters
   · classroom.courses
   · chat.spaces
   · chat.memberships
3. Firebase Auth → 사용자에게 동의 화면 → 액세스 토큰 발급 (짧음)
   + 리프레시 토큰 (Firebase 가 관리, 서버·클라 노출 안 됨)
4. 로그인 후 클라이언트가 Firebase Functions 호출 시:
   · onAuthStateChanged → getIdToken() → Authorization: Bearer <ID>
   · Cloud Function 은 ID 토큰 검증 + Google 액세스 토큰을 함께 넘겨받음
5. Cloud Function 은 액세스 토큰으로 Admin/Classroom/Chat API 호출
```

**중요**: Firebase Auth 는 **리프레시 토큰을 앱에 노출하지 않는다**. 액세스 토큰은 1시간 후 만료 → 클라이언트가 `getIdToken(true)` 로 리프레시 → 새 액세스 토큰. 사용자가 브라우저 닫으면 세션 유지 여부는 Firebase Auth 의 persistence 설정.

⚠️ **알려진 제한**: Firebase Auth 의 Google provider 는 **리프레시 토큰을 관리 API 로 노출하지 않는다.** 백그라운드 대용량 작업(예: 1,000 계정 일괄 생성) 을 사용자 세션이 끊긴 뒤에도 계속 돌리려면 **별도 OAuth 흐름이 필요**하다 (Firestore 에 리프레시 토큰 저장, 서버가 갱신). 이 케이스가 필요한지 사용자 확인 필요 (§7 참조).

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

**규칙 원칙**: Firestore rules 는 **읽기·쓰기 모두 Cloud Function 을 경유하도록 잠근다** — 직접 접근 금지. 이유: 클라이언트 rules 는 역할 검증 로직을 복제하게 되고, 그러면 두 곳이 어긋난다. 함수 한 곳에서만 검증한다.

## 6. Cloud Functions 배치

- **`callable` 함수** (프론트 → 함수): 각 관리 동작마다 하나. `admin.users.list`, `admin.users.create`, `classroom.courses.list`, ...
- **`scheduled` 함수**: 지금은 없음. 필요해지면 §7 리프레시 토큰 문제부터 해결.
- **`firestore` 트리거**: `audit_log` 자동 기록, `work_queues` 상태 변경 감시.
- **인증 미들웨어**: 모든 callable 함수 앞에 붙는 것 — ID 토큰 검증 + 역할 조회 + 감사 로그 라인 준비.

## 7. 알려진 미결

1. ⚠️ **함수 리전** — Firestore 는 `asia-northeast3` 인데 Cloud Functions 2세대는 아직 서울 리전 지원이 얇다. `asia-northeast3` 로 강제하면 워크스페이스 API 지연이 늘 수 있고, `us-central1` 로 두면 Firestore 왕복이 늘어난다. 실측이 필요.
2. ⚠️ **리프레시 토큰 관리** — 백그라운드 대량 작업이 정말 필요한지. 필요하면 별도 OAuth 흐름을 세워야 함 (Firebase Auth 밖에서). 지금은 「사용자가 브라우저를 열어 두고 대량 작업이 돈다」 모델로 간다.
3. ⚠️ **Chat API 는 서비스 계정 도메인 위임을 요구하는 스코프가 있다** — 특히 `chat.admin.spaces` 계열. 「내가 만든 챗방」 은 사용자 권한으로 되지만, 「모든 챗방 삭제」 는 관리자 위임이 필요할 수 있음. 실측 필요.
4. ⚠️ **초기 관리자 부트스트랩** — `role_assignments` 가 비어 있으면 아무도 로그인해도 admin 이 아니다. 첫 배포 시 사용자의 이메일을 시드로 넣는 스크립트 필요.
5. ⚠️ **CSRF·XSS·비밀 관리** — Cloud Functions 는 Firebase Auth ID 토큰 검증으로 CSRF 이 자동 해결되지만, 프론트가 Google API 를 직접 부르는 경로(가벼운 조회) 에서 액세스 토큰이 브라우저 메모리에 있음. `localStorage` 금지, 메모리 저장만.
6. ⚠️ **비용** — Blaze 요금제 필수. 워크스페이스 API 는 요청 자체는 무료지만 함수 호출·Firestore 읽기 쓰기·아웃바운드 대역폭에 요금. 대량 작업 큐잉으로 폭주 방지.

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
