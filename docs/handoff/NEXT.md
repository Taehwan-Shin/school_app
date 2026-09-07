# NEXT.md — 일꾼 오더 파일

> 덮어쓰기 전용. 헤드가 여기에 「지금 할 것」을 적으면 일꾼(Antigravity) 이 읽는다.
> 지금 이 파일의 오더는 **Codex hotfix v0.89** — ClassroomBulkInviteDialog 연도 입력 세션 leak (F2) + batch invite auto-invalidate 30~40회 재조회 (F3). F1 (server-side pre-check) 은 별도 판단 · 이번 슬라이스 제외 이유는 아래.

## 상설 규약

`AGENTS.md` §3 그대로. 요약:
- 기존 파일 재작성 금지, 요청받은 부분만
- **삭제가 추가보다 많으면 멈추고 보고**
- `git add -A` 금지, `main` push 금지 — 작업 브랜치는 원격에 `git push -u origin fix/bulk-invite-codex-v89`
- 지금 코드와 다르면 다르다고 보고
- 「판정 불가」 허용
- 근거는 `파일:줄번호`, 항목당 한 줄
- **이모지 금지**
- **커밋 전 기계 관문 통과** — TypeScript · ESLint · Vitest

**추가**: 완료 후 반드시 스레드 보고. 커밋 1 개.

## 기준 커밋

**Base**: `53450c2` (classroom bulk invite v0.88 merge)

## 지금 할 것 — Codex F2 + F3 hotfix

### 왜

Codex `2fc269e` (v0.86~v0.88 병합 감사) 결과 실패 3건.

**F2** — `ClassroomBulkInviteDialog.tsx:87` — 연도 입력 세션 leak:
- 사용자가 `handleYearChange` 에 유효하지 않은 값 (예: "abc", "300", "1899", "2201", "") 입력하면 `yearInput` 만 변경되고 `selectedYear` · `selectedGrade` · `selectedClass` · targets 유지됨.
- UI 는 selectedYear (원래 유효 연도) 기반 grades 렌더 · 사용자는 연도 표시가 무효인데도 이전 반 선택 유지된 채 미리보기 진입 가능.
- 결과: 표시된 연도와 실제 초대 명단 불일치 → 잘못된 학생 초대 위험.

**F3** — `ClassroomBulkInviteDialog.tsx:103` — batch 중 auto-invalidate:
- `useClassroomStudentsAdd` hook 의 `onSuccess` 콜백이 학생 add 성공마다 `['classroom', 'students', courseId]` invalidate.
- 30~40명 batch 시 매번 rosters 재조회 · 서버측 `classroom.read` audit 도 30~40회 발생.
- line 118 에서 종료 후 다시 1회 invalidate → 불필요한 중복.
- 결과: 배치 초대 성능 저하 · audit_log 노이즈 증가.

**F1** — `studentsAdd.ts:85` — server-side resource-scope 검증 (Teachers.list 기반 사전 확인):
- Codex 의견: cap · scope 통과 후 곧바로 변경 API 호출 · 대상 코스 담당 교사 여부 미확인.
- **헤드 판단 — 이번 슬라이스 제외**:
  1. 현재 upstream 403 (권한 부족) 은 `mapUpstreamError` 로 정확히 `permission-denied` 매핑 → audit `denied` 기록 → 사용자에 오류 표시. 정확성 유지됨.
  2. Pre-check 는 매 add/delete 마다 추가 API 호출 (Teachers.list) → 대량 초대 시 2× 비용 · 지연.
  3. 실제 정책: `classroom.write` cap 은 admin · super_admin 만 (roleCapabilities.ts:8) · 이들의 OAuth 토큰은 domain-wide 권한 (admin.directory scopes 포함) · 사실상 모든 코스에 write 가능.
  4. teacher 역할은 `classroom.write` 없음 → 애초에 인증 통과 못함.
  → server pre-check 는 defense-in-depth 관점에서만 유효 · 실효 없음 · 비용 큼.

  대신 F1 의 UX 우려 (실패해도 사용자 인지 어려움) 는 batch invite 시 client-side 한 번 담당 교사 목록 확인 · 현재 사용자가 담당 교사가 아니면 경고 배너로 안내 · 실행 자체는 허용. **하지만 이번 슬라이스 제외** — F2+F3 만 우선 처리 · client 경고는 별도 slice (v0.90+) 로 판단 (UX 우선순위 낮음 · 실 사용 후 확인 후 결정).

**하지 않는 것**: F1 server pre-check · client warning · 다른 도메인.

### 이 과제가 바꿀 경로

**수정 대상**:
- `packages/web/src/routes/admin/ClassroomBulkInviteDialog.tsx`
  - F2: `handleYearChange` 로직 재작성 (invalid 시 반 선택 리셋 + preview 진입 차단)
  - F3: `useClassroomStudentsAdd` hook 대신 `callClassroomStudentsAdd` 직접 호출 (auto-invalidate 우회)
- `packages/web/src/api/classroomStudentsAdd.ts` — 이미 export 되어 있으면 그대로. 없으면 named export 추가.
- `packages/web/tests/ClassroomBulkInviteDialog.test.tsx` — 시나리오 2~3 추가 (year invalid · batch 중 invalidate 없음)

