import { useCallback, useEffect, useRef, useState } from 'react';

// v0.219: 값 하나를 React state 로 보유하면서 localStorage 에 자동 동기화.
// - lazy init: mount 시 `deserialize(raw)` 호출 · 실패/부재/`undefined` 반환 → `defaultValue`.
// - `setValue(next)`: state 갱신 + `serialize(next)` 를 `localStorage.setItem` 으로 저장.
//   `next` 는 `T | ((prev: T) => T)` (React `SetStateAction<T>` 대칭 · v0.219 R1 F-A).
// - `localStorage` 예외 (disabled · quota · SSR ReferenceError) 는 조용히 무시 (기존 패턴 보존).
// - `serialize/deserialize` 로 primitive · JSON · 커스텀 모두 지원 (기본 JSON).
//   caller 가 옵션을 `undefined` 로 되돌리면 기본 함수로 복원 (v0.219 R2 F-E).
// - key 변경 시 새 key 로 재 hydrate (v0.219 R1 F-C).
// - side effect (`localStorage.setItem`) 는 setter 밖 `useEffect` 로 이동해 updater purity
//   확보 (v0.219 R2 F-F · StrictMode/concurrent 중복 호출 안전).
//
// 대상 사용 사례:
//   - `<Table>.pageSize.v1` (number in string).
//   - `<Table>.visibleColumns.v1` (Set<string> in JSON array).
//   - `<Table>.sort.v1` (JSON object).
// deserialize 는 반환 타입 `T | undefined`: undefined 반환 시 default fallback.

type SetStateAction<T> = T | ((prev: T) => T);

const DEFAULT_SERIALIZE = <T,>(v: T): string => JSON.stringify(v);
const DEFAULT_DESERIALIZE = <T,>(raw: string): T | undefined => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  serialize?: (v: T) => string,
  deserialize?: (raw: string) => T | undefined,
): [T, (value: SetStateAction<T>) => void] {
  // v0.219 R1 F-B / R2 F-E: serialize/deserialize 를 ref 로 보유해 setter 는 항상 최신 함수 사용.
  //                        caller 가 undefined 로 되돌리면 default 로 복원 (F-E).
  const serializeRef = useRef<(v: T) => string>(serialize ?? DEFAULT_SERIALIZE);
  const deserializeRef = useRef<(raw: string) => T | undefined>(
    deserialize ?? DEFAULT_DESERIALIZE,
  );
  serializeRef.current = serialize ?? DEFAULT_SERIALIZE;
  deserializeRef.current = deserialize ?? DEFAULT_DESERIALIZE;

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
    // key 전환 hydrate 는 저장하지 않음 (writeVersion 을 bump 하지 않음).
    setValue(hydrate(key, defaultValue));
    // defaultValue 매 렌더 신규 참조라도 hydrate 는 그 시점 값만 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // v0.219 R2 F-F / R3 F-H / R4 F-K: side effect 는 setter 호출 시에만. 매 setter 호출마다
  //   증가하는 `writeVersion` 을 사용 — same-value 도 effect 확실히 fire (F-H).
  //   setter 호출 시점 `key` 와 resolved `value` 를 `pendingWriteRef` 에 snapshot 하여
  //   setter + key 변경이 한 배치라도 effect 가 setter 시점 key 에 저장 (F-K).
  const [writeVersion, setWriteVersion] = useState(0);
  const pendingWriteRef = useRef<{ key: string; value: T } | null>(null);
  useEffect(() => {
    if (writeVersion === 0) return; // mount skip.
    const pending = pendingWriteRef.current;
    if (!pending) return;
    pendingWriteRef.current = null;
    try {
      localStorage.setItem(pending.key, serializeRef.current(pending.value));
    } catch {
      // localStorage disabled / quota → no-op.
    }
  }, [writeVersion]);

  const setAndPersist = useCallback((next: SetStateAction<T>) => {
    // v0.219 R4 F-K: setter 호출 시점 key 를 sync 하게 capture. functional updater 안에서
    //                resolved value 를 계산해 pendingWriteRef 에 저장.
    const capturedKey = key;
    setValue((prev) => {
      const resolved =
        typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      pendingWriteRef.current = { key: capturedKey, value: resolved };
      return resolved;
    });
    setWriteVersion((v) => v + 1);
  }, [key]);

  return [value, setAndPersist];
}
