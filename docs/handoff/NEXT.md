# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **첫 슬라이스 마무리** — Codex 재감사 지적 두 건 (에뮬레이터 통합 테스트 + 웹 에뮬레이터 로그인 경로).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `git push` 금지
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript 컴파일 · Vitest · 신규 에뮬레이터 테스트

**추가**: **완료 후 반드시 `#general` 스레드에 결과 보고**. 지난 오더에서 커밋만 하고 보고를 안 올려서 사용자가 「반응이 없다」 고 문의했다. 이번엔 명시 규칙으로 못 박는다.

## 기준 커밋

**Base**: `9960e59` (v1→v2 Auth 트리거 마이그레이션 완료 커밋)

`git log --oneline -1` 로 실물 확인 후 시작.

## 지금 할 것 — 첫 슬라이스 마무리

### 왜

Codex 재감사가 첫 슬라이스 병합 전 필수라고 못 박은 두 가지:
- 에뮬레이터 통합 테스트가 없어 오더 완료 조건 3·4·5 를 실행할 방법이 없다.
- 웹에서 에뮬레이터 가짜 사용자로 로그인해 `/teacher` 도달을 확인할 경로가 없다.

이 두 개만 채우면 첫 슬라이스가 병합 가능한 상태가 된다. **신규 기능은 없다.**

### 이 과제가 바꿀 경로

**추가·수정 대상**:
- `packages/functions/tests/` — 신규 에뮬레이터 통합 테스트 파일 (기존 mock 테스트는 유지)
- `packages/functions/package.json` — 에뮬레이터 통합 테스트 스크립트 추가 (예: `test:emu`), `@firebase/rules-unit-testing` 또는 `firebase-functions-test` devDep 추가
- `packages/web/src/lib/auth.tsx` — 개발 환경에서만 노출되는 이메일 기반 에뮬레이터 로그인 함수 추가
- `packages/web/src/routes/login.tsx` (또는 로그인 페이지) — 개발 환경 전용 「에뮬레이터로 로그인」 버튼 추가 (`import.meta.env.DEV` 로 게이트)
- `README.md` — 새 명령 · 시험 흐름 반영

**기존 mock 테스트는 지우지 마라** — pure handler 단위 테스트도 값이 있다. 통합 테스트는 별도 파일로 신설.

### 세부 요구

#### 1. 에뮬레이터 통합 테스트 (functions)

- 신규 파일: `packages/functions/tests/onUserCreate.emu.test.ts`
- 사용 라이브러리 선택 — 다음 중 하나:
  - `firebase-functions-test` (v3.x) 을 online 모드로 (`initializeApp` 로 실 admin SDK 사용, Emulator 환경변수로 라우팅)
  - 또는 순수 `firebase-admin` 을 Emulator 환경변수로 초기화하고, `beforeUserCreated` 핸들러 로직을 직접 호출한 뒤 Firestore Emulator 상태를 조회
- 테스트 흐름:
  1. `FIRESTORE_EMULATOR_HOST=localhost:8080`, `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` 를 테스트 fixture 로 설정
  2. `handleUserCreate` 를 `@cam.hs.kr` 이메일로 호출 → Firestore Emulator 의 `users/{uid}` 문서가 실제로 존재하는지 조회로 검증
  3. 다른 도메인으로 호출 → `HttpsError('permission-denied')` throw 되는지 검증, Firestore 상태 변화 없는지 조회로 검증
- 실행: 에뮬레이터가 떠 있어야 함. `package.json` 에 `test:emu` 스크립트 추가:
  ```
  "test:emu": "firebase emulators:exec --project=demo-school 'vitest run --config vitest.emu.config.ts'"
  ```
- 별도 `vitest.emu.config.ts` 로 `*.emu.test.ts` 만 포함하도록 필터.
- 루트 `package.json` 에 `test:emu`: `pnpm --filter @school-app/functions test:emu` 추가.

**주의**: 
- `firebase emulators:exec` 는 저장소 루트 `firebase.json` 을 읽는다 — Auth·Firestore 에뮬레이터 절이 이미 있는지 확인. 없으면 추가.
- 에뮬레이터 프로젝트 ID 는 `demo-school` 같이 실제 프로젝트가 아닌 값으로 고정 (실수 배포 방지).

