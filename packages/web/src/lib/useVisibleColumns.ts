import { useCallback, useMemo } from 'react';
import { useLocalStorageState } from './useLocalStorageState';

// v0.292: 컬럼 표시 여부 (Set<K>) state + 관련 4 helper (toggleColumn · setAllVisible ·
//         applyMinimalPreset · isMinimalActive) shared.
// - 4 테이블 (Accounts/Groups/Classroom/AuditLog) 동일 20-line 반복 (useLocalStorageState +
//   toggleColumn + setAllVisible + applyMinimalPreset? + isMinimalActive?) 흡수.
// - `minimalKeys` 는 optional. 미전달 시 `applyMinimalPreset` 은 no-op · `isMinimalActive` 는 항상 false.
// - `useLocalStorageState` 위에 얇게 층 쌓음. serialize/deserialize 는 caller 가 관련 columns
//   에 매핑된 함수를 전달 (visibleColumnsStorage factory).

type UseVisibleColumnsColumn<K extends string> = { key: K };

export interface UseVisibleColumnsOptions<K extends string> {
  storageKey: string;
  columns: readonly UseVisibleColumnsColumn<K>[];
  defaults: readonly K[];
  serialize: (value: Set<K>) => string;
  deserialize: (raw: string) => Set<K> | undefined;
  minimalKeys?: readonly K[];
}

export interface UseVisibleColumnsReturn<K extends string> {
  visibleColumns: Set<K>;
  setVisibleColumns: (value: Set<K> | ((prev: Set<K>) => Set<K>)) => void;
  toggleColumn: (key: K) => void;
  setAllVisible: (visible: boolean) => void;
  applyMinimalPreset: () => void;
  isMinimalActive: boolean;
}

export function useVisibleColumns<K extends string>(
  opts: UseVisibleColumnsOptions<K>,
): UseVisibleColumnsReturn<K> {
  const { storageKey, columns, defaults, serialize, deserialize, minimalKeys } = opts;

  const defaultSet = useMemo(() => new Set<K>(defaults), [defaults]);
  const [visibleColumns, setVisibleColumns] = useLocalStorageState<Set<K>>(
    storageKey,
    defaultSet,
    serialize,
    deserialize,
  );

  const toggleColumn = useCallback(
    (key: K) => {
      setVisibleColumns((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [setVisibleColumns],
  );

  const setAllVisible = useCallback(
    (visible: boolean) => {
      setVisibleColumns(
        visible ? new Set<K>(columns.map((c) => c.key)) : new Set<K>(),
      );
    },
    [setVisibleColumns, columns],
  );

  const applyMinimalPreset = useCallback(() => {
    if (!minimalKeys || minimalKeys.length === 0) return;
    setVisibleColumns(new Set<K>(minimalKeys));
  }, [setVisibleColumns, minimalKeys]);

  const isMinimalActive = useMemo(() => {
    if (!minimalKeys || minimalKeys.length === 0) return false;
    if (visibleColumns.size !== minimalKeys.length) return false;
    return minimalKeys.every((k) => visibleColumns.has(k));
  }, [visibleColumns, minimalKeys]);

  return {
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    setAllVisible,
    applyMinimalPreset,
    isMinimalActive,
  };
}
