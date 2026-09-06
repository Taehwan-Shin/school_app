# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex 5차 hotfix v0.75** — P13 super_admin 설명 3분기 + P14 summary snapshot 계약 정밀화.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/codex-audit-p13-p14-v75`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 2 개.

## 기준 커밋

**Base**: `9005ecf` (audit summary callable v0.74)

## 지금 할 것 — P13 + P14 hotfix (표시·계약 폴리시)

### 왜

Codex 5차 감사 실패 2건 (모두 데이터 손실 · 권한 문제 아님):

**P13 super_admin 설명 문구 3분기 부재** (`packages/web/src/routes/super_admin/index.tsx:68`):
> loading 또는 error 중에도 todayCount 기본값 0 으로 설명 문구가 「오늘 이벤트가 없습니다」 라고 표시되어 바로 아래 「불러오는 중」/「불러오지 못했습니다」 와 모순된다.

**P14 snapshot 계약 정밀도** (`packages/functions/src/callable/audit/summary.ts:80`):
> client `atMax` 가 과거이면 실제 query 상한은 effectiveAtMax=clientAtMax 인데 응답 line 101 과 audit message line 95 는 현재 시각 `countedAt` 을 snapshot 으로 노출한다. `snapshotAt=effectiveAtMax` 를 반환·기록하거나 `countedAt` 을 `generatedAt` 로 명확히 분리해야 한다.

**해결**:
- P13: description 3분기 (loading · error · success)
- P14: option (b) — 두 필드 분리 `snapshotAt` (query 경계) + `generatedAt` (callable 실행 시각)

### 이 과제가 바꿀 경로

**Commit 1 (P13 UI 3분기)**:
- `packages/web/src/routes/super_admin/index.tsx` — description 문구도 loading · error · success 3분기 조건 렌더링
- `packages/web/tests/SuperAdminPage.test.tsx` — 시나리오 1 (loading 시 「불러오는 중」 · error 시 「불러오지 못했습니다」 표시 확인)

**Commit 2 (P14 snapshot 계약 정밀화)**:
- `packages/functions/src/callable/audit/summary.ts` — response 에 `snapshotAt` + `generatedAt` 분리 · audit message 도 두 값 노출
- `packages/functions/tests/auditLogSummary.test.ts` — 시나리오 2 (client atMax 과거 → snapshotAt=client · generatedAt=Date.now())
- `packages/web/src/api/auditLogSummary.ts` — response type 확장
- `packages/web/src/routes/super_admin/index.tsx` — countedAt 참조 있으면 snapshotAt 로 rename (미사용이면 무시)
- `packages/web/tests/auditLogSummary.test.ts` — response type 확장 반영

**손대지 마라**:
- audit.list · audit.count 는 그대로.
- readAudit · countAuditEntries helper.
- 다른 라우트.

### 세부 요구

#### Commit 1: super_admin 설명 3분기

기존 (`packages/web/src/routes/super_admin/index.tsx:68`):
```tsx
<p className="text-small text-fg-secondary mt-1">
  {todayCount > 0
    ? `오늘 ${todayCount}건의 이벤트가 기록되었습니다.`
    : '오늘 이벤트가 없습니다.'}
</p>
```

변경 — loading · error · success 3분기:
```tsx
<p className="text-small text-fg-secondary mt-1">
  {summaryQuery.isLoading
    ? '불러오는 중...'
    : summaryQuery.isError
    ? '오늘 이벤트를 불러오지 못했습니다.'
    : todayCount > 0
    ? `오늘 ${todayCount}건의 이벤트가 기록되었습니다.`
    : '오늘 이벤트가 없습니다.'}
</p>
```

**주의**:
- 바로 아래 preview 섹션 이 loading/error banner 표시하므로 헤더 문구도 일관되게.
- data-testid 필요 시 (기존 없으면 추가 안 함).

#### Commit 2: snapshotAt · generatedAt 분리

**`audit/summary.ts` 응답 확장**:

기존:
```ts
export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  countedAt: number;
}
```

변경:
```ts
export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  snapshotAt: number;   // query 상한 (effectiveAtMax)
  generatedAt: number;  // callable 실행 시각 (Date.now())
}
```

**로직**:
```ts
const generatedAt = Date.now();
const effectiveAtMax = clientAtMax !== undefined ? Math.min(clientAtMax, generatedAt) : generatedAt;
const snapshotAt = effectiveAtMax;

// ... queries ...

await writeAudit({
  ...,
  message: `summarized ${count} entries [snapshot=${new Date(snapshotAt).toISOString()}, generated=${new Date(generatedAt).toISOString()}]`,
});

return { count, entries, snapshotAt, generatedAt };
```

**주의**:
- 기존 `countedAt` 를 완전히 제거. 대체.
- audit message 는 두 값 모두 노출 (계약 투명성).
- clientAtMax 없으면 snapshotAt === generatedAt (동일).

**frontend types**:

기존 `auditLogSummary.ts`:
```ts
export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  countedAt: number;
}
```

변경 (동일하게):
```ts
export interface AuditLogSummaryResponse {
  count: number;
  entries: AuditLogEntryRead[];
  snapshotAt: number;
  generatedAt: number;
}
```

**super_admin/index.tsx**: `summaryQuery.data?.countedAt` 참조 있으면 `snapshotAt` 로 (미사용이면 그대로).

#### Commit 2 테스트

**`functions/tests/auditLogSummary.test.ts`** (2 신규):
1. client atMax 미래 (Date.now() 초과) → snapshotAt = generatedAt (min 로 clamp).
2. client atMax 과거 → snapshotAt = clientAtMax, generatedAt = Date.now(). 두 값 다름.

**`web/tests/auditLogSummary.test.ts`** — response type 두 필드 반영.

기존 시나리오 회귀 유지 (특히 countedAt 참조 있으면 조정).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 647 + 신규 3 = 650 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - super_admin loading/error 시 헤더 · preview banner 일관
   - 응답 두 필드 (snapshotAt + generatedAt) 사용 시 정확
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Firestore aggregation 검증** — emulator Java 없음.
- **generatedAt UI 노출** — 「N초 전 스냅샷」 등 UX 는 별도 slice.

### 커밋 규칙

**2 커밋 분리**:
1. `fix(web): super_admin 헤더 설명 loading/error/success 3분기 (Codex P13)`
2. `refactor(functions,web): audit.summary response 에 snapshotAt · generatedAt 분리 (Codex P14)`

각 conventional commits. `git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/codex-audit-p13-p14-v75`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
