# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **자동 생성 skip 처리 v0.50** — AutoCreateGroupsDialog 가 「이미 존재」 를 실패 아닌 skipped 로 분류. 결과 요약에 3 카운트 (성공·중복 skip·실패).

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/auto-create-skip-v50`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `cffb077` (basic_data 부서 확장 v0.49)

## 지금 할 것 — AutoCreateGroupsDialog skip 카테고리

### 왜

v0.48 로 그룹 자동 생성 완비 — 재실행 시 이미 만든 그룹은 「실패」 목록에 원문 오류 (「Entity already exists」 등) 로 표시. 이건 정상 상태 (그룹 이미 있음) 이지 실패 아님. UX 폴리시: 3 카테고리로 분리:
- 성공 (state-success 초록)
- 중복 skip (state-warning 노랑)
- 실패 (state-danger 빨강)

**하지 않는 것**: 백엔드에서 skip 감지 (v0.51+ 후보 — 지금 클라이언트만 heuristic). 재시도 자동 (skip 이면 이미 성공한 것으로 간주). 사용자 정의 템플릿 (별도 slice).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/AutoCreateGroupsDialog.tsx` — 반복 로직에 skip 감지 + done phase 3 카운트
- `packages/web/tests/AutoCreateGroupsDialog.test.tsx` — 시나리오 1 (skip 감지)

**손대지 마라**:
- 백엔드 · shared · Firestore.
- callGroupsCreate 자체.
- BasicDataPanel · 다른 다이얼로그.

### 세부 요구

#### 1. skip 감지 헬퍼

`AutoCreateGroupsDialog.tsx` 안 inline:
```ts
function isAlreadyExistsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already exists') ||
    lower.includes('entityalreadyexists') ||
    lower.includes('duplicate') ||
    lower.includes('http_409')
  );
}
```

**주의**:
- Google Directory API 는 409 Conflict + body 에 `entityAlreadyExists` 반환.
- 백엔드 `groups/create.ts` (`packages/functions/src/callable/groups/create.ts`) 는 이 오류를 `HttpsError('unknown', (err as Error).message)` 로 래핑.
- 클라이언트 `callGroupsCreate` 는 `error.message` 를 그대로 전달 → heuristic match 가능.
- False positive 위험 최소 — 「already exists」 같은 phrase 가 다른 실패에 나올 가능성은 낮음.

#### 2. state 변경

기존:
```ts
const [failures, setFailures] = useState<{ email: string; message: string }[]>([]);
```

변경:
```ts
type ResultKind = 'ok' | 'skipped' | 'failed';
type Result = { email: string; kind: ResultKind; message?: string };
const [results, setResults] = useState<Result[]>([]);
```

**주의**: 기존 이름 `failures` 는 제거 — 대체 `results`.

#### 3. iteration 변경

```ts
const handleConfirm = async () => {
  setPhase('running');
  const localResults: Result[] = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      await callGroupsCreate({
        email: t.email,
        name: t.name,
        description: t.description,
      });
      localResults.push({ email: t.email, kind: 'ok' });
    } catch (e) {
      const message = (e as Error).message;
      if (isAlreadyExistsError(message)) {
        localResults.push({ email: t.email, kind: 'skipped', message });
      } else {
        localResults.push({ email: t.email, kind: 'failed', message });
      }
    }
    setProgress(i + 1);
  }
  setResults(localResults);
  setPhase('done');
  queryClient?.invalidateQueries({ queryKey: ['groups', 'list'] });
};
```

#### 4. done phase UI 변경

```tsx
{phase === 'done' && (
  <>
    <DialogHeader className="sr-only">
      <DialogTitle>그룹 자동 생성 완료</DialogTitle>
      <DialogDescription>그룹 자동 생성 작업이 완료되었습니다.</DialogDescription>
    </DialogHeader>
    <div data-testid="auto-create-groups-done" className="space-y-3">
      {(() => {
        const okCount = results.filter((r) => r.kind === 'ok').length;
        const skippedCount = results.filter((r) => r.kind === 'skipped').length;
        const failedCount = results.filter((r) => r.kind === 'failed').length;
        return (
          <p className="text-body text-fg-primary">
            완료:{' '}
            <strong className="text-state-success font-mono">{okCount}</strong>개 성공
            {skippedCount > 0 && (
              <>
                {' '}
                · <strong className="text-state-warning font-mono">{skippedCount}</strong>개 이미 존재 (skip)
              </>
            )}
            {failedCount > 0 && (
              <>
                {' '}
                · <strong className="text-state-danger font-mono">{failedCount}</strong>개 실패
              </>
            )}
          </p>
        );
      })()}
      {results.some((r) => r.kind === 'skipped') && (
        <ul
          className="text-small text-state-warning space-y-1 max-h-40 overflow-y-auto"
          data-testid="auto-create-groups-skipped"
        >
          {results
            .filter((r) => r.kind === 'skipped')
            .map((r) => (
              <li key={r.email}>
                <span className="font-mono">{r.email}</span>: 이미 존재
              </li>
            ))}
        </ul>
      )}
      {results.some((r) => r.kind === 'failed') && (
        <ul
          className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
          data-testid="auto-create-groups-failures"
        >
          {results
            .filter((r) => r.kind === 'failed')
            .map((r) => (
              <li key={r.email}>
                <span className="font-mono">{r.email}</span>: {r.message}
              </li>
            ))}
        </ul>
      )}
      <DialogFooter>
        <Button
          onClick={() => {
            onOpenChange(false);
            onDone?.();
          }}
        >
          확인
        </Button>
      </DialogFooter>
    </div>
  </>
)}
```

**주의**:
- 기존 `auto-create-groups-failures` testid 유지 (다른 실패만).
- 신규 `auto-create-groups-skipped` testid.
- skip 목록은 그룹 이메일 + 「이미 존재」 라벨 (원본 메시지는 hover title 로 넣을 수도 있지만 이번은 생략).

#### 5. 초기화 useEffect

기존 `setFailures([])` → `setResults([])`.

#### 6. 테스트

**web `AutoCreateGroupsDialog.test.tsx`** (1 신규 시나리오):
- mock callGroupsCreate: targets 3 개 중 1 개 성공, 1 개 「Entity already exists」 reject, 1 개 「network error」 reject → done phase 카운트: `okCount=1`, `skippedCount=1`, `failedCount=1`.
- `auto-create-groups-skipped` 렌더 (1 개).
- `auto-create-groups-failures` 렌더 (1 개, 이미 존재 아님).

기존 시나리오 회귀 유지 — 특히 「모두 성공」 · 「모두 실패 (skip 아님)」.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 548 + 신규 1 = 549 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 자동 생성 재실행 시 skip 카운트 (노랑) 표시
   - 실 실패는 별도 목록
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **서버 사이드 skip 감지** — 별도 slice (백엔드에서 409 를 별도 상태로 반환하는 스키마 변경 필요).
- **skip 이라도 재시도 옵션** — 별도 slice.
- **오탐지 (「already exists」 가 다른 오류에 포함)** — 실 프로덕션 모니터링 후 조정.

### 커밋 규칙

**1 커밋**:
- `feat(web): AutoCreateGroupsDialog 「이미 존재」 skip 카테고리 분리`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/auto-create-skip-v50`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
