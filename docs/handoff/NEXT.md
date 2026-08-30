# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **GitHub Actions CI 도입** (사용자 결정 `9cafd59467d8` "A 안 대로 해줘").

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `git push` 금지
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript 컴파일 · Vitest · 신규 워크플로 문법 검사

**추가**: **완료 후 반드시 `#general` 스레드에 `@Claude Code_Honey` 를 포함해 결과 보고**. 지난 두 오더 모두 커밋만 하고 침묵했다. 이번엔 명시 규칙으로 못 박는다. 상태 보고 미제출은 재작업 요구 사유.

## 기준 커밋

**Base**: `a0b38a3` (첫 슬라이스 병합 승인 기록 커밋)

`git log --oneline -1` 로 실물 확인 후 시작.

## 지금 할 것 — GitHub Actions CI 도입

### 왜

Codex 감사가 「Node 20 실측」을 판정불가로 남겼다. 지금 헤드 환경은 Node 22 이고 로컬 재현이 불편하다. CI 를 붙이면:
- 모든 PR·`main` push 마다 Node 20 에서 자동으로 unit + 에뮬레이터 통합 시험이 돈다
- 회귀가 즉시 잡힌다
- Codex 의 「Node 20 판정불가」가 실제 실행으로 해소된다

이 오더의 값은 **회귀 방지 + Node 20 관문 자동화**.

### 이 과제가 바꿀 경로

**신규 파일만** (기존 파일 수정은 `README.md` 배지 · `.gitignore` 만):
- `.github/workflows/ci.yml` — 메인 워크플로
- `.github/workflows/README.md` — (선택) 워크플로 요약 (해도 되고 안 해도 되고)
- `README.md` — 상단에 CI 배지 (`![CI](...svg)`) 한 줄만 추가
- `.gitignore` — CI 산물 (예: coverage/, .cache/) 필요 시

**기존 파일 삭제 금지**. `AGENTS.md`·`STATUS.md`·`docs/` 손대지 마라.

### 세부 요구

#### 1. 워크플로 골자 (`.github/workflows/ci.yml`)

트리거:
- `push` 대상: `main`, `feat/*`, `fix/*` (또는 전 브랜치)
- `pull_request` 대상: `main`

Job **하나**로 시작 (단순함 우선). 이름: `verify`.

Runner: `ubuntu-latest`.

Steps 순서:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` — Node **20.x** (정확한 20 major 대) 명시.
3. `pnpm/action-setup@v4` — 저장소 루트 `package.json` 의 `packageManager` 필드에서 pnpm 버전 자동 감지 (없으면 `version: 11` 명시)
4. **pnpm store 캐시** — `actions/cache@v4` 로 `~/.pnpm-store` 경로 캐시. 키: `${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}`.
5. `pnpm install --frozen-lockfile` — lockfile 변경 감지 시 실패해야
6. **Java 설치** — `actions/setup-java@v4` with `distribution: temurin`, `java-version: 17`. Firestore Emulator 요구.
7. `pnpm -r build` — 셋 다 컴파일 통과
8. `pnpm -r lint` — TS 검사
9. `pnpm -r test` — unit 21 통과
10. `pnpm test:emu` — Emulator 통합 5/5 통과. 이 스텝에서 Firebase Emulator 가 자동 다운로드 됨.
11. **선택**: coverage 리포트 (지금은 스킵. 다음 오더에서.)

**주의**:
- 모든 `pnpm` 스텝 앞에 `env: HUSKY: '0'` 같은 훅 스킵은 필요 없음 (우리 프로젝트는 husky 없음)
- `actions/setup-node` 의 `cache: 'pnpm'` 는 쓰지 마라 — pnpm store 는 위 별도 캐시로. `cache: 'pnpm'` 는 pnpm/action-setup 뒤에 두면 충돌.
- `pnpm test:emu` 실행 시 Firebase Emulator 가 처음이면 다운로드에 30~60초. 캐시할 값어치는 있지만 지금은 스킵.
- Timeout: job 전체 15 분.

#### 2. `package.json` 의 `packageManager` 필드

`package.json` 루트에 아직 `packageManager` 가 없으면 추가:
```
"packageManager": "pnpm@11.0.9"
```
버전은 로컬 `pnpm --version` 결과 값 그대로. **Antigravity: 이 값을 하드코딩하지 말고 `pnpm --version` 을 저장소에서 실행해 실제 값을 붙여라.**

#### 3. `README.md` 배지 한 줄

파일 최상단 `# school_app` 헤더 바로 아래에 한 줄만 삽입:
```
[![CI](https://github.com/Taehwan-Shin/school_app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Taehwan-Shin/school_app/actions/workflows/ci.yml)
```
다른 문장 손대지 마라.

### 완료 확인 방법 (「결과가 나오는가」)

**모두 통과해야 완료**:

1. **커밋 후 GitHub Actions 실행 확인** — Antigravity 가 커밋을 push 하면 (push 는 헤드가 하지만, 커밋만 되고 push 는 헤드 몫), `git log` 로 CI 워크플로가 존재함을 헤드가 볼 수 있어야.
2. **워크플로 문법 검증** — 로컬에서 가능하면 `actionlint` 같은 도구로. 없으면 `pnpm dlx @action-validator/cli check .github/workflows/ci.yml` 를 시도.
3. **로컬 재현** — CI 스텝을 로컬에서 재현: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r lint && pnpm -r test`. 각 스텝이 에러 없이 통과.
4. **`packageManager` 필드 정합** — `package.json` 에 `packageManager` 필드가 로컬 pnpm 버전과 일치.
5. **README 배지 SVG URL** — 저장소 URL(`Taehwan-Shin/school_app`), 브랜치(`main`), 파일명(`ci.yml`) 이 정확.

### 판정 불가로 두는 것

- **실 CI 실행 결과** — Antigravity 가 push 할 수 없으므로 실 GitHub Actions 러너에서의 결과는 헤드가 push 후 확인. 이 오더의 완료 판정 대상 아님.
- **Node 20 실행 성공** — GitHub 러너 Node 20 에서만 검증 가능. 헤드가 push 후 관찰.

### 커밋 규칙

- 「CI 워크플로 신설」 → 「package.json packageManager + README 배지」 순으로 **2 커밋 분리**.
- 각 커밋 메시지 첫 줄 형식: `ci: ...` 또는 `chore: ...`.
- `git add -A` 금지. 파일 명시.

## 상태 보고 (필수)

완료 시 다음을 `#general` 스레드에 **`@Claude Code_Honey` 를 포함해서** 보고:
- 마지막 커밋 해시
- `git status` 결과 (트리 깨끗한지)
- 완료 확인 다섯 개 각각의 결과 (통과·실패·판정불가)
- 오더와 다르게 진행한 부분 (있으면)
- 특히: `pnpm --version` 실측 값과 `packageManager` 필드에 넣은 값

**보고 없이 커밋만 하면 재작업 대상**. 지난 두 오더에서 무보고로 헤드가 상태를 확인하는 데 시간을 두 배로 썼다. 이번엔 예외 없다.
