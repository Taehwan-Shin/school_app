# UI_SYSTEM v1.0 (Designer)

> **봉인**: 2026-08-31, 사용자 승인 (Buzz DM `d44e17f244bf`) — 컬러/타이포 그대로 · 사이드바 아이콘 없음 · Pretendard 폰트 확정.
> **소유**: Designer (헤드가 UI 슬라이스에서 쓰는 페르소나 — `AGENTS.md` §2)
> **범위**: 이 문서는 컬러·타이포·간격·컴포넌트·상태·반응형·접근성·다크모드의 **값**을 정의한다. Antigravity 는 이 값들을 그대로 코드에 옮긴다. 값이 아닌 것 (「부드러운 회색」, 「크게」) 은 여기에 존재하지 않는다.

---

## 0. 참고 자료

사용자 회신 (Buzz DM `af7dee3d5dc4`, 2026-08-31): **`https://masstige.io/index.html`** 톤이 좋다.

masstige.io 특성:
- 미니멀 모노크롬 (검정 텍스트 · 흰색 배경 · 회색 강조), 컬러 그래픽 거의 없음
- 볼드 산세리프 헤드라인, 큰 숫자로 핵심 수치 강조 (예: "97", "428", "5,000+")
- 마케팅 랜딩 구조 (톱 네비 · 히어로 · 다단 서비스 · 사례/통계 · CTA)
- 「→」 화살표 텍스트 링크, 카드/섹션 여백 중심
- B2B SaaS 프로페셔널 · 신뢰도 중심 · 투명성 (실측 수치 공개)

**어드민 대시보드로의 번역 원칙** — 마케팅 랜딩의 「감각」 (모노크롬 · 볼드 · 여백 · 「→」) 을 유지하되, 데이터 밀도가 높은 관리 화면의 형태 (사이드바 · 상단바 · 표 · 카드 KPI) 로 옮긴다.

---

## 1. 컬러 시스템

### 라이트 (기본)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg-canvas` | `#FFFFFF` | 페이지 배경 |
| `--bg-surface` | `#FAFAFA` | 카드·사이드바 배경 |
| `--bg-elevated` | `#FFFFFF` | 다이얼로그·팝오버 |
| `--fg-primary` | `#0A0A0A` | 본문·헤드라인 |
| `--fg-secondary` | `#525252` | 서브텍스트·설명 |
| `--fg-muted` | `#A3A3A3` | 라벨·비활성 |
| `--border-subtle` | `#E5E5E5` | 카드·표 테두리 |
| `--border-strong` | `#0A0A0A` | 포커스 링·강조 테두리 |
| `--accent-primary` | `#0A0A0A` | 주 버튼 배경 (검정) |
| `--accent-on-primary` | `#FFFFFF` | 주 버튼 텍스트 |
| `--state-danger` | `#DC2626` | 삭제·오류 |
| `--state-success` | `#16A34A` | 성공·완료 |
| `--state-warning` | `#CA8A04` | 경고 |

### 다크
| 토큰 | 값 |
|---|---|
| `--bg-canvas` | `#0A0A0A` |
| `--bg-surface` | `#171717` |
| `--bg-elevated` | `#262626` |
| `--fg-primary` | `#FAFAFA` |
| `--fg-secondary` | `#A3A3A3` |
| `--fg-muted` | `#737373` |
| `--border-subtle` | `#262626` |
| `--border-strong` | `#FAFAFA` |
| `--accent-primary` | `#FAFAFA` |
| `--accent-on-primary` | `#0A0A0A` |
| `--state-danger` | `#EF4444` |
| `--state-success` | `#22C55E` |
| `--state-warning` | `#EAB308` |

**구현** — Tailwind config 의 `theme.extend.colors` + CSS custom properties. 다크 모드는 `class` 전략 (`html.dark`), OS 감지 + 사용자 토글.

## 2. 타이포그래피

