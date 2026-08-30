# school_app

Google Sheets 위에서 돌던 두 Apps Script(계정관리·클래스룸관리) 를 파이어베이스 기반 웹앱으로 옮긴다.

- 무엇을·왜: [AGENTS.md](./AGENTS.md)
- 지금 열린 항목: [STATUS.md](./STATUS.md)
- 일지: [project_notes.md](./project_notes.md)
- 일꾼 오더: [docs/handoff/NEXT.md](./docs/handoff/NEXT.md)

## 훅 활성화 (클론 직후 매번)

```bash
git config core.hooksPath .githooks
```

이걸 안 하면 커밋 범위 가드가 **안 돈다**.

## 개발 환경 설정 및 실행

### 1. 패키지 설치 및 빌드

```bash
# 전체 의존성 설치
pnpm install

# 전체 패키지 빌드
pnpm build

# 전체 테스트 실행 (단위 테스트)
pnpm test

# Functions 에뮬레이터 통합 테스트 실행
pnpm test:emu
```

### 2. 로컬 에뮬레이터 실행

```bash
# Firebase Emulator Suite 실행 (Auth, Firestore, Functions, UI)
pnpm emu
```

이 스크립트는 저장소에 고정된 `firebase-tools` 를 사용합니다 (`npx firebase` 는 매번 최신 버전을 받아 재현성이 떨어지므로 쓰지 마세요).

- Emulator UI: `http://localhost:4000`
- Auth Emulator: `http://localhost:9099`
- Firestore Emulator: `http://localhost:8085`
- Functions Emulator: `http://localhost:5001`

### 3. 웹 프론트엔드 개발 서버

```bash
pnpm --filter @school-app/web dev
```

- Web Dev Server: `http://localhost:5173`

### 4. 로컬 에뮬레이터 시험 흐름

```bash
# 1. 다른 터미널에서 에뮬레이터 실행
pnpm emu

# 2. 웹 개발 서버 실행
pnpm --filter @school-app/web dev

# 3. 브라우저에서 http://localhost:5173 접속 -> 「개발 환경 에뮬레이터 로그인」 에서 test@cam-t.kr 로 로그인
# 4. /teacher 대시보드 화면 도달 및 Emulator UI(http://localhost:4000) 에서 users/{uid} 문서 생성 확인
```