**손대지 마라**:
- classroomStudentsAdd hook 자체 (다른 곳에서 auto-invalidate 필요).
- studentsAdd callable (F1 반영 안 함).
- 다른 도메인.

### 세부 요구

#### 1. F2 — Year input strict validation

**현재**:
```ts
const handleYearChange = (val: string) => {
  setYearInput(val);
  const parsed = Number.parseInt(val, 10);
  if (Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200) {
    setSelectedYear(parsed);
    setSelectedGrade(null);
    setSelectedClass(null);
  }
};
```

**수정**:
```ts
const isYearValid = (val: string): boolean => {
  const trimmed = val.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return false;   // 정수만 · 소수·기타 문자 거절
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2200;
};

const handleYearChange = (val: string) => {
  setYearInput(val);
  setSelectedGrade(null);        // 모든 입력 변경 시 무조건 반 선택 초기화
  setSelectedClass(null);
  if (isYearValid(val)) {
    setSelectedYear(Number.parseInt(val.trim(), 10));
  }
};
```

**추가 가드**:

미리보기 진입 조건 (line 231 `disabled` 확장):
```tsx
disabled={
  !isYearValid(yearInput) ||
  selectedGrade === null ||
  selectedClass === null ||
  targets.length === 0
}
```

useMemo `targets` 도 방어적:
```ts
const targets = useMemo(() => {
  if (!isYearValid(yearInput)) return [];
  if (selectedGrade === null || selectedClass === null) return [];
  return rosters[String(selectedGrade)]?.[selectedClass] ?? [];
}, [rosters, selectedGrade, selectedClass, yearInput]);
```

#### 2. F3 — Batch bypass auto-invalidate

**현재**: `studentAddMutation.mutateAsync({ courseId, userId: email })` 순차 호출 → 매 성공마다 hook 의 `onSuccess` 콜백이 `['classroom', 'students', courseId]` invalidate.

**수정**: `import { callClassroomStudentsAdd } from '../../api/classroomStudentsAdd'` 직접 사용:

```ts
// import 추가:
import { callClassroomStudentsAdd } from '../../api/classroomStudentsAdd';

// studentAddMutation 삭제 (또는 다른 목적으로 사용 안 하면 완전 제거).
```

**루프 수정**:
```ts
for (let i = 0; i < targets.length; i++) {
  const email = targets[i];
  try {
    await callClassroomStudentsAdd({ courseId, userId: email });
    localResults.push({ email, kind: 'ok' });
  } catch (err) {
    const message = (err as Error)?.message || 'unknown error';
    const kind = isAlreadyMemberError(message) ? 'skipped' : 'failed';
    localResults.push({ email, kind, message });
  }
  setProgress(i + 1);
}

setResults(localResults);
setPhase('done');
queryClient?.invalidateQueries({ queryKey: ['classroom', 'students', courseId] });   // 종료 시 1회 (기존 유지)
```

**주의**: `callClassroomStudentsAdd` 는 already exported (`packages/web/src/api/classroomStudentsAdd.ts`). Named export 확인만.

**side effect**: hook state (`isPending`) 로 「초대 실행 중」 표시하던 부분 없음 (이미 phase state 로 관리). 그대로 사용.

#### 3. Test 시나리오 추가 (`ClassroomBulkInviteDialog.test.tsx`)

기존 9 시나리오 유지. 신규 3 추가:

10. year invalid ("abc" · "1500" · "" · "2020.5") 입력 → selectedGrade/Class null 로 리셋 · preview 버튼 disabled.
11. year 유효 → invalid → 유효 시퀀스: 반 선택 초기화 확인.
12. execute 시 매 학생 add 마다 queryClient.invalidateQueries 미호출 · 종료 후 1회만 호출 (mock spy).

### 완료 확인

1. `pnpm install --frozen-lockfile` 통과.
2. `pnpm -r build` 통과.
3. `pnpm -r lint` 통과.
4. `pnpm -r test` — 이전 859 + 신규 3 = 862 근처.
5. `pnpm -r test:emu` — 43 유지.
6. dev 서버 확인:
   - `/admin/classrooms` 코스 「멤버」 → 학생 탭 → 「학급 일괄 초대」 → 잘못된 연도 (예: "abc") 입력 → 반 선택 해제 확인.
   - 30명 이상 학생 초대 시 network 탭에서 students list callable 이 1회만 호출됨 확인.
7. 프로덕션 번들 grep — 우리 emulator URL 0 건.

### 판정 불가

- **실 Classroom bulk invite 최적화 효과** — 실 계정 필요.
- **F1 server pre-check** — 헤드 판단상 defer.
- **F1 client warning** — v0.90+ 별도 판단.

### 커밋 규칙

**1 커밋** (단일 파일 fix · 테스트만):

`fix(web): ClassroomBulkInviteDialog year strict validation + bypass batch auto-invalidate (Codex v0.88 F2+F3)`

`git add -A` 금지.

**작업 브랜치** — `git push -u origin fix/bulk-invite-codex-v89`.

## 상태 보고 (필수)

완료 시 `#general` 스레드에 `@Claude Code_Honey` 포함.
