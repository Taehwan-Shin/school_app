# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **v1.0 첫 화면 껍데기** — 로그인 + 역할별 첫 화면. 실제 API 호출은 다음 오더.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `git push` 금지
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript 컴파일 · Vitest · 에뮬레이터 테스트

## 기준 커밋

**Base**: `1c497e5` (설계 v1.0 확정 커밋)

`git log --oneline -1` 로 실물 확인 후 시작.

## 지금 할 것 — 모노레포 뼈대 + 로그인 + 역할별 껍데기

### 왜

`DESIGN_v1.md` §9·§10 의 스택·구조를 실제로 세운다. 목표: **사용자가 Google 로 로그인하면 자기 역할별 껍데기 화면이 뜬다.** 실제 관리 기능은 다음 오더. 이 오더의 값은 **스택 정합성 증명**이다.

### 이 과제가 바꿀 경로

**신규 파일만** (기존 파일 수정은 `README.md` 만):
- `package.json` · `pnpm-workspace.yaml` · `.nvmrc`
- `packages/shared/` — TS 패키지 (`Role`, `Capability`, `ROLE_CAPABILITIES` 매트릭스)
- `packages/web/` — Vite + React + TS + Tailwind + shadcn/ui + Firebase JS SDK
- `packages/functions/` — Firebase Functions 2세대 (TS, Node 20)
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- `.firebaserc` (프로젝트 alias `default = school-app-507112`)
- `README.md` 갱신 (로컬 개발 명령)

### 스택 (DESIGN_v1.md §9)

- pnpm workspace
- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui (초기화만, 최소 컴포넌트)
- TanStack Query
- Firebase JS SDK (Auth · Functions · Firestore)
- Firebase Functions 2세대 · Node 20 · TS
- Vitest · Firebase Emulator Suite

### 세부 요구 (원칙)

#### `packages/shared/`
- `src/roles.ts`: `Role` 유니온 타입 (`"super_admin" | "admin" | "teacher"`).
- `src/capabilities.ts`: `Capability` 유니온 (roles.md §2.1 의 문자열 상수).
- `src/roleCapabilities.ts`: `ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>>` (roles.md §2.2 매트릭스 그대로).
- `src/index.ts`: 모두 재export.
- `package.json`: `"name": "@school-app/shared"`, `"type": "module"`, TS 빌드 타깃.

#### `packages/web/`
- `.env.example`: `VITE_FIREBASE_*` 키 명시 (실제 값은 로컬 `.env.local` 에, `.gitignore` 반영).
- `src/lib/firebase.ts`: Firebase 초기화. `VITE_FIREBASE_*` 로 config. Emulator 접속 로직 (`import.meta.env.DEV`).
- `src/lib/auth.ts`: Google provider 로그인. `hd: "cam-t.kr"` 로 도메인 힌트. 로그인 성공 후 ID 토큰의 `custom claim role` 을 읽어 라우팅 결정.
  - **주의**: `hd` 는 힌트일 뿐 강제 아님. **서버(Auth 트리거) 에서 도메인 검증 강제**.
- `src/routes/`: React Router v6 사용.
  - `/` → 로그인 상태면 역할별 화면으로, 아니면 `/login`
  - `/login` → 로그인 화면 (Google 버튼 하나)
  - `/super_admin` → 껍데기 페이지 (제목 · 이메일 · 역할 · 「감사 로그 자리」·「함수 상태 자리」 안내문)
  - `/admin` → 껍데기 페이지 (제목 · 이메일 · 역할 · 「계정·그룹·챗·클래스룸 대시보드 자리」 안내문)
  - `/teacher` → 껍데기 페이지 (제목 · 이메일 · 역할 · 「본인 클래스룸 자리」 안내문)
- **가드**: 로그인 안 된 상태로 역할 라우트 진입 → `/login` 리다이렉트. 로그인은 됐는데 URL 이 자기 역할이 아니면 → 자기 역할로 리다이렉트.
- **하드코딩 금지 원칙 확인** — 라우팅에서 `if (role === 'admin')` 를 쓰지 말고 `{ super_admin: SuperAdminHome, admin: AdminHome, teacher: TeacherHome }[role]` 처럼 표 조회로.
- shadcn/ui: `pnpm dlx shadcn@latest init` → 최소한만. `Button` 하나 정도.

