# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **BasicDataPanel 레이아웃 · 총 학생 수 v0.64** — 헤더 버튼 flex-wrap + 데이터 하단 총계 요약 (총 학년·반·학생·부서 수).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-summary-v64`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `9f4560e` (AutoCreateDepartmentGroups 개수 확인 v0.63)

## 지금 할 것 — 레이아웃 wrap + 총계 요약

### 왜

BasicDataPanel 헤더는 지금 6+ 버튼 (연도 dropdown · input · 그룹 자동 생성 · 부서 그룹 자동 생성 · 학생 명단 편집 · 학생 자동 초대 · 편집 · JSON 내보내기). 좁은 화면 (md) 에서 overflow · 가독성 저하. `flex-wrap` 으로 자연 wrap.

또한 데이터 하단 요약 (총 학년·반·학생·부서 수) — admin 이 한눈에 규모 파악.

**하지 않는 것**: 버튼 dropdown 메뉴 (adds new UI pattern). 아이콘 추가 (별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — 헤더 버튼 컨테이너 `flex-wrap` · 데이터 하단 총계 요약 섹션
- `packages/web/tests/BasicDataPanel.test.tsx` — 시나리오 1 (요약 렌더 · 카운트 확인)

**손대지 마라**:
- 백엔드 · 다이얼로그 · shared.

### 세부 요구

#### 1. 헤더 wrap

기존 (`packages/web/src/routes/admin/BasicDataPanel.tsx:41`):
```tsx
<div className="flex items-center gap-4">
  {/* 연도 dropdown · input · 버튼 6 개 */}
</div>
```

변경 — flex-wrap + gap 좀 줄이기:
```tsx
<div className="flex items-center gap-3 flex-wrap justify-end">
```

- `flex-wrap` 은 좁은 화면에서 자연 줄바꿈.
- `gap-3` (기존 4) — 조금 촘촘하게.
- `justify-end` — 오른쪽 정렬 (헤더 왼쪽 텍스트와 대비).

#### 2. 총계 요약

기존 데이터 렌더 (`packages/web/src/routes/admin/BasicDataPanel.tsx:117-152`) 끝, `updatedAt` 라인 앞에:

```tsx
{data.data && (
  <div className="pt-2 border-t border-border-subtle" data-testid="basic-data-summary">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-small text-fg-secondary">
      <div>
        학년: <strong className="font-mono text-fg-primary">{data.data.grades.length}</strong>
      </div>
      <div>
        반: <strong className="font-mono text-fg-primary">
          {data.data.grades.reduce((sum, g) => sum + g.classes.length, 0)}
        </strong>
      </div>
      <div>
        학생: <strong className="font-mono text-fg-primary">
          {Object.values(data.data.rosters ?? {}).reduce(
            (sum, grade) => sum + Object.values(grade).reduce((s, arr) => s + arr.length, 0),
            0
          )}
        </strong>
      </div>
      <div>
        부서: <strong className="font-mono text-fg-primary">{data.data.departments?.length ?? 0}</strong>
      </div>
    </div>
  </div>
)}
```

**주의**:
- 학생 수는 rosters 안 nested 배열 합산.
- 부서 없으면 0 표시.
- `data-testid="basic-data-summary"` — 테스트에서 조회.

#### 3. 테스트

**web `BasicDataPanel.test.tsx`** (1 신규):
- data 렌더 (grades 2, rosters 8, departments 3) → `basic-data-summary` 안에 정확한 카운트.

기존 회귀 유지 (특히 「기초값 관리」 헤더 · 반 badge · 부서 badge).

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 597 + 신규 1 = 598 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - BasicDataPanel 헤더 좁은 화면에서 버튼 wrap
   - 데이터 하단에 총계 요약 4 항목
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **dropdown 메뉴** — 별도 slice.
- **아이콘** — 별도 slice.

### 커밋 규칙

**1 커밋**:
- `feat(web): BasicDataPanel 헤더 wrap + 데이터 총계 요약 (학년·반·학생·부서)`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-summary-v64`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