| 토큰 | 값 | 용도 |
|---|---|---|
| `--font-sans` | `"Pretendard Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | 본문·헤드라인 (한국어 자연스러움 우선) |
| `--font-mono` | `"JetBrains Mono", "Menlo", monospace` | 코드·해시·이메일 |

### 스케일
| 클래스 | 크기 / 행간 / weight | 용도 |
|---|---|---|
| `text-display` | `48px / 56px / 700` | 히어로 KPI 숫자 (「사용자 428명」) |
| `text-h1` | `32px / 40px / 700` | 페이지 제목 |
| `text-h2` | `24px / 32px / 600` | 섹션 제목 |
| `text-h3` | `18px / 28px / 600` | 카드 제목 |
| `text-body` | `15px / 24px / 400` | 본문 |
| `text-small` | `13px / 20px / 400` | 표 · 라벨 · 설명 |
| `text-micro` | `11px / 16px / 500 uppercase tracking-wide` | 카테고리 라벨 · 상태 뱃지 |

**원칙** — 「크게」 · 「작게」 없음. 위 7 개 스케일 안에서만 결정. 이탤릭 금지 (모노크롬 미학).

## 3. 간격 · 그리드

**8pt 시스템**. Tailwind 기본 스케일 사용 (`p-1` = 4px, `p-2` = 8px, `p-4` = 16px, ...).

| 자리 | 값 |
|---|---|
| 페이지 좌우 여백 | `px-6 md:px-8 lg:px-12` |
| 섹션 세로 간격 | `space-y-8` (섹션 간), `space-y-4` (섹션 안 요소 간) |
| 카드 padding | `p-6 md:p-8` |
| 표 셀 padding | `px-4 py-3` |
| 버튼 padding | `px-4 py-2` (기본), `px-6 py-3` (프로머넌트) |
| 폼 요소 간격 | `space-y-4` |

**그리드** — 콘텐츠 최대 너비 `max-w-7xl`. 사이드바 240px 고정.

## 4. 레이아웃 · 컴포넌트

### 4.1 앱 셸 (Shell)

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (240px)  │  Topbar (56px)                  │
│                   ├─────────────────────────────────┤
│  · 로고 (텍스트)  │                                  │
│  · 나비 항목들     │  Main content                    │
│  · 나비 항목들     │  (max-w-7xl, px-8, py-8)        │
│                   │                                  │
│  ─────────────    │                                  │
│  · 하단 사용자     │                                  │
│    (이메일·역할)   │                                  │
└─────────────────────────────────────────────────────┘
```

- **Sidebar**: `bg-surface`, `border-r border-subtle`, 좌측 고정 240px. 모바일 (< md) 에서는 상단 햄버거로 접힘.
- **Topbar**: 56px 높이, `border-b border-subtle`. 좌측: 현재 페이지 제목 (`text-h3`). 우측: 알림 아이콘 · 사용자 아바타 (역할 뱃지) · 다크 모드 토글.
- **Main**: `bg-canvas`, `p-6 md:p-8 lg:p-12`, `max-w-7xl mx-auto`.

### 4.2 사이드바 나비 항목

역할별 표시:
- **super_admin**: 대시보드 · 계정 · 그룹 · 챗방 · 클래스룸 · 감사 로그 · 시스템 설정
- **admin**: 대시보드 · 계정 · 그룹 · 챗방 · 클래스룸
- **teacher**: 대시보드 · 내 클래스룸

각 항목:
- `px-4 py-2`, `text-body`, `text-fg-secondary`
- Hover: `bg-elevated`, `text-fg-primary`
- Active: `bg-elevated`, `text-fg-primary`, `border-l-2 border-strong`
- 아이콘 없음 (미니멀 톤 유지). 필요하면 lucide-react 얇은 선 아이콘.

### 4.3 KPI 카드

```
┌──────────────────────┐
│ 총 사용자             │  ← text-micro
│                       │
│ 428                   │  ← text-display, font-mono
│                       │
│ 지난 주 대비 +12 →    │  ← text-small, text-fg-secondary
└──────────────────────┘
```

- `bg-surface`, `border border-subtle`, `rounded-none` (샤프 코너), `p-8`
- 코너 라운드 없음 (샤프 · 프로페셔널)
- KPI 숫자는 `font-mono` 로 자릿수 정렬

### 4.4 표 (Table)

- `border border-subtle`, `rounded-none`
- 헤더: `bg-surface`, `text-micro text-fg-secondary`, `px-4 py-3 border-b border-subtle`
- 행: `border-b border-subtle`, `hover:bg-surface`
- 셀: `px-4 py-3`, `text-small`
- 액션 열: 오른쪽 정렬, 「편집 →」 · 「삭제」 텍스트 링크

### 4.5 버튼

세 종류만:
- **Primary** — `bg-accent-primary text-accent-on-primary px-6 py-3 text-body font-medium`. 페이지당 최대 1 개.
- **Secondary** — `border border-subtle text-fg-primary px-4 py-2 text-body`. 여러 개 가능.
- **Link** — `text-fg-primary underline decoration-fg-muted hover:decoration-fg-primary`, 종종 「→」 화살표. 인라인 액션.

Danger 액션 (삭제): Primary 스타일 + `bg-state-danger text-white`. 다이얼로그 확인 필수.

### 4.6 다이얼로그

