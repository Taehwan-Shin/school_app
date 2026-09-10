# UI_SYSTEM v2.0 (Say Briefly · Designer)

> **재봉인**: 2026-09-10, 사용자 요청 (channel event `b1119960a301da63…`) — Say Briefly moodboard 로 시각 언어 전환.
> **이전 봉인 (v1.0, 2026-08-31 masstige.io 모노크롬)** 은 폐기. 이 문서가 유일한 원본.
> **소유**: Designer (헤드가 UI 슬라이스에서 쓰는 페르소나 — `AGENTS.md` §2)
> **범위**: 컬러·타이포·간격·컴포넌트·상태·반응형·접근성·다크모드의 값을 정의. Antigravity 는 이 값들을 그대로 코드에 옮긴다.

---

## 0. 참고 자료

- 사용자 첨부 UI 구조 참고 이미지 (channel event `b1119960a301da63…`) — 좌측 사이드바 + 상단 바 + KPI 로우 + 차트 + 데이터 테이블 그리드.
- Say Briefly moodboard: creative agency sketchbook on cream paper. 웜 크림 페이퍼 · 딥 포레스트 그린 (구조) · 하이라이트 옐로 (마커) · 스티키 노트 파스텔 (장식).
- 유사 브랜드: Notion · Linear · Framer · Pitch.

---

## 1. 컬러 시스템

### 원시 팔레트 (Say Briefly)

| 이름 | 값 | 토큰 | 역할 |
|---|---|---|---|
| Forest Ink | `#1a3300` | `--color-forest-ink` | primary text · filled CTA · link · nav border · 구조 백본 (90%) |
| Highlighter Yellow | `#ffe95c` | `--color-highlighter-yellow` | headline 특정 단어의 marker wash · badge · accent fill. **CTA 로 절대 사용 금지** |
| Cream Paper | `#fcfaf5` | `--color-cream-paper` | 페이지 canvas · card 표면 · nav 배경. 살짝 노란 오프화이트 |
| Pencil Gray | `#b6b6b6` | `--color-pencil-gray` | nav · divider border. **텍스트 금지** (대비 미달) |
| Whisper Gray | `#f1f1f1` | `--color-whisper-gray` | 극히 사라지는 헬퍼 (아이콘 배경 등). **텍스트 금지** |
| Sticky Note Teal | `#a8e5e5` | `--color-sticky-note-teal` | 장식 카드 배경 (드물게) |
| Sticky Note Mint | `#d5f5c2` | `--color-sticky-note-mint` | 장식 카드 배경 |
| Sticky Note Blush | `#f6d0ff` | `--color-sticky-note-blush` | 장식 카드 배경 |
| Terracotta | `#cb5521` | `--color-terracotta` | 장식 대비색. **텍스트 금지** (`#cb5521` on cream ≈ 4.14:1 AA 미달) |

### Semantic 매핑 (라이트, WCAG AA 4.5:1 준수)

| 토큰 | 값 | 대비 (on cream) | 용도 |
|---|---|---|---|
| `--bg-canvas` | `#fcfaf5` | — | 페이지 배경 |
| `--bg-surface` | `#fcfaf5` | — | 카드·사이드바 배경 |
| `--bg-elevated` | `#fcfaf5` | — | 강조 카드 (색 fill 로 분리) |
| `--fg-primary` | `#1a3300` (Forest Ink) | ~15:1 ✓ | 기본 텍스트 |
| `--fg-secondary` | `#3d4d24` | ~7.3:1 ✓ | 보조 텍스트 |
| `--fg-muted` | `#5c6b47` | ~4.6:1 ✓ | muted/label 텍스트 (small 포함) |
| `--border-subtle` | `#b6b6b6` (Pencil Gray) | — | hairline border (텍스트 아님) |
| `--border-strong` | `#1a3300` | — | 강조 border |
| `--accent-primary` | `#1a3300` | ~15:1 ✓ (on primary text `#fcfaf5`) | filled CTA 배경 |
| `--accent-on-primary` | `#fcfaf5` | — | primary CTA 위 텍스트 |
| `--state-danger` | `#a83a0e` | ~5.5:1 ✓ | 오류·삭제 텍스트 (Terracotta 를 어둡게) |
| `--state-warning` | `#8a4a00` | ~7:1 ✓ | 경고 텍스트 (짙은 amber) |
| `--state-success` | `#1a3300` | ~15:1 ✓ | 성공 텍스트 (forest ink) |

### 다크 (기존 명도 반전 유지 — Say Briefly 명세 밖 · 사용자 preference 보존)

