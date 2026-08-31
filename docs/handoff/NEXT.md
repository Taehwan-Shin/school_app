# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **UI 재구성 v0.2 — 계정 뷰 재스타일** — UI shell v0.1 (`b075388`) 위에 계정 관리 뷰(표·다이얼로그·버튼) 를 UI_SYSTEM 값으로 재스타일한다.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/ui-accounts-v2`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고 (브랜치 이름 + 커밋 해시). 커밋 3~5 개로 분리.

**Designer 몫**: 이 슬라이스의 모든 스타일 값은 `docs/design/UI_SYSTEM.md` v1.0 에 있다. 값을 그대로 옮긴다. 새 값 발명 금지.

## 기준 커밋

**Base**: `b075388` (UI shell v0.1 병합 커밋)

## 지금 할 것 — 계정 뷰를 UI_SYSTEM 값으로 재스타일

### 왜

UI shell v0.1 이 셸 · 사이드바 · 상단바 · 다크 모드 뼈대를 놓았다. 지금 셸 안의 콘텐츠 (계정 표 · 생성/삭제 다이얼로그 · 버튼) 는 **기존 shadcn 기본 스타일** 그대로다. 다크 모드에서 어색하고 UI_SYSTEM 톤과도 어긋난다. 이 슬라이스가 그 콘텐츠를 UI_SYSTEM 값으로 옮긴다.

