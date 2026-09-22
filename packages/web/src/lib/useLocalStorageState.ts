import { useCallback, useState } from 'react';

// v0.219: 값 하나를 React state 로 보유하면서 localStorage 에 자동 동기화.
// - lazy init: mount 시 `deserialize(raw)` 호출 · 실패/부재/`undefined` 반환 → `defaultValue`.
// - `setValue(next)`: state 갱신 + `serialize(next)` 를 `localStorage.setItem` 으로 저장.
// - `localStorage` 예외 (disabled · quota) 는 조용히 무시 (기존 패턴 보존).
// - `serialize/deserialize` 로 primitive · JSON · 커스텀 모두 지원 (기본 JSON).
//
// 대상 사용 사례 (v0.219 R0 도입 · 이후 확장):
//   - `<Table>.pageSize.v1` (number in string).
//   - `<Table>.visibleColumns.v1` (Set<string> in JSON array).
//   - `<Table>.sort.v1` (JSON object).
// deserialize 는 반환 타입 `T | undefined`: undefined 반환 시 default fallback.
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  serialize?: (v: T) => string,
  deserialize?: (raw: string) => T | undefined,
): [T, (value: T) => void] {
  const _serialize = serialize ?? ((v: T) => JSON.stringify(v));
  const _deserialize =
    deserialize ??
    ((raw: string): T | undefined => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    });

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return defaultValue;
      const parsed = _deserialize(raw);
      return parsed === undefined ? defaultValue : parsed;
    } catch {
      return defaultValue;
    }
  });

  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, _serialize(next));
      } catch {
        // localStorage disabled / quota → no-op.
      }
    },
    // key 변경은 사실상 없음 (mount 시 고정) · _serialize/_deserialize 는 caller 제공.
    // 안정성을 위해 key 만 dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, setAndPersist];
}