| 토큰 | 값 |
|---|---|
| `--bg-canvas` | `#0A0A0A` |
| `--bg-surface` | `#171717` |
| `--bg-elevated` | `#262626` |
| `--fg-primary` | `#FAFAFA` |
| `--fg-secondary` | `#A3A3A3` (~7.85:1) |
| `--fg-muted` | `#9ca3af` (~7.8:1, v0.102c AA 상향) |
| `--border-subtle` | `#262626` |
| `--border-strong` | `#FAFAFA` |
| `--accent-primary` | `#FAFAFA` |
| `--accent-on-primary` | `#0A0A0A` |
| `--state-danger` | `#EF4444` |
| `--state-warning` | `#EAB308` |
| `--state-success` | `#22C55E` |

**Dark 모드에서는 highlighter-yellow 배경 hover 를 사용하지 않는다** — 노란 위 흰 텍스트 저대비가 되므로 dark 에서는 hover:bg-elevated 로 대체.

---

## 2. 타이포그래피

### 폰트 스택

| Family | Weight | 용도 | Fallback |
|---|---|---|---|
| Bricolage Grotesque | 800 | display headline (**40px 이상만**) · 특수 monogram 로고 예외 (`Sidebar` logo 뱃지) | Archivo Black · Inter |
| Inter | 300, 400, 500, 600, 700 | body · nav · button · card · subheading · **40px 미만 모든 UI 텍스트** | Pretendard Variable · system-ui |
| Roboto Mono | 400 | micro-label · tag · 기술 metadata (파일 경로 등) | JetBrains Mono · Menlo |

**규칙**: Bricolage Grotesque 는 40px 이상 headline 전용. 40px 미만은 무조건 Inter. 예외 — Sidebar logo monogram (2~3자) 은 40px 미만이라도 Bricolage 허용 (Say Briefly Logo Mark 명세 참조). 실용 구현 (v0.102b) 은 Inter 800 로 대체 가능.

### 폰트 스케일 (Tailwind 토큰)

| 역할 | 크기 | line-height | letter-spacing | 토큰 |
|---|---|---|---|---|
| micro | 11px | 1.3 | — | `text-micro` |
| caption | 14px | 1.5 | — | `text-caption` |
| body-sm | 16px | 1.5 | — | `text-body-sm` |
| body | 18px | 1.5 | — | `text-body` |
| body-lg | 20px | 1.38 | — | `text-body-lg` |
| subheading | 28px | 1.25 | — | `text-subheading` |
| heading-sm | 40px | 1.1 | — | `text-heading-sm` |
| heading | 55px | 1 | 2.2px | `text-heading` |
| heading-lg | 66px | 1 | 3.3px | `text-heading-lg` |
| display-xl | 90px | 1 | 4.5px | `text-display-xl` |

### 하위 호환 (기존 페이지 코드가 쓰던 이름 — 점진 이관)

| 역할 | 크기 |
|---|---|
| `text-display` | 48px |
| `text-h1` | 32px |
| `text-h2` | 24px |
| `text-h3` | 18px |
| `text-small` | 13px |

---

## 3. 간격 · 모양

- 기본 단위: 8px.
- 스페이싱: 8/16/24/32/40/48/56/64/80/96/120.
- 페이지 max-width: 1200px.
- 섹션 간격: 64px.
- 카드 padding: 24px.
- 요소 gap: 16px.

### Border Radius

| 요소 | 값 | Tailwind |
|---|---|---|
| button | 6px | `rounded-buttons` |
| card | 12px | `rounded-cards` |
| nav container | 16px | `rounded-nav` |
| tag | 9999px | `rounded-tags` |

**규칙**: 「Do not mix 0px sharp corners with rounded system」 — 새 컴포넌트는 위 반경 중 하나를 사용. 기존 `rounded-none` 은 다음 슬라이스에서 순차 대체.

### Shadow (사용 최소화 — 색 fill 과 border 로 분리 우선)

| 이름 | 값 | Tailwind |
|---|---|---|
| subtle | `rgba(0,0,0,0.05) 0 1px 2px 0` | `shadow-subtle` |
| subtle-2 | `rgba(0,0,0,0.1) 0 1px 3px 0, rgba(0,0,0,0.1) 0 1px 2px -1px` | `shadow-subtle-2` |

Primary CTA 만 `shadow-subtle`. 나머지는 원칙적으로 shadow 없음.

---

## 4. 컴포넌트 규칙 (Say Briefly)

