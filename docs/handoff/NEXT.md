# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **basic_data 프론트엔드 조회 v0.46** — admin 페이지 「기초값 관리」 placeholder 를 실 컴포넌트로 교체. useBasicDataGet hook + BasicDataPanel (read-only). 편집은 별도 slice.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-panel-v46`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `43de168` (basic_data 백엔드 v0.45)

## 지금 할 것 — BasicDataPanel (read-only)

### 왜

v0.45 로 백엔드 `basicData.get`·`basicData.set` 배포 완료. admin 페이지의 「기초값 관리」 자리 (`packages/web/src/routes/admin/index.tsx:29-33`) 는 현재 placeholder text 만. 실 데이터 조회 UI 로 교체 (편집은 v0.47 후보).

**하지 않는 것**: 편집 form (v0.47). 연도 선택기 (드롭다운·과거 연도 목록) — 이번은 현재 연도 (`new Date().getFullYear()`) 기본. 다이얼로그. 새 라우트.

### 이 과제가 바꿀 경로

**신규 파일**:
- `packages/web/src/api/basicDataGet.ts` — fetch + useQuery hook
- `packages/web/src/routes/admin/BasicDataPanel.tsx` — read-only 표시 컴포넌트
- `packages/web/tests/basicDataGet.test.ts` — API 시나리오 2
- `packages/web/tests/BasicDataPanel.test.tsx` — UI 시나리오 4

**수정 대상**:
- `packages/web/src/routes/admin/index.tsx` — 「기초값 관리」 placeholder 를 `<BasicDataPanel />` 로 교체

**손대지 마라**:
- 백엔드 · shared · middleware — 그대로.
- basicData.set (v0.47 슬라이스).
- 다른 라우트 · 컴포넌트.

### 세부 요구

#### 1. `basicDataGet.ts` — fetch + hook

기존 pattern (예: `packages/web/src/api/groupsList.ts`) 참고.

```ts
import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { BasicDataYear } from '@school-app/shared';

export interface BasicDataGetResponse {
  data: BasicDataYear | null;
}

export async function callBasicDataGet(year: number): Promise<BasicDataGetResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/basicDataGet`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/basicDataGet`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,   // 사용 안 함, 관행 유지
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { year, _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as BasicDataGetResponse;
}

export function useBasicDataGet(year: number, enabled = true) {
  return useQuery<BasicDataGetResponse, Error>({
    queryKey: ['basic_data', 'get', year],
    queryFn: () => callBasicDataGet(year),
    enabled,
    staleTime: 60_000,
    // 4xx 는 재시도 안 함 (denied audit 중복 방지).
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
```

**주의**:
- `admin.directory.*` 스코프 헤더 (`X-Google-Scopes`) 없음 — 백엔드가 요구 안 함.
- Google API 무관하지만 `X-Google-Access-Token` 헤더 관행 유지 (다른 callable 과 통일).

#### 2. `BasicDataPanel.tsx` — read-only 표시

```tsx
import { useBasicDataGet } from '../../api/basicDataGet';

export function BasicDataPanel() {
  const currentYear = new Date().getFullYear();
  const { data, isLoading, isError, error } = useBasicDataGet(currentYear);

  return (
    <section className="bg-elevated p-8 border border-border-subtle space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-h2 font-semibold text-fg-primary">기초값 관리</h2>
          <p className="text-small text-fg-secondary mt-1">
            연도별 학년·반 구조. 그룹·클래스룸 생성 시 참조됩니다.
          </p>
        </div>
        <div className="text-small text-fg-secondary">
          연도: <strong className="font-mono text-fg-primary">{currentYear}</strong>
        </div>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="basic-data-loading">
          불러오는 중...
        </div>
      )}

      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="basic-data-error">
          기초값을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}

      {!isLoading && !isError && !data?.data && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="basic-data-empty">
          {currentYear}년 기초값이 아직 설정되지 않았습니다.
        </div>
      )}

      {data?.data && (
        <div className="space-y-3" data-testid="basic-data-content">
          {data.data.grades.map((g) => (
            <div key={g.grade} className="flex items-baseline gap-4">
              <div className="text-body font-semibold text-fg-primary w-16">
                {g.grade}학년
              </div>
              <div className="flex flex-wrap gap-2">
                {g.classes.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-1 border border-border-subtle bg-canvas text-small font-mono text-fg-primary"
                    data-testid={`basic-data-class-${g.grade}-${c}`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {data.data.updatedAt && (
            <p className="text-micro text-fg-muted pt-2 border-t border-border-subtle">
              최근 수정: {new Date(data.data.updatedAt).toLocaleString('ko-KR')}
              {data.data.updatedBy && <> · <span className="font-mono">{data.data.updatedBy}</span></>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
```

**주의**:
- `updatedAt` 은 ms since epoch. 백엔드 `get` callable 이 이미 ms 변환 반환 (`packages/functions/src/callable/basicData/get.ts` 확인).
- 편집 버튼 없음 (v0.47 후보).

#### 3. `admin/index.tsx` — placeholder 교체

기존:
```tsx
<section className="bg-elevated p-8 border border-border-subtle space-y-2">
  <h2 className="text-h3 font-semibold text-fg-primary">기초값 관리</h2>
  <p className="text-small text-fg-secondary">
    기초값 관리 자리 (학년·반·부서 구조 정의 및 시트 동기화)
  </p>
</section>
```

**변경**:
```tsx
<BasicDataPanel />
```

파일 상단에 import 추가:
```tsx
import { BasicDataPanel } from './BasicDataPanel';
```

**주의**:
- 「기초값 관리」 자리는 grid 안에 있음 (`grid-cols-1 md:grid-cols-2`) — 옆에 있는 「계정·그룹·챗·클래스룸 대시보드」 placeholder 는 그대로 유지 (별도 slice).
- 새 BasicDataPanel 은 grid 셀 크기에 맞도록 자연 flow — 확장성 확인 후 grid 유지.

#### 4. 테스트

**web `basicDataGet.test.ts`** (2 신규):
1. 200 응답 (data null) → hook `data = { data: null }`.
2. 200 응답 (data 존재) → `data.data = { year, grades: [...] }`.

**web `BasicDataPanel.test.tsx`** (4 신규):
1. 로딩 → `basic-data-loading` 렌더.
2. 오류 → `basic-data-error` 렌더.
3. data null → `basic-data-empty` 렌더 (「N년 기초값이 아직 설정되지 않았습니다」).
4. data 존재 → `basic-data-content` 렌더 + 각 학년/반 badge (`basic-data-class-1-A` 등).

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 522 + 신규 6 = 528 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin` 하단 grid 좌측에 「기초값 관리」 카드 (v0.46 신규)
   - 데이터 없는 상태 → 「{연도}년 기초값이 아직 설정되지 않았습니다」
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **편집 UI** — v0.47 후보 (EditBasicDataDialog).
- **연도 선택기** — 별도 slice (드롭다운 · 과거 연도 히스토리).
- **부서** — 스키마 확장 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `feat(web): basicDataGet API + useBasicDataGet hook`
2. `feat(web): BasicDataPanel + admin 페이지 「기초값 관리」 placeholder 교체`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-panel-v46`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
