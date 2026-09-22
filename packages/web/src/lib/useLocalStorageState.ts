import { useCallback, useEffect, useRef, useState } from 'react';

// v0.219: 값 하나를 React state 로 보유하면서 localStorage 에 자동 동기화.
// - lazy init: mount 시 `deserialize(raw)` 호출 · 실패/부재/`undefined` 반환 → `defaultValue`.
// - `setValue(next)`: state 갱신 + `serialize(next)` 를 `localStorage.setItem` 으로 저장.
//   `next` 는 `T | ((prev: T) => T)` (React `SetStateAction<T>` 대칭 · v0.219 R1 F-A).
// - `localStorage` 예외 (disabled · quota · SSR ReferenceError) 는 조용히 무시 (기존 패턴 보존).
// - `serialize/deserialize` 로 primitive · JSON · 커스텀 모두 지원 (기본 JSON).
// - key 변경 시 새 key 로 재 hydrate (v0.219 R1 F-C).
//
// 대상 사용 사례:
//   - `<Table>.pageSize.v1` (number in string).
//   - `<Table>.visibleColumns.v1` (Set<string> in JSON array).
//   - `<Table>.sort.v1` (JSON object).
// deserialize 는 반환 타입 `T | undefined`: undefined 반환 시 default fallback.

type SetStateAction<T> = T | ((prev: T) => T);

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  serialize?: (v: T) => string,
  deserialize?: (raw: string) => T | undefined,
): [T, (value: SetStateAction<T>) => void] {
  // v0.219 R1 F-B: serialize/deserialize 를 ref 로 보유해 setter 는 항상 최신 함수 사용.
  //                deps 오염 없이 stale serializer 문제 해소.
  const serializeRef = useRef<(v: T) => string>(
    serialize ?? ((v: T) => JSON.stringify(v)),
  );
  const deserializeRef = useRef<(raw: string) => T | undefined>(
    deserialize ??
      ((raw: string): T | undefined => {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return undefined;
        }
      }),
  );
  serializeRef.current = serialize ?? serializeRef.current;
  deserializeRef.current = deserialize ?? deserializeRef.current;

  const hydrate = (k: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(k);
      if (raw === null || raw === undefined) return fallback;
      const parsed = deserializeRef.current(raw);
      return parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  };

  const [value, setValue] = useState<T>(() => hydrate(key, defaultValue));

  // v0.219 R1 F-C: key 변경 시 새 key 로 재 hydrate. `useState` initializer 는 mount 한 번만
  //                실행되므로, key prop 이 후속 변경되면 state 는 이전 key 상태로 stale.
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    setValue(hydrate(key, defaultValue));
    // defaultValue 매 렌더 신규 참조라도 hydrate 는 그 시점 값만 사용 (한 번 계산).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setAndPersist = useCallback(
    (next: SetStateAction<T>) => {
      // v0.219 R1 F-A: functional updater 지원 (`SetStateAction<T>` 대칭).
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, serializeRef.current(resolved));
        } catch {
          // localStorage disabled / quota → no-op.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, setAndPersist];
}
