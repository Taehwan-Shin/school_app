import { useCallback, useEffect } from 'react';
import { useLocalStorageState } from './useLocalStorageState';
import { deserializeSort, type StoredSortPref } from './sortStorage';

// v0.295: admin 3 테이블 (Accounts/Groups/Classroom) 이 반복하던 URL 기반 sort state 관리:
//   1. `sortColumn` 파생 — searchParams.get('sort') 를 whitelist 대조 후 K | null 로 좁힘
//   2. `sortDirection` 파생 — searchParams.get('dir') === 'desc' ? 'desc' : 'asc'
//   3. Mount hydrate — URL 이 비어 있으면 localStorage 저장값 → URL 로 hydrate (URL authoritative)
//   4. Persist effect — sortColumn / sortDirection 변경 시 localStorage 저장 (null 이면 「null」)
//   5. `handleSort(column)` — 같은 컬럼이면 dir 토글, 다른 컬럼이면 그 컬럼으로 asc
// - `useLocalStorageState` + `deserializeSort` 위에 얇게 층. hydrate 는 mount-only useEffect
//   (기존 3 site 와 동일 · dep 없으면 무한 loop 방지 위해 eslint-disable 유지).
// - `handleSort` 는 useCallback 안정 참조 (deps: searchParams · setSearchParams · sortColumn · sortDirection).

export type SortDirection = 'asc' | 'desc';

export type SetSearchParamsFn = (
  next: URLSearchParams,
  opts?: { replace?: boolean },
) => void;

export interface UseUrlSortOptions<K extends string> {
  storageKey: string;
  validColumns: readonly K[];
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParamsFn;
}

export interface UseUrlSortReturn<K extends string> {
  sortColumn: K | null;
  sortDirection: SortDirection;
  handleSort: (column: K) => void;
}

export function useUrlSort<K extends string>(
  opts: UseUrlSortOptions<K>,
): UseUrlSortReturn<K> {
  const { storageKey, validColumns, searchParams, setSearchParams } = opts;

  const rawSort = searchParams.get('sort');
  const sortColumn: K | null = (validColumns as readonly string[]).includes(rawSort ?? '')
    ? (rawSort as K)
    : null;
  const sortDirection: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  const [storedSort, setStoredSort] = useLocalStorageState<StoredSortPref | null>(
    storageKey,
    null,
    undefined,
    deserializeSort,
  );

  // Mount hydrate: URL 에 sort 없고 localStorage 저장값 있으면 URL 로 이식.
  // 3 admin 테이블 기존과 동일 · dep 없이 mount-only.
  useEffect(() => {
    if (searchParams.has('sort')) return;
    if (!storedSort) return;
    const next = new URLSearchParams(searchParams);
    if (typeof storedSort.sort === 'string' && (validColumns as readonly string[]).includes(storedSort.sort)) {
      next.set('sort', storedSort.sort);
    }
    if (storedSort.dir === 'asc' || storedSort.dir === 'desc') {
      next.set('dir', storedSort.dir);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // Mount-only hydrate: intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist effect: sortColumn / sortDirection 변경 시 저장. null 이면 「null」 저장.
  useEffect(() => {
    if (sortColumn) {
      setStoredSort({ sort: sortColumn, dir: sortDirection });
    } else {
      setStoredSort(null);
    }
  }, [sortColumn, sortDirection, setStoredSort]);

  const handleSort = useCallback(
    (column: K) => {
      const next = new URLSearchParams(searchParams);
      if (sortColumn === column) {
        // 같은 컬럼: 방향 토글.
        next.set('dir', sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // 다른 컬럼: 그 컬럼으로 asc.
        next.set('sort', column);
        next.set('dir', 'asc');
      }
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams, sortColumn, sortDirection],
  );

  return { sortColumn, sortDirection, handleSort };
}
