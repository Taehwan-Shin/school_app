# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **UI 재구성 v0.1 슬라이스** — `docs/design/UI_SYSTEM.md` v1.0 (2026-08-31 사용자 승인) 을 프론트엔드에 옮긴다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/ui-shell-v1`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 5~7 개로 분리 (아래 커밋 규칙).

**추가 §3-b Designer 몫 참고**: 이 슬라이스의 스타일 값은 모두 `docs/design/UI_SYSTEM.md` v1.0 에 있다. 값 (컬러 헥사·간격 클래스명·타이포 스케일) 을 그대로 옮긴다. 새 값 발명 금지 — 필요하면 Designer 에게 문의 (「판정 불가」로 두고 보고).

## 기준 커밋

**Base**: `cbf5228` (UI_SYSTEM v1.0 승인 반영)

## 지금 할 것 — UI 재구성 v0.1 (Shell · Sidebar · Topbar · 로그인 · 다크 모드)

### 왜

지금 화면은 「기능은 있으나 임시」 느낌. 사용자 회신 (Buzz DM `71af39591f19`) *"UI 가 좀더 깔끔하고 정돈되어야 할 것 같아"* + 방향 결정 *"레이아웃 재구성"* + 참고 masstige.io 톤 (`af7dee3d5dc4`). 이 슬라이스가 어드민 대시보드의 골격 (셸 · 나비 · 상단바 · 다크 모드) 을 설치하고, 기존 라우트 컨텐츠를 그 안에 옮긴다.

**하지 않는 것**: 데이터 화면 재설계 (표·다이얼로그 등은 기존 마크업 유지). 이번엔 「골격 + 로그인」 만.

### 이 과제가 바꿀 경로

**설정 · 토큰**:
- `packages/web/tailwind.config.js` — `theme.extend.colors` + `fontFamily` + `darkMode: 'class'` 확장. UI_SYSTEM §1·§2 값 그대로.
- `packages/web/src/index.css` (없으면 신설) — CSS custom properties 로 라이트/다크 컬러 토큰, Pretendard 로컬 폰트 import (`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css` 링크 방식).

**신규 파일**:
- `packages/web/src/components/shell/AppShell.tsx` — Sidebar + Topbar + Main 3 영역 컨테이너. `role` prop 을 받아 나비 항목 배치.
- `packages/web/src/components/shell/Sidebar.tsx` — 240px 고정 · 로고 텍스트 「학교」 · 역할별 나비 항목 · 하단 사용자 정보 (이메일 · 역할 뱃지).
- `packages/web/src/components/shell/Topbar.tsx` — 56px 고정 · 좌측 페이지 제목 · 우측 다크 모드 토글 · 우측 로그아웃 버튼.
- `packages/web/src/components/shell/ThemeToggle.tsx` — 다크 모드 토글 (해/달 lucide 아이콘). 로컬스토리지 + OS 감지.
- `packages/web/src/components/shell/nav-items.ts` — 역할별 나비 항목 정의 (라벨 + `to` 경로).
- `packages/web/src/lib/theme.tsx` — `ThemeProvider` (React context). 초기값 `matchMedia('prefers-color-scheme: dark')` 또는 localStorage.
- `packages/web/tests/AppShell.test.tsx` — 역할별 사이드바 항목 렌더링 시험.
- `packages/web/tests/ThemeToggle.test.tsx` — 클래스 토글 · localStorage 저장 시험.

**기존 파일 수정**:
- `packages/web/src/routes/login.tsx` — UI_SYSTEM 스타일로 재구성 (미니멀 카드 · 검정 fill 버튼 · 「구글로 로그인 →」 텍스트).
- `packages/web/src/routes/admin/index.tsx` — 콘텐츠를 `AppShell` 로 래핑. 기존 계정 카드·표는 그대로 두고 페이지 제목만 Topbar 로 이동.
- `packages/web/src/routes/super_admin/index.tsx` — 마찬가지로 `AppShell` 래핑.
- `packages/web/src/routes/teacher/index.tsx` — 마찬가지.
- `packages/web/src/App.tsx` — `ThemeProvider` 로 최상위 래핑.
- `packages/web/index.html` — Pretendard link 태그.