#### 2. 웹 에뮬레이터 로그인 경로

- `packages/web/src/lib/auth.tsx` 에 함수 추가:
  ```ts
  export async function signInWithEmulator(email: string): Promise<void>
  ```
  - `import.meta.env.DEV === false` 이면 즉시 throw (프로덕션 방어)
  - `signInWithEmailAndPassword(auth, email, 'password')` 시도
  - 실패 시 `createUserWithEmailAndPassword` 로 새 사용자 만들고 재시도
- 로그인 페이지에 개발 환경 전용 UI 블록 추가:
  - `import.meta.env.DEV` 일 때만 렌더
  - 텍스트 입력 (이메일) + 「에뮬레이터로 로그인」 버튼
  - `test@cam.hs.kr` 을 기본 placeholder 로
- **주의**: 프로덕션 빌드 (`pnpm --filter @school-app/web build`) 결과물에 개발 전용 코드가 들어가는지 검증. `import.meta.env.DEV` 는 Vite 가 build 시 `false` 로 트리 흔들기 하므로 dead-code elimination 확인.

#### 3. `README.md` 갱신

- 로컬 개발 흐름에 「에뮬레이터에서 시험」 절 추가:
  ```
  1. pnpm emu           # 다른 창에서 에뮬레이터
  2. pnpm --filter @school-app/web dev
  3. 브라우저 http://localhost:5173 → 「에뮬레이터로 로그인」 버튼 → test@cam.hs.kr
  4. /teacher 화면 도달 · Emulator UI localhost:4000 에서 users/{uid} 문서 확인
  ```
- `pnpm --filter @school-app/functions test:emu` 명령도 안내.

### 완료 확인 방법 (「결과가 나오는가」)

**모두 통과해야 완료**:

1. **에뮬레이터 시작 후 통합 테스트**: `pnpm --filter @school-app/functions test:emu` 가 새 파일의 두 케이스 (허용 도메인 · 거부 도메인) 를 통과.
2. **웹 에뮬레이터 로그인 → 대시보드 도달**: 사람이 브라우저로 확인 가능한 경로가 있다. 사람 확인은 헤드가 별도로. **에뮬레이터로 로그인 후 라우팅이 `/teacher` 로 가는지** 는 web 쪽 통합 테스트로도 커버 (Vitest + `@testing-library` 로 가짜 auth state 주입).
3. **프로덕션 빌드 dead-code 검증**: `pnpm --filter @school-app/web build` 결과에서 `signInWithEmulator` 문자열이 `dist/assets/*.js` 에 남지 않는지 grep. 남으면 조건부 import 로 감쌈.
4. **기존 19 테스트 모두 통과 유지** (`pnpm -r test`).
5. **타입 검사·빌드 에러 0**: `pnpm -r build`, `pnpm -r lint`.
6. **README 명령이 실제로 도는지 검증** (실물 시험).

### 판정 불가로 두는 것

- **실 Google 로그인 흐름** — 실 도메인 계정 필요. 헤드가 별도 실측.
- **UI 미학** — 개발용 로그인 UI 는 실용성만.

### 커밋 규칙

- 「functions 에뮬레이터 통합 테스트」 → 「web 에뮬레이터 로그인 함수·페이지」 → 「README 갱신」 순으로 최소 2~3 커밋.
- 각 커밋 메시지 첫 줄 형식: `feat(scope): ...` 또는 `test(scope): ...` 또는 `docs: ...`.
- `git add -A` 금지. 파일 명시.

## 상태 보고 (필수)

완료 시 다음을 `#general` 스레드에 **@Claude Code_Honey 를 포함해서** 보고:
- 마지막 커밋 해시
- `git status` 결과 (트리 깨끗한지)
- 완료 확인 여섯 개 각각의 결과 (통과·실패·판정불가)
- 오더와 다르게 진행한 부분 (있으면)
- 걸린 시간 대략

**보고 없으면 병합 안 함.** 지난 오더처럼 커밋만 하고 스레드 침묵하지 마라 — 헤드가 반영·판정·감사 파견을 하려면 이 보고가 트리거.