#### `packages/functions/`
- `src/index.ts`: 함수 export.
- `src/auth/onUserCreate.ts`: Firebase Auth 트리거. 신규 사용자의 이메일 도메인이 `cam-t.kr` 이 아니면 **계정 즉시 삭제** (`getAuth().deleteUser(uid)`). 통과하면 `users/{uid}` 문서 create + `role: "teacher"` custom claim 설정.
- `src/callable/getMe.ts`: 첫 callable. `context.auth.token` 검증 후 `{ email, role }` 반환. 실패 시 `functions.https.HttpsError('unauthenticated', ...)`.
- `firebase.json`: functions region `asia-northeast3`.

#### `firestore.rules`
- roles.md §4 의 예시대로 최소만. `audit_log write: if false` · `users read: if request.auth != null; write: if false` · `basic_data` 는 `admin`+.

#### `firebase.json` · Emulator
- Emulator 포트: Auth 9099, Firestore 8080, Functions 5001, UI 4000 (기본값들).
- `firebase.json` 에 emulators 절 포함.

### 완료 확인 방법 (「결과가 나오는가」)

**모두 통과해야 완료**:

1. **모노레포**: `pnpm install` 이 저장소 루트에서 에러 없이 끝난다. `pnpm --filter web dev` 로 Vite 가 뜬다. `pnpm --filter functions build` 로 함수 빌드 성공.
2. **에뮬레이터**: `firebase emulators:start` 로 Auth · Firestore · Functions 가 뜬다. Emulator UI (`http://localhost:4000`) 에서 확인 가능.
3. **로그인 흐름 (에뮬레이터, 실 도메인 필요 없음)**:
   - `pnpm --filter web dev` 로 웹 열기.
   - 에뮬레이터 Auth 에서 `test@cam-t.kr` 로 가짜 사용자 생성.
   - 웹에서 로그인 → 역할 `teacher` 로 `/teacher` 화면이 뜬다.
   - Emulator Firestore 에서 `users/{uid}` 문서 존재 확인 (`email`, `role: "teacher"`).
4. **도메인 검증**:
   - 에뮬레이터 Auth 에서 `test@example.com` (도메인 다름) 생성 → 트리거가 즉시 삭제 → Auth 목록에서 사라짐.
5. **자가 테스트**: `pnpm --filter functions test` — `onUserCreate` 에뮬레이터 테스트 두 개 (통과 도메인 · 실패 도메인) 를 최소한 통과.
6. **타입 검사·빌드·린트**: 각 패키지에서 `pnpm build` · `pnpm lint` 에러 0.

### 이 오더에서 사람이 눈으로 봐야 하는 것 (「판정 불가」로 두는 것)

- **UI 미학** — 껍데기라 「보기 좋음」은 이 오더 목표 아님. 텍스트가 화면에 뜬다는 것만 확인.
- **실 Google 로그인 흐름** — 실 도메인 (`cam-t.kr`) 계정 필요. 에뮬레이터 테스트가 통과하면 실 로그인 시험은 헤드가 별도로.

### 커밋 규칙

- 「packages/shared 뼈대」 → 「packages/functions 뼈대 + Auth 트리거」 → 「packages/web 뼈대 + 로그인 + 역할 라우팅」 → 「firestore.rules · firebase.json · emulator」 순으로 **최소 3~4 커밋 분리**.
- 각 커밋 메시지 첫 줄 형식: `feat(scope): 짧은 설명` 또는 `chore: ...`.
- `git add -A` 금지. 파일 명시.
- **커밋 전 기계 관문 통과 필수** (`pnpm build && pnpm test` 관련 패키지).

### 다음 오더 (참고, 이 오더 밖)

- 실제 Callable (`users.list` 등) — 서비스 계정 준비 후.
- Firestore rules + 에뮬레이터 통합 테스트 확장.

## 상태 보고

완료 시 다음을 `#general` 스레드에 보고:
- 마지막 커밋 해시 (`git log --oneline -1`)
- `git status` 결과 (트리 깨끗한지)
- 각 완료 확인 항목의 결과 한 줄 (통과·실패·판정불가)
- 오더와 다르게 진행한 부분 (있으면)

헤드가 받아서 기계 관문 재확인 → Codex 감사 파견 → 판정.