### Primary CTA Button
- 배경: `--accent-primary` (`#1a3300`).
- 텍스트: `--accent-on-primary` (`#fcfaf5`).
- Radius: `rounded-buttons` (6px). Padding: `py-2.5 px-4` (compact) 또는 `py-4 px-10` (hero).
- Font: Inter 500, `text-body-sm`.
- Shadow: `shadow-subtle`.
- 앞에 화살표 글리프 `→` 허용.

### Outline Nav Button
- 배경: 투명. Border: 1px `--border-strong`.
- 텍스트: `--fg-primary`. Radius: `rounded-buttons`.

### Highlighted Word (Editorial)
- headline 안 특정 단어에 `highlight-yellow` 유틸리티 (`background-color: #ffe95c; padding: 0 0.15em`). CTA 로 사용 금지.

### Logo Mark
- Sidebar logo: 36-40px 정사각형 Highlighter Yellow 배경 + monogram 2자 Forest Ink.
- 실용 구현: Inter 800 `text-body-sm/body` 로 monogram. Bricolage 예외 허용이나 v0.102b 는 Inter 채택.
- 워드마크: 「학교」 Inter 700 `text-body-lg`~`text-subheading`.

### Sticky Note Card (장식 강조 카드)
- Radius: `rounded-cards` (12px). Padding: 24-28px.
- Fill: sticky-note-mint · sticky-note-blush · sticky-note-teal · sticky-note-yellow 중 하나. 옵션 1px forest-ink border.
- **같은 row 에 두 개 이상 pastel 카드 배치 금지** (cream 여백으로 sticky-note 리듬 유지).

### Top Navigation Bar (참고 이미지 구조)
- 사이드바 flush-left (full-height) + 상단 topbar 는 페이지 title + 우측 액션 (필터·날짜·아바타·로그아웃).
- Say Briefly 명세의 「floating pill nav」 는 마케팅 랜딩용. 어드민 대시보드는 사이드바+topbar 유지.
- Border: 1px `--border-subtle`.

### Reassurance Caption
- Inter 400 `text-caption`, `--fg-muted` (`#5c6b47`).

---

## 5. 반응형

- 사이드바: `md:` 이상 표시, `<md` 는 숨김 + 상단 hamburger (다음 슬라이스).
- Topbar: 항상 flex. 제목은 `truncate min-w-0 flex-1`. 컨트롤은 `shrink-0`.

---

## 6. 접근성 (WCAG AA · 4.5:1)

- 모든 텍스트/UI 는 배경 대비 4.5:1 이상 (small 텍스트).
- Pencil Gray, Whisper Gray, 원시 Terracotta 는 **텍스트 금지** — border/배경 전용.
- 다크 모드에서 highlighter-yellow hover 배경 금지 (텍스트 저대비).
- Focus ring: `focus-visible:ring-2 focus-visible:ring-border-strong`.

---

## 7. Do / Don't

### Do
- Forest Ink 로 primary text·link·CTA 전부.
- Bricolage Grotesque 는 40px 이상만 (monogram 예외).
- Highlighter Yellow 는 marker wash 로만.
- 카드는 rounded-cards, 버튼은 rounded-buttons.
- 색 fill + border 로 계층 분리. shadow 최소.
- Pastel 카드는 항상 cream 여백 사이에.

### Don't
- Bricolage 를 body/nav/button 에 사용 금지 (40px 미만).
- Forest Ink 외 두 번째 primary 색 도입 금지.
- shadow blur 2px 초과 사용 금지.
- 순수 검정 (#000) 텍스트 금지.
- body 문단 640px 초과 중앙정렬 금지.
- Highlighter Yellow 를 CTA 배경으로 사용 금지.
- 같은 row 에 pastel 카드 여러 개 배치 금지.
- Pencil Gray/Whisper Gray/Terracotta 를 텍스트 색으로 사용 금지.

---

## 8. 이관 순서 (v0.102+)

- **v0.102** (완료): 토큰 재매핑 · Google Fonts 로드 · shell 시각 재구성.
- **v0.102b** (완료): UI_SYSTEM 재작성 · WCAG AA 대비 상향 · Topbar 반응형 · Sidebar logo font 규정.
- **다음** (별도 슬라이스):
  - 버튼/카드 radius 전면 6/12px 적용.
  - 페이지별 컴포넌트 (KPI 카드, 표, 다이얼로그) Say Briefly 명세 세부.
  - Super Admin dashboard hero headline (Bricolage + highlight wash).
  - 참고 이미지의 좌측 사이드바 확장 (아이콘·시간·bottom docs/live chat/sign out).
