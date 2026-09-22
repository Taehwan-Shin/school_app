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

  // v0.219 R2 F-F / R3 F-H / R4 F-K / R5 F-M/F-N: side effect 는 setter 호출 시에만.
  //   매 setter 호출마다 증가하는 `writeVersion` 을 사용 — same-value 도 effect 확실히 fire (F-H).
  //   setter 호출 시점의 `key` 와 `serialize` 를 `pendingWriteRef` 에 sync snapshot (R5 F-K/F-N).
  //   snapshot 은 state updater 밖에서 이뤄져 updater purity 유지 — StrictMode/concurrent 시
  //   updater 가 두 번 호출돼도 side effect 는 한 번만 (R5 F-M).
  //   effect 는 pending.key + pending.serialize + React 가 계산한 최신 `value` 로 저장.
  const [writeVersion, setWriteVersion] = useState(0);
  const pendingWriteRef = useRef<{
    key: string;
    serialize: (v: T) => string;
  } | null>(null);
  useEffect(() => {
    if (writeVersion === 0) return; // mount skip.
    const pending = pendingWriteRef.current;
    if (!pending) return;
    pendingWriteRef.current = null;
    try {
      localStorage.setItem(pending.key, pending.serialize(value));
    } catch {
      // localStorage disabled / quota → no-op.
    }
    // key/value/serialize 는 setter 시점 snapshot + React 커밋 value 사용. deps 는 version 만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeVersion]);

  const setAndPersist = useCallback(
    (next: SetStateAction<T>) => {
      // v0.219 R5 F-K/F-N: setter 호출 시점의 key + serialize 를 sync 하게 snapshot.
      // v0.219 F-M 계약: 아래 세 줄 순서를 지킨다.
      //   1. pending snapshot 을 sync 로 기록 (setValue 이전 · React 가 이 코드를 재실행하지 않음).
      //   2. `setValue(next)` — `next` 는 사용자 값 (T) 이거나 사용자 functional (prev => T).
      //      hook 은 next 를 wrap 하지 않고 그대로 넘긴다. React 는 이 updater 를 pure 로 취급 ·
      //      StrictMode 에서 두 번 호출할 수 있으므로 여기서 hook 이 side effect 를 감싸면 안 됨.
      //   3. writeVersion++ 로 persistence effect 트리거. same-value setter 도 fire.
      pendingWriteRef.current = {
        key,
        serialize: serializeRef.current,
      };
      setValue(next);
      setWriteVersion((v) => v + 1);
    },
    [key],
  );

  return [value, setAndPersist];
}