**제외** (다음 슬라이스에 남김):
- KPI 카드 (UI_SYSTEM §4.3) — 껍데기라도 만들지 마라. 다음 슬라이스에서 데이터와 함께.
- 표·다이얼로그 재스타일 — 기존 유지. 다음 슬라이스에서 UI_SYSTEM §4.4·§4.6 값 적용.
- 모바일 (`< md`) 사이드바 접힘 애니메이션 정교화 — 일단 CSS 만 (드로어 없이 hidden/block 토글).

### 세부 요구

#### 1. Tailwind config

- `darkMode: 'class'` 추가 (지금은 미설정).
- `theme.extend.colors` — UI_SYSTEM §1 토큰을 아래 이름으로 매핑:
  ```js
  colors: {
    canvas: 'var(--bg-canvas)',
    surface: 'var(--bg-surface)',
    elevated: 'var(--bg-elevated)',
    'fg-primary': 'var(--fg-primary)',
    'fg-secondary': 'var(--fg-secondary)',
    'fg-muted': 'var(--fg-muted)',
    'border-subtle': 'var(--border-subtle)',
    'border-strong': 'var(--border-strong)',
    'accent-primary': 'var(--accent-primary)',
    'accent-on-primary': 'var(--accent-on-primary)',
    'state-danger': 'var(--state-danger)',
    'state-success': 'var(--state-success)',
    'state-warning': 'var(--state-warning)',
  }
  ```
- `theme.extend.fontFamily.sans` = `['"Pretendard Variable"', ...defaultTheme.fontFamily.sans]`
- `theme.extend.fontSize` — UI_SYSTEM §2 7-스케일 을 커스텀 이름 (`display`, `h1`, `h2`, `h3`, `body`, `small`, `micro`) 로. 각 튜플 `[size, {lineHeight, fontWeight}]`.

#### 2. CSS custom properties

`packages/web/src/index.css` 에 라이트 (기본) + 다크 (`.dark` 셀렉터) 토큰 값 정의. 값은 UI_SYSTEM §1 그대로.

#### 3. AppShell 구성

- Grid 또는 flex 레이아웃. 좌측 사이드바 (`w-60`, `min-h-screen`, `bg-surface`, `border-r border-border-subtle`), 우측 (Topbar + Main).
- `role` prop 받음. `nav-items.ts` 에서 role 별 항목 배열 가져와 렌더.
- 사이드바 항목 마크업: `<Link>` (React Router), 스타일 UI_SYSTEM §4.2 그대로 (px-4 py-2 · hover · active border-l-2).
- 하단 사용자 카드: 이메일 텍스트 + role 뱃지 (text-micro · uppercase · tracking-wide · 배경 elevated).

#### 4. Topbar 구성

- 상단 sticky (`sticky top-0 z-10`), 56px 높이, `border-b border-border-subtle`, `bg-canvas`.
- 좌측: 현재 페이지 제목 — 각 라우트 컴포넌트가 `document.title` 을 통해 표시하거나, AppShell 이 prop 으로 받음. **간단히**: AppShell 에 `pageTitle` prop 추가하고 라우트가 넘긴다.
- 우측: `<ThemeToggle />` · `<button>로그아웃</button>` (Secondary 스타일).

#### 5. ThemeToggle · Provider

- `ThemeProvider` 는 `<html>` 에 `.dark` 클래스 조작 (Tailwind darkMode='class').
- 초기값 순서: (1) `localStorage.getItem('theme')`, (2) `matchMedia('(prefers-color-scheme: dark)').matches`, (3) 라이트.
- 토글 시 localStorage 저장.
- ThemeToggle 컴포넌트 자체는 두 아이콘 (Sun / Moon) 을 상태 따라 표시. `lucide-react` 사용 (미설치면 `pnpm add lucide-react`).

#### 6. login.tsx 재구성

- 배경: `min-h-screen bg-canvas flex items-center justify-center px-6`.
- 중앙 카드: `w-full max-w-md p-8 bg-elevated border border-border-subtle` (샤프 코너, 그림자 없음).
- 제목: `text-h2 font-bold text-fg-primary`, "학교 워크스페이스 관리".
- 서브: `text-small text-fg-secondary mt-2`, "Google 계정(`cam.hs.kr`)으로 로그인하세요".
- 로그인 버튼: Primary (검정 fill), `w-full mt-8 px-6 py-3 bg-accent-primary text-accent-on-primary text-body font-medium hover:opacity-90`, 텍스트 "구글 계정으로 로그인 →".
- 에러 배너 (`errorMessage`): `mt-4 px-4 py-3 border border-state-danger text-state-danger text-small`.
- 하단 안내: `text-small text-fg-muted mt-4`, "허용된 도메인(`cam.hs.kr`) 이외의 계정은 로그인이 차단됩니다." (기존 "자동으로 삭제" 문구는 부정확하니 정정 — 실제로는 생성 단계에서 차단).
- 개발 emulator 로그인 UI 는 유지 (import.meta.env.DEV 조건).