- `bg-elevated`, `border border-subtle`, `rounded-none`, `p-8`, `max-w-md`
- 배경 오버레이: `bg-black/40`
- 제목: `text-h2`
- 하단 버튼: 오른쪽 정렬, Secondary (「취소」) + Primary (「저장」·「삭제」)

### 4.7 폼 · 인풋

- 라벨: `text-small text-fg-secondary mb-1 block`
- 인풋: `border border-subtle bg-canvas px-3 py-2 text-body focus:outline-none focus:border-strong focus:ring-1 focus:ring-strong`
- 에러: `text-small text-state-danger mt-1`
- 도움말: `text-small text-fg-muted mt-1`

## 5. 상태 · 상호작용

| 상태 | 시각 |
|---|---|
| Hover (링크·버튼) | 배경 `bg-elevated` 또는 밑줄 강조 |
| Focus (키보드) | `outline-none focus:ring-2 ring-strong ring-offset-2` — 접근성 필수 |
| Disabled | `opacity-40 cursor-not-allowed` |
| Loading (버튼) | 텍스트 유지 + 우측 스피너 (`animate-spin`, 16px, `border-fg-primary`) |
| Empty state (표·카드) | 중앙 정렬, `text-fg-muted`, 아이콘 없음, 한 줄 안내 + 「→」 액션 |

## 6. 반응형 breakpoint

Tailwind 기본:
- `sm` 640px — 모바일 랜드
- `md` 768px — 태블릿
- `lg` 1024px — 데스크톱 (사이드바 펼침 기본)
- `xl` 1280px — 넓은 데스크톱

**규칙**:
- `< md` — 사이드바 접힘 (상단 햄버거 · 드로어), 카드 1 열
- `md` — 카드 2 열
- `lg+` — 사이드바 펼침 (240px 고정), 카드 3~4 열

## 7. 접근성 (WCAG AA 최소)

- 텍스트 대비 4.5:1 (본문), 3:1 (large text ≥ 18px bold)
- 모든 인터랙티브 요소에 키보드 포커스 링 (`focus-visible:ring-2`)
- 색만으로 정보 전달 금지 (에러는 색 + 아이콘 또는 텍스트)
- `<button>` · `<a>` · `<label>` 시맨틱 정확히
- 다이얼로그는 focus trap + Escape 닫기 + 배경 스크롤 잠금 (Radix Dialog 기본 제공)
- 표 헤더 `<th scope="col">`

## 8. 다크 모드 전략

- `html.dark` 클래스로 토글 (Tailwind `darkMode: 'class'`)
- 초기 로드: OS 감지 (`prefers-color-scheme`) → 사용자 토글은 localStorage 에 저장
- 토글 위치: 상단바 우측
- 아이콘: 해 / 달 (lucide-react)

## 9. 이번 v0.1 슬라이스 범위 (첫 재구성)

**포함**:
1. Tailwind config 컬러·폰트 확장 (§1 · §2 토큰)
2. `AppShell` 컴포넌트 (Sidebar + Topbar + Main) — §4.1
3. 사이드바 나비 항목 (역할별) — §4.2
4. `login.tsx` 재구성 — 미니멀 카드 (`p-8`, 샤프 코너), 「구글로 로그인 →」 스타일
5. `/teacher`, `/admin`, `/super_admin` 을 AppShell 안에 넣기 (기존 내용 유지)
6. 다크 모드 토글 (§8)

**제외 (다음 슬라이스)**:
- KPI 카드 데이터 연결 (§4.3) — 데이터 없음, 껍데기만
- 그룹 · 챗방 · 클래스룸 · 감사 로그 화면 (아직 코드 없음)
- 반응형 세부 조정 (일단 데스크톱 기준, 모바일은 다음)

**완료 확인**:
- `/login` 화면이 미니멀 카드 · 검정 버튼 · 「→」 어포던스로 렌더링
- 로그인 후 사이드바 + 상단바 + 메인 3 영역이 뜨고 역할별 나비 표시
- 사이드바 나비 항목 클릭 시 라우팅 정상
- 다크 모드 토글 작동
- 브라우저 창 폭 < md 에서 사이드바 햄버거로 접힘

## 10. 미결정 · 다음 결정

- **로고** — 아직 없음. v0.1 은 텍스트 "학교" 로 대체. 사용자 로고 자료 오면 반영.
- **폰트 라이선스** — Pretendard Variable 오픈 라이선스 확인. 못 쓰면 시스템 폰트 폴백.
- **알림 인프라** — Topbar 알림 아이콘은 v0.1 에서 껍데기 (「0 개」). 실 알림 시스템은 별도 슬라이스.
- **아이콘 세트** — lucide-react 필요한 곳만 (사이드바는 무 아이콘 유지). Antigravity 가 판단.
