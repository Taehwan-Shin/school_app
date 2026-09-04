# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **listYears 캐시 무효화 v0.55** — basicDataSet 성공 시 listYears query 도 무효화. 신규 연도 저장 시 dropdown 즉시 반영.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin feat/basic-data-set-invalidate-v55`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `362b2e2` (basicData.listYears + dropdown v0.54)

## 지금 할 것 — listYears 캐시 무효화

### 왜

v0.54 로 dropdown 배포. 그러나 admin 이 신규 연도 저장 (예: 2027 추가) 시 dropdown 이 60 초 staleTime 지날 때까지 안 갱신 → 「저장했는데 안 보임」 UX 이슈. `useBasicDataSet` 의 onSuccess 에 `['basic_data', 'list_years']` invalidation 추가.

**하지 않는 것**: 삭제 후 무효화 (아직 삭제 callable 없음). 다른 캐시 무효화 (get 은 이미 있음).

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/api/basicDataSet.ts` — onSuccess 에 `['basic_data', 'list_years']` 무효화 추가
- `packages/web/tests/basicDataSet.test.ts` — 시나리오 1 (invalidation)

**손대지 마라**:
- 백엔드 · shared · Firestore.
- 다른 hook.

### 세부 요구

#### 1. `basicDataSet.ts` — onSuccess 확장

기존 (`packages/web/src/api/basicDataSet.ts:60-62`):
```ts
onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: ['basic_data', 'get', variables.year] });
},
```

변경:
```ts
onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: ['basic_data', 'get', variables.year] });
  queryClient.invalidateQueries({ queryKey: ['basic_data', 'list_years'] });
},
```

**주의**:
- 두 개 별개 무효화 — react-query 는 prefix 매칭 안 함.
- 만약 통합하려면 `queryKey: ['basic_data']` 로 상위 무효화 가능 (모든 하위 재검증). 하지만 명시적으로 두 키 무효화가 낫다 (get, list_years 만 관심).

#### 2. 테스트

**web `basicDataSet.test.ts`** (1 신규):
- mock `useMutation` + `useQueryClient` 확인.
- `callBasicDataSet` mock 성공 → `queryClient.invalidateQueries` 가 **두 번** 호출됨:
  - `{ queryKey: ['basic_data', 'get', <year>] }`
  - `{ queryKey: ['basic_data', 'list_years'] }`

기존 시나리오 회귀 유지.

### 완료 확인

1. `pnpm install` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 567 + 신규 1 = 568 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - 저장 안 된 신규 연도로 이동 → 편집 → 저장 → dropdown 에 즉시 나타남
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **삭제 후 무효화** — 아직 delete callable 없음.
- **staleTime 조정** — 유지 (60s 는 다른 필터에도 영향).

### 커밋 규칙

**1 커밋**:
- `feat(web): basicDataSet 성공 시 listYears 캐시 무효화`

conventional commit. `git add -A` 금지.

**작업 브랜치** — `git push -u origin feat/basic-data-set-invalidate-v55`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