#### 7. 역할 화면을 AppShell 로 래핑

각 라우트 파일 상단에 `<AppShell role={role} pageTitle="관리자">` 로 감싸기. 기존 콘텐츠는 그 안 `children` 으로 그대로.

`admin/index.tsx` 예시 흐름:
- role 은 `useAuth()` 에서 가져옴.
- `<AppShell role={role} pageTitle="관리자">` 로 래핑.
- 안쪽에 기존 「계정 정보 카드」 (이메일 · 역할 뱃지 · 로그아웃) 는 **제거** — 이 자리는 Topbar/Sidebar 가 대신함. **중복 제거는 삭제로 잡히므로 이 슬라이스에서 예외**: 삭제 6줄 정도 발생. 오더에 명시된 대체이므로 허용.

Teacher · super_admin 도 같은 패턴.

#### 8. 기존 컴포넌트 최소 변경

- `AccountsTable`, `CreateUserDialog`, `DeleteUserDialog` — 이번 슬라이스에서 스타일 재작업 **하지 마라**. 다음 슬라이스로.
- `components/ui/button.tsx`, `dialog.tsx`, `table.tsx` — 손대지 마라.

#### 9. 테스트

- `AppShell.test.tsx` — role 별 사이드바 항목 렌더링 시험. 3 케이스 (super_admin · admin · teacher).
- `ThemeToggle.test.tsx` — 초기 라이트 → 토글 시 `.dark` 클래스 · localStorage 값 · 다시 토글.
- 기존 테스트 (48+) 는 전부 통과 유지. 라우트 마크업 변경이 있으면 관련 테스트도 조정 (변경 이유 커밋 메시지에 명시).

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 신규 2 + 기존 유지 통과.
5. 프로덕션 번들 grep — Pretendard link 태그 렌더 확인 (`index.html` 에 있어야 함).
6. dev 서버 (`pnpm --filter @school-app/web dev`) 로컬 실행 → 다음 눈 확인 목록:
   - `/login` 화면이 UI_SYSTEM 톤 (미니멀 카드 · 검정 버튼 · 「→」)
   - 로그인 후 좌측 사이드바 (240px) + 상단바 (56px) + 메인 영역
   - 사이드바 나비 항목 클릭 시 라우팅
   - 다크 모드 토글 작동 (상단바 우측 아이콘)
   - 새로고침 후 다크 모드 상태 유지 (localStorage)
   - 창 폭 < 768px 에서 사이드바 hidden (일단 사라짐 확인만, 접힘 UI 는 다음 슬라이스)

### 판정 불가로 두는 것

- **실 계정 로그인 후 화면** — 헤드가 배포 후 눈으로 확인.
- **모바일 UX 세부** (사이드바 접힘 애니메이션 · 드로어) — 다음 슬라이스.
- **KPI 카드 · 표 재스타일** — 다음 슬라이스.

### 커밋 규칙

**5~7 커밋 분리** (리뷰 편의):
1. `chore(web): Tailwind config 확장 (컬러 토큰 + Pretendard + 다크 모드 class)`
2. `feat(web): CSS custom properties + Pretendard 링크 (UI_SYSTEM §1·§2)`
3. `feat(web): ThemeProvider + ThemeToggle (다크 모드)`
4. `feat(web): AppShell + Sidebar + Topbar 컴포넌트`
5. `feat(web): login.tsx UI_SYSTEM 톤으로 재구성`
6. `feat(web): 세 역할 라우트를 AppShell 로 래핑`
7. `test(web): AppShell + ThemeToggle 단위 시험`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/ui-shell-v1`.

## 상태 보고 (필수)

완료 시 `#school_app` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름 (`feat/ui-shell-v1`)
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과 (통과 / 판정불가 / 실패 이유)
- 신규 스크린샷 최소 3장 — `/login`, `/admin` (또는 `/super_admin`), 다크 모드 상태
- 오더 대비 차이 (있으면)

push 없이 보고 시 재작업.