**하지 않는 것**: 새 기능. 새 라우트. 새 callable. 순수 스타일 · 마크업 재구성만.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/components/ui/button.tsx` — UI_SYSTEM §4.5 세 변형 (Primary · Secondary · Link) 을 shadcn variants 로 매핑. `rounded-none` (샤프 코너). 다크 모드 자동.
- `packages/web/src/components/ui/table.tsx` — UI_SYSTEM §4.4 값 (border-subtle · text-micro 헤더 · text-small 셀 · hover:bg-surface). rounded-none.
- `packages/web/src/components/ui/dialog.tsx` — UI_SYSTEM §4.6 값 (bg-elevated · border-subtle · rounded-none · p-8 · max-w-md · overlay bg-black/40).
- `packages/web/src/routes/admin/AccountsTable.tsx` — 상단 「+ 계정 추가」 버튼을 Primary 스타일로. 각 행 「삭제」 를 Link 스타일 (`text-state-danger` · `underline`). 로딩 · 에러 · 빈 상태를 UI_SYSTEM 톤으로.
- `packages/web/src/routes/admin/CreateUserDialog.tsx` — 폼 요소 UI_SYSTEM §4.7 값. 라벨 · 인풋 · 에러 · 도움말. 하단 버튼 정렬 (Secondary 취소 + Primary 저장).
- `packages/web/src/routes/admin/DeleteUserDialog.tsx` — 이메일 재입력 필드 UI_SYSTEM §4.7 값. 하단 버튼 (Secondary 취소 + Danger primary 삭제).

**신규 파일**: 없음. 순수 리팩터.

**손대지 마라**:
- `packages/web/src/components/shell/*` — UI shell v0.1 결과 그대로
- `packages/web/src/routes/login.tsx` — 이미 UI_SYSTEM 스타일
- `packages/web/src/api/*` — 로직 손대지 마라
- `packages/web/tailwind.config.js` · `src/index.css` — 이미 토큰 다 있음

### 세부 요구

#### 1. `components/ui/button.tsx`

shadcn 의 기본 `default` · `secondary` · `ghost` · `link` variant 를 UI_SYSTEM 값으로 재정의:

- `variant="default"` (Primary): `bg-accent-primary text-accent-on-primary hover:opacity-90 disabled:opacity-40`
- `variant="secondary"`: `border border-border-subtle bg-canvas text-fg-primary hover:bg-surface`
- `variant="destructive"`: `bg-state-danger text-white hover:opacity-90`
- `variant="ghost"`: `text-fg-primary hover:bg-surface`
- `variant="link"`: `text-fg-primary underline decoration-fg-muted hover:decoration-fg-primary`

- 공통: `rounded-none` (샤프), `font-medium`, `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`
- 크기 `default`: `px-4 py-2 text-body`. 크기 `sm`: `px-3 py-1.5 text-small`. 크기 `lg`: `px-6 py-3 text-body`.

**주의**: 다크 모드에서 `border-accent-primary` 는 자동으로 흰색 (`var(--accent-primary)` 이 다크 모드에서 `#FAFAFA`). 별도 조건 필요 없음.

#### 2. `components/ui/table.tsx`

- `<Table>`: `border border-border-subtle rounded-none w-full text-small`
- `<TableHeader>`: `bg-surface`
- `<TableHead>` (헤더 셀): `text-micro uppercase tracking-wide text-fg-secondary px-4 py-3 border-b border-border-subtle text-left`
- `<TableRow>`: `border-b border-border-subtle hover:bg-surface transition-colors`
- `<TableCell>`: `px-4 py-3 text-body text-fg-primary`

#### 3. `components/ui/dialog.tsx`

- `<DialogOverlay>`: `bg-black/40 fixed inset-0`
- `<DialogContent>`: `bg-elevated border border-border-subtle rounded-none p-8 max-w-md mx-auto shadow-none`
- `<DialogTitle>`: `text-h2 font-bold text-fg-primary`
- `<DialogDescription>`: `text-small text-fg-secondary mt-2`
- `<DialogFooter>`: `flex justify-end gap-3 mt-8`

#### 4. `routes/admin/AccountsTable.tsx`

- 상단 액션: 「+ 계정 추가」 (Primary Button). 우측 정렬. 아이콘 없음.
- 표 컨테이너: `border border-border-subtle rounded-none`.
- 각 행 액션 열: 오른쪽 정렬. 「삭제」 텍스트 링크 (`text-state-danger underline decoration-transparent hover:decoration-state-danger`). 자기 행이면 `text-fg-muted cursor-not-allowed underline-none`.
- 로딩: 표 자리에 `text-small text-fg-secondary py-8 text-center` 로 「불러오는 중…」.
- 에러: 표 대신 `border border-state-danger p-4 text-small text-state-danger` 배너.
- 빈 상태: `text-small text-fg-secondary py-12 text-center` 「등록된 계정이 없습니다」.
- KPI 카드는 이번 슬라이스 밖 (다음 슬라이스에서).

#### 5. `routes/admin/CreateUserDialog.tsx`

- 폼 라벨 · 인풋 · 에러 · 도움말 UI_SYSTEM §4.7 값 그대로.
- 인풋 위 라벨: `text-small text-fg-secondary mb-1 block`.
- 인풋: `w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong`.
- 필드 간격: `space-y-4`.
- 하단 버튼: Secondary 「취소」 + Primary 「저장」. `justify-end gap-3`.
- 서버 에러 표시: 하단 버튼 위에 배너 (`border border-state-danger p-3 text-small text-state-danger`).

#### 6. `routes/admin/DeleteUserDialog.tsx`

- 상단 경고: `text-body text-fg-primary` 「이 작업은 되돌릴 수 없습니다.」
- 대상 표시: `text-small text-fg-secondary` 라벨 + `text-body text-fg-primary font-mono` 이메일.
- 확인 입력: 「삭제하려면 대상 이메일을 다시 입력하세요」 (`text-small`), 인풋 UI_SYSTEM §4.7 값.
- 하단 버튼: Secondary 「취소」 + Danger Primary 「삭제」. Primary 는 이메일 재입력 완료 전까지 disabled.
- 서버 에러 배너 같은 값.

### 완료 확인 방법

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 기존 테스트 유지 (마크업 변경으로 조정 필요하면 이유 커밋 메시지에 명시). 총 111 → 유사 규모 유지.
5. dev 서버로 로컬 눈 확인 목록:
   - 라이트 모드에서 계정 표 · 다이얼로그가 UI_SYSTEM 톤 (샤프 코너 · 검정/흰색 · 얇은 회색 라인)
   - 다크 모드 토글 시 표 · 다이얼로그 · 버튼 모두 다크 팔레트로 자연 전환
   - 「+ 계정 추가」 클릭 → 다이얼로그 열림 → 저장 흐름 정상
   - 각 행 「삭제」 클릭 → 다이얼로그 → 이메일 재입력 → 삭제 흐름 정상
   - 자기 행 「삭제」 는 disabled
   - 폼 인풋 포커스 시 검정 링 (라이트) / 흰색 링 (다크)
6. 프로덕션 번들 grep — emulator 코드 계속 0 건 유지.

### 판정 불가로 두는 것

- **실 계정 조작** — 사용자 콘솔 조치 후 실측.
- **KPI 카드 신설** — 다음 슬라이스 (v0.3).
- **표 페이지네이션 · 정렬** — 다음 슬라이스.

### 커밋 규칙

**3~5 커밋 분리**:
1. `refactor(web): Button variants 를 UI_SYSTEM 값으로 재정의`
2. `refactor(web): Table/Dialog primitives 를 UI_SYSTEM 값으로`
3. `refactor(web): AccountsTable UI_SYSTEM 재스타일 (표 · 상단 액션 · 상태)`
4. `refactor(web): Create/DeleteUserDialog UI_SYSTEM 재스타일 (폼 · 액션 · 에러)`

각 커밋 conventional commits. `git add -A` 금지, 파일 명시.

**작업 브랜치 원격 push 필수** — `git push -u origin feat/ui-accounts-v2`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함:
- 원격 브랜치 이름
- 마지막 커밋 해시
- `git status`
- 완료 확인 각 항목 결과
- 오더 대비 차이

push 없이 보고 시 재작업.
