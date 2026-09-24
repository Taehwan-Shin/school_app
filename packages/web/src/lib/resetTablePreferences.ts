// v0.294: admin 3 테이블 (Accounts/Groups/Classroom) 이 반복하던
//         `resetUserPreferences` 21-line 함수의 boilerplate 흡수:
//         · window.confirm(고정 문구)
//         · localStorage.removeItem(sortStorageKey) try/catch
//         · URLSearchParams 에서 'sort'/'dir' 삭제 후 setSearchParams(next, { replace: false })
//         · 성공 banner 고정 문구 (caller 가 onAfterReset 안에서 showSuccessBanner 호출)
// - 실제 state reset (`setPageSize` / `setStoredSort` / `setVisibleColumns` / `setPage`) 은
//   caller 가 `resetState` closure 안에서 그대로 호출. 각 테이블의 defaults 는 그대로 caller 지식.
// - `onAfterReset` 은 optional. Column menu close · success banner show 등 이식 후처리.
// - 반환값: 사용자가 confirm 승인했으면 `true`, 취소했으면 `false`.
//   caller 가 확장 처리 필요 시 활용 (현재 3 테이블은 반환값 미사용).
// - AuditLogTable 은 「선호 초기화」 미도입 (v0.216 · 3 admin 테이블만) — 대상 외.

export const RESET_TABLE_PREFERENCES_CONFIRM_MESSAGE =
  '저장된 선호 (정렬 · 페이지 크기 · 컬럼 표시) 를 모두 기본값으로 초기화하시겠습니까?';
export const RESET_TABLE_PREFERENCES_BANNER_MESSAGE =
  '저장된 선호가 초기화되었습니다.';

export type SetSearchParamsFn = (
  next: URLSearchParams,
  opts?: { replace?: boolean },
) => void;

export interface ResetTablePreferencesOptions {
  sortStorageKey: string;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParamsFn;
  resetState: () => void;
  onAfterReset?: () => void;
}

export function resetTablePreferences(opts: ResetTablePreferencesOptions): boolean {
  const ok = window.confirm(RESET_TABLE_PREFERENCES_CONFIRM_MESSAGE);
  if (!ok) return false;

  try {
    localStorage.removeItem(opts.sortStorageKey);
  } catch {
    // localStorage disabled → no-op.
  }

  opts.resetState();

  const next = new URLSearchParams(opts.searchParams);
  next.delete('sort');
  next.delete('dir');
  opts.setSearchParams(next, { replace: false });

  opts.onAfterReset?.();

  return true;
}
